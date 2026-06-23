const crypto = require('crypto');

const db = require('../database/db');
const transactionRepository = require('../repositories/transaction.repository');
const userRepository = require('../repositories/user.repository');

function generateReference(prefix = 'TXN') {
    return `${prefix}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

function normalizeAmount(amount) {
    const parsed = Number(amount);

    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('Amount must be greater than zero');
    }

    return parsed;
}

async function applyBalanceMovement(entry) {
    const user = await userRepository.findUserById(entry.user_id);

    if (!user) {
        throw new Error('User not found');
    }

    if (entry.type === 'DEBIT' && Number(user.balance) < entry.amount) {
        throw new Error('Insufficient available balance');
    }

    const delta = entry.type === 'CREDIT'
        ? entry.amount
        : -entry.amount;

    return await userRepository.incrementBalance(entry.user_id, delta);
}

async function postEntry(data) {
    return await db.withTransaction(async () => {
        const amount = normalizeAmount(data.amount);
        const reference = data.reference || generateReference();
        const status = data.status || 'COMPLETED';

        if (data.type !== 'CREDIT' && data.type !== 'DEBIT') {
            throw new Error('Invalid transaction type');
        }

        const existing = await transactionRepository.getTransactionByReference(reference);

        if (existing) {
            if (existing.status === 'COMPLETED') {
                return existing;
            }

            if (status === 'COMPLETED') {
                if (existing.type !== data.type || Number(existing.amount) !== amount) {
                    throw new Error('Ledger reference conflict');
                }

                await applyBalanceMovement({
                    ...existing,
                    amount
                });

                return await transactionRepository.updateTransactionStatus(
                    reference,
                    'COMPLETED'
                );
            }

            if (existing.status !== status) {
                return await transactionRepository.updateTransactionStatus(
                    reference,
                    status
                );
            }

            return existing;
        }

        if (status === 'COMPLETED') {
            await applyBalanceMovement({
                user_id: data.user_id,
                type: data.type,
                amount
            });
        }

        return await transactionRepository.createTransaction({
            user_id: data.user_id,
            reference,
            type: data.type,
            category: data.category || 'manual_entry',
            amount,
            currency: data.currency,
            status,
            description: data.description,
            created_by: data.created_by,
            transaction_date: data.transaction_date || null
        });
    });
}

async function markEntryStatus(reference, status) {
    return await db.withTransaction(async () => {
        const existing = await transactionRepository.getTransactionByReference(reference);

        if (!existing) {
            return null;
        }

        if (existing.status === 'COMPLETED') {
            return existing;
        }

        return await transactionRepository.updateTransactionStatus(reference, status);
    });
}

async function adjustBalanceTo(userId, targetBalance, metadata = {}) {
    return await db.withTransaction(async () => {
        const user = await userRepository.findUserById(userId);

        if (!user) {
            throw new Error('User not found');
        }

        const target = Number(targetBalance);

        if (!Number.isFinite(target) || target < 0) {
            throw new Error('Balance must be a non-negative number');
        }

        const current = Number(user.balance || 0);
        const delta = target - current;

        if (delta === 0) {
            return {
                user,
                transaction: null
            };
        }

        const type = delta > 0 ? 'CREDIT' : 'DEBIT';
        const amount = Math.abs(delta);

        const transaction = await postEntry({
            user_id: user.id,
            reference: metadata.reference || generateReference('ADJ'),
            type,
            category: metadata.category || 'balance_adjustment',
            amount,
            currency: user.preferred_currency,
            status: 'COMPLETED',
            description: metadata.description || `Balance adjusted to ${target}`,
            created_by: metadata.created_by
        });

        return {
            user: await userRepository.findUserById(user.id),
            transaction
        };
    });
}

module.exports = {
    postEntry,
    markEntryStatus,
    adjustBalanceTo,
    generateReference
};
