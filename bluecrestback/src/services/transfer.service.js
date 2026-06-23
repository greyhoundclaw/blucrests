const bcrypt = require('bcrypt');
console.log(
    'TRANSFER SERVICE LOADED'
);

const transferRepository =
    require('../repositories/transfer.repository');

const userRepository =
    require('../repositories/user.repository');

const ledgerService =
    require('./ledger.service');

const db =
    require('../database/db');
const transferVerificationService =
    require('./transfer-verification.service');

function debitReference(transferId) {
    return `TXN-TRF-${transferId}-DEBIT`;
}

function creditReference(transferId) {
    return `TXN-TRF-${transferId}-CREDIT`;
}

async function createTransfer(
    user,
    data
) {
    const amount = Number(data.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Transfer amount must be greater than zero');
    }

    if (
        user.status === 'RESTRICTED'
    ) {
        throw new Error(
            'Account restricted'
        );
    }

    if (
        user.status === 'SUSPENDED'
    ) {
        throw new Error(
            'Account suspended'
        );
    }

    if (
        user.transfer_flow ===
        'RESTRICTED'
    ) {
        throw new Error(
            'Transfers are restricted on this account'
        );
    }
    const validPin =
        await bcrypt.compare(
            data.pin,
            user.transfer_pin
        );

    if (!validPin) {
        throw new Error(
            'Invalid transfer PIN'
        );
    }

    if (
        Number(user.balance) < amount
    ) {
        throw new Error(
            'Insufficient available balance for this transfer'
        );
    }
    if (user.transfer_flow === 'AUTHORIZATION_HOLD') {
        throw new Error(
            'Transfer on hold. Obtain your Authorization Code from the administrator before continuing.'
        );
    }

    const verificationSession = user.transfer_flow === 'AUTHORIZATION_REQUIRED'
        ? await transferVerificationService.consume(
            user.id,
            data.verification_token
        )
        : null;

    if (
        data.transfer_type ===
        'INTERNAL'
    ) {

        const recipient =
            await userRepository
                .findUserByAccountNumber(
                    data.recipient_account_number
                );

        if (!recipient) {

            throw new Error(
                'Recipient account not found'
            );
        }

        const shouldCompleteImmediately =
            user.transfer_flow === 'COMPLETED';

        return await db.withTransaction(async () => {
            const transfer = await transferRepository
                .createTransfer({

                    sender_id:
                        user.id,

                    transfer_type:
                        'INTERNAL',

                    recipient_user_id:
                        recipient.id,

                    recipient_account_number:
                        recipient.account_number,

                    recipient_name:
                        `${recipient.first_name} ${recipient.last_name}`,

                    amount,

                    currency:
                        user.preferred_currency,

                    status:
                        'PENDING',

                    description:
                        data.description,

                    verification_code_id:
                        verificationSession ? verificationSession.code_id : null
                });

            await ledgerService.postEntry({
                user_id: user.id,
                type: 'DEBIT',
                category: 'transfer',
                amount,
                currency: user.preferred_currency,
                status: 'PENDING',
                reference: debitReference(transfer.id),
                description: `Internal Transfer to ${recipient.first_name} ${recipient.last_name} (${recipient.account_number})`
            });

            if (shouldCompleteImmediately) {
                return await completeTransfer(transfer.id);
            }

            return transfer;
        });
    }

    if (
        data.transfer_type ===
        'EXTERNAL'
    ) {
        if (!String(data.recipient_name || '').trim()) {
            throw new Error('Recipient name is required');
        }

        if (!String(data.recipient_bank || '').trim()) {
            throw new Error('Recipient bank is required');
        }

        if (!String(data.recipient_account_number || '').trim()) {
            throw new Error('Recipient account number is required');
        }

        const shouldCompleteImmediately =
            user.transfer_flow === 'COMPLETED';

        return await db.withTransaction(async () => {
            const transfer = await transferRepository
                .createTransfer({
                    sender_id: user.id,
                    transfer_type: 'EXTERNAL',
                    recipient_name: data.recipient_name,
                    recipient_bank: data.recipient_bank,
                    recipient_account_number: data.recipient_account_number,
                    amount,
                    currency: user.preferred_currency,
                    status: 'PENDING',
                    description: data.description
                    ,
                    verification_code_id: verificationSession ? verificationSession.code_id : null
                });

            await ledgerService.postEntry({
                user_id: user.id,
                type: 'DEBIT',
                category: 'transfer',
                amount,
                currency: user.preferred_currency,
                status: 'PENDING',
                reference: debitReference(transfer.id),
                description: `Wire/External Transfer to ${data.recipient_name} (${data.recipient_bank} / ${data.recipient_account_number})`
            });

            if (shouldCompleteImmediately) {
                return await completeTransfer(transfer.id);
            }

            return transfer;
        });
    }

    throw new Error(
        'Invalid transfer type'
    );
}

