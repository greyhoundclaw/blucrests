const transactionService =
    require('../services/transaction.service');
const emailService = require('../services/email.service');
const userRepository = require('../repositories/user.repository');

const {
    successResponse,
    errorResponse
} = require('../utils/response');

async function create(
    req,
    res,
    body
) {

    console.log('=== TRANSACTION CONTROLLER HIT ===');
    console.log(body);
    try {

        const transaction =
            await transactionService
                .createTransaction({

                    ...body,

                    created_by:
                        req.user
                            ? req.user.id
                            : null
                });

        try {
            const recipient = await userRepository.findUserById(body.user_id);
            await emailService.sendSingleTransactionEmail(recipient, transaction);
        } catch (emailError) {
            // A provider outage must not reverse a completed ledger entry.
            console.error('Single transaction email failed:', emailError.message);
        }



        return successResponse(
            res,
            transaction,
            'Transaction created successfully',
            201
        );

    } catch (error) {

        return errorResponse(
            res,
            error.message,
            500
        );
    }
}

async function getAll(
    req,
    res
) {

    try {

        const transactions =
            await transactionService
                .fetchTransactions();

        return successResponse(
            res,
            transactions,
            'Transactions fetched successfully'
        );

    } catch (error) {

        return errorResponse(
            res,
            error.message,
            500
        );
    }
}

async function getUserTransactions(
    req,
    res,
    userId
) {

    try {

        const transactions =
            await transactionService
                .fetchUserTransactions(
                    userId
                );

        return successResponse(
            res,
            transactions,
            'User transactions fetched successfully'
        );

    } catch (error) {

        return errorResponse(
            res,
            error.message,
            500
        );
    }
}

async function createBatch(
    req,
    res,
    body
) {

    try {

        const results =
            await transactionService
                .createBatchTransactions(
                    body.transactions,
                    req.user.id
                );

        return successResponse(
            res,
            results,
            'Batch transactions created successfully',
            201
        );

    } catch (error) {

        return errorResponse(
            res,
            error.message,
            500
        );
    }
}

module.exports = {
    create,
    getAll,
    getUserTransactions,
    createBatch
};
