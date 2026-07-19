const transactionRepository =
    require('../repositories/transaction.repository');

const userRepository =
    require('../repositories/user.repository');

const ledgerService =
    require('./ledger.service');

async function createTransaction(data) {

    const user =
        await userRepository
            .findUserById(
                data.user_id
            );

    if (!user) {

        throw new Error(
            'User not found'
        );
    }

    if (
        data.type !== 'CREDIT' &&
        data.type !== 'DEBIT'
    ) {
        throw new Error(
            'Invalid transaction type'
        );
    }

    const defaultCategory =
        data.type === 'CREDIT'
            ? 'deposit'
            : 'account_debit';

    const defaultDescription =
        data.type === 'CREDIT'
            ? 'Account Deposit'
            : 'Account Debit';

    const origin = {
        origin_name: String(data.origin_name || '').trim().slice(0, 160),
        origin_bank: String(data.origin_bank || '').trim().slice(0, 160),
        origin_account_number: String(data.origin_account_number || '').trim().slice(0, 80)
    };

    return await ledgerService
        .postEntry({

            user_id:
                data.user_id,

            reference:
                data.reference ||
                ledgerService.generateReference(),

            type:
                data.type,

            category:
                data.category ||
                defaultCategory,

            amount:
                data.amount,

            currency:
                data.currency ||
                user.preferred_currency,

            status:
                data.status ||
                'COMPLETED',

            description:
                data.description ||
                defaultDescription,

            created_by:
                data.created_by,

            transaction_date:
                data.transaction_date || null,

            ...origin
        });
}

async function fetchTransactions() {

    return await transactionRepository
        .getTransactions();
}

async function fetchUserTransactions(
    userId
) {

    return await transactionRepository
        .getUserTransactions(
            userId
        );
}

async function createBatchTransactions(
    transactions,
    adminId
) {

    const results = [];

    for (const transaction of transactions) {

        const createdTransaction =
            await createTransaction({

                ...transaction,

                created_by:
                    adminId
            });

        results.push(
            createdTransaction
        );
    }

    return results;
}

async function updateTransactionStatus(reference, status) {
    return await ledgerService.markEntryStatus(reference, status);
}

module.exports = {
    createTransaction,
    fetchTransactions,
    fetchUserTransactions,
    createBatchTransactions,
    updateTransactionStatus
};
