const transactionService =
    require('../services/transaction.service');

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