const crypto = require('crypto');

const db = require('../database/db');
const transactionRepository = require('../repositories/transaction.repository');
const userRepository = require('../repositories/user.repository');
const notificationRepository = require('../repositories/notification.repository');

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

function formatMoney(amount, currency = 'USD') {
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: String(currency || 'USD').toUpperCase()
        }).format(Number(amount));
    } catch (_error) {
        return `${currency || 'USD'} ${Number(amount).toFixed(2)}`;
    }
}

function formatTransactionDate(value) {
    const date = new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return String(value || 'today');
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
    }).format(date);
}

async function createAccountActivityNotification({ userId, accountKind, entry, actorId }) {
    const credited = entry.type === 'CREDIT';
    const accountLabel = accountKind === 'JOINT' ? 'joint account' : 'account';
    const verb = credited ? 'credited' : 'debited';
    const amount = formatMoney(entry.amount, entry.currency);
    const date = formatTransactionDate(entry.transaction_date || entry.created_at);
    const description = String(entry.description || (credited ? 'Account Deposit' : 'Account Debit')).trim();
    return notificationRepository.createNotification({
        user_id: userId,
        title: accountKind === 'JOINT'
            ? `Joint account ${verb}`
            : `Account ${verb}`,
        message: `Your ${accountLabel} was ${verb} with ${amount} on ${date}. Description: ${description}.`,
        type: credited ? 'SUCCESS' : 'INFO',
        action_link: accountKind === 'JOINT' ? '/joint-accounts' : '/history',
        created_by: actorId || null
    });
}

async function applyBalanceMovement(entry) {
    const user = await userRepository.findUserById(entry.user_id);

    if (!user) {
        throw new Error('User not found');
    }

    const delta = entry.type === 'CREDIT'
        ? entry.amount
        : -entry.amount;

    if (entry.account_id) {
        const account = (await db.query(`SELECT * FROM accounts WHERE id = ?`, [entry.account_id]))[0];
        if (account?.account_kind === 'JOINT') {
            const owner = (await db.query(`SELECT id FROM account_owners WHERE account_id = ? AND user_id = ? AND status = 'ACCEPTED'`, [account.id, entry.user_id]))[0];
            if (!owner) throw new Error('Joint account access denied');
            if (entry.type === 'DEBIT' && Number(account.balance) < entry.amount) throw new Error('Insufficient available balance');
            await db.query(`UPDATE accounts SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [delta, account.id]);
            return (await db.query(`SELECT * FROM accounts WHERE id = ?`, [account.id]))[0];
        }
    }

    if (entry.type === 'DEBIT' && Number(user.balance) < entry.amount) {
        throw new Error('Insufficient available balance');
    }

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
                amount,
                account_id: data.account_id || null
            });
        }

        const ownerAccount = data.account_id ? { account_id: data.account_id } : (await db.query(`
            SELECT ao.account_id FROM account_owners ao
            JOIN accounts a ON a.id = ao.account_id
            WHERE ao.user_id = ? AND ao.role = 'PRIMARY_OWNER' AND ao.status = 'ACCEPTED'
              AND a.account_kind = 'PRIMARY'
            ORDER BY ao.id ASC LIMIT 1
        `, [data.user_id]))[0];

        const created = await transactionRepository.createTransaction({
            user_id: data.user_id,
            reference,
            type: data.type,
            category: data.category || (data.type === 'CREDIT' ? 'deposit' : 'account_debit'),
            amount,
            currency: data.currency,
            status,
            description: data.description || (data.type === 'CREDIT' ? 'Account Deposit' : 'Account Debit'),
            created_by: data.created_by,
            transaction_date: data.transaction_date || null,
            account_id: ownerAccount?.account_id || null,
            performed_by: data.performed_by || data.created_by || data.user_id
        });

        if (status === 'COMPLETED') {
            const account = ownerAccount?.account_id
                ? (await db.query(`SELECT account_kind FROM accounts WHERE id = ?`, [ownerAccount.account_id]))[0]
                : null;
            const accountKind = account?.account_kind === 'JOINT' ? 'JOINT' : 'PRIMARY';
            if (ownerAccount?.account_id && accountKind !== 'JOINT') {
                await db.query(`UPDATE accounts SET balance = (SELECT balance FROM users WHERE id = ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [data.user_id, ownerAccount.account_id]);
            }
            const performerId = data.performed_by || data.created_by || data.user_id;
            if (accountKind === 'JOINT') {
                const owners = await db.query(`
                    SELECT ao.user_id FROM account_owners ao
                    WHERE ao.account_id = ? AND ao.status = 'ACCEPTED' AND ao.user_id != ?
                `, [ownerAccount.account_id, performerId]);
                for (const owner of owners) {
                    await createAccountActivityNotification({
                        userId: owner.user_id,
                        accountKind: 'JOINT',
                        entry: created,
                        actorId: performerId
                    });
                }
            } else if (Number(performerId) !== Number(data.user_id)) {
                await createAccountActivityNotification({
                    userId: data.user_id,
                    accountKind: 'PRIMARY',
                    entry: created,
                    actorId: performerId
                });
            }
        }

        return created;
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