async function fetchTransfers(user) {
    if (user && user.role !== 'ADMIN') {
        return await transferRepository.getUserTransfers(user.id);
    }
    return await transferRepository.getTransfers();
}

async function completeTransfer(transferId) {
    return await db.withTransaction(async () => {
        const transfer = await transferRepository.getTransferById(transferId);

        if (!transfer) {
            throw new Error('Transfer record not found');
        }

        if (transfer.status === 'COMPLETED') {
            return transfer;
        }

        if (transfer.status === 'REJECTED' || transfer.status === 'DECLINED' || transfer.status === 'FAILED') {
            throw new Error(`Transfer cannot be completed from ${transfer.status} status`);
        }

        const sender = await userRepository.findUserById(transfer.sender_id);

        if (!sender) {
            throw new Error('Sender profile not found');
        }

        await ledgerService.postEntry({
            user_id: sender.id,
            reference: debitReference(transfer.id),
            type: 'DEBIT',
            category: 'transfer',
            amount: transfer.amount,
            currency: transfer.currency || sender.preferred_currency,
            status: 'COMPLETED',
            description: transfer.transfer_type === 'INTERNAL'
                ? `Internal Transfer to ${transfer.recipient_name} (${transfer.recipient_account_number})`
                : `Wire/External Transfer to ${transfer.recipient_name} (${transfer.recipient_bank} / ${transfer.recipient_account_number})`
        });

        if (transfer.transfer_type === 'INTERNAL' && transfer.recipient_user_id) {
            const recipient = await userRepository.findUserById(transfer.recipient_user_id);

            if (!recipient) {
                throw new Error('Recipient profile not found');
            }

            await ledgerService.postEntry({
                user_id: recipient.id,
                reference: creditReference(transfer.id),
                type: 'CREDIT',
                category: 'transfer',
                amount: transfer.amount,
                currency: recipient.preferred_currency,
                status: 'COMPLETED',
                description: `Internal Transfer from ${sender.first_name} ${sender.last_name} (${sender.account_number})`
            });
        }

        return await transferRepository.updateTransferStatus(
            transfer.id,
            'COMPLETED'
        );
    });
}

async function changeTransferStatus(
    transferId,
    status
) {
    if (status === 'COMPLETED') {
        return await completeTransfer(transferId);
    } else if (status === 'RESTRICTED' || status === 'REJECTED' || status === 'DECLINED') {
        const transfer = await transferRepository.getTransferById(transferId);
        if (transfer && transfer.status !== 'COMPLETED') {
            await ledgerService.markEntryStatus(debitReference(transfer.id), 'DECLINED');
            await ledgerService.markEntryStatus(creditReference(transfer.id), 'DECLINED');
        }
    }

    return await transferRepository
        .updateTransferStatus(
            transferId,
            status
        );
}


async function getTransferReceipt(
    transferId,
    requester
) {

    const transfer =
        await transferRepository
            .getTransferById(
                transferId
            );

    if (!transfer) {
        throw new Error(
            'Transfer not found'
        );
    }

    if (
        requester.role !== 'ADMIN' &&
        Number(transfer.sender_id) !== Number(requester.id) &&
        Number(transfer.recipient_user_id) !== Number(requester.id)
    ) {
        throw new Error('Receipt access denied');
    }

    if (transfer.status !== 'COMPLETED') {
        throw new Error('Receipt is available after the transfer is completed');
    }

    return {

        receipt_number:
            `BCR-${String(transfer.id).padStart(8, '0')}`,

        transfer_id:
            transfer.id,

        transfer_type:
            transfer.transfer_type,

        recipient_name:
            transfer.recipient_name,

        recipient_bank:
            transfer.recipient_bank,

        recipient_account_number:
            transfer.recipient_account_number,

        amount:
            transfer.amount,

        currency:
            transfer.currency,

        status:
            transfer.status,

        description:
            transfer.description,

        created_at:
            transfer.created_at,

        company_name:
            process.env.COMPANY_NAME || 'Blue Crest Premium Banking',

        company_tagline:
            process.env.COMPANY_TAGLINE || 'Secure international financial services'
    };
}

module.exports = {
    createTransfer,
    fetchTransfers,
    changeTransferStatus,
    completeTransfer,
    getTransferReceipt
};
