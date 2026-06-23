const transactionController =
    require('../controllers/transaction.controller');

const {
    requireAuth
} = require('../middleware/auth.middleware');
const {
    requireAdmin
} = require('../middleware/admin.middleware');

async function transactionRoutes(
    req,
    res,
    body
) {

    if (
        req.method === 'POST' &&
        req.url === '/api/v1/transactions'
    ) {

        const authenticated =
            await requireAdmin(
                req,
                res
            );

        if (!authenticated) {
            return true;
        }

        return transactionController
            .create(
                req,
                res,
                body
            );
    }

    if (
        req.method === 'GET' &&
        req.url === '/api/v1/transactions'
    ) {

        const authenticated =
            await requireAdmin(
                req,
                res
            );

        if (!authenticated) {
            return true;
        }

        return transactionController
            .getAll(
                req,
                res
            );
    }

    if (
        req.method === 'GET' &&
        req.url.startsWith(
            '/api/v1/transactions/user/'
        )
    ) {

        const authenticated =
            await requireAuth(
                req,
                res
            );

        if (!authenticated) {
            return true;
        }

        const userId =
            req.url.split('/').pop();

        if (
            req.user.role !== 'ADMIN' &&
            Number(req.user.id) !== Number(userId)
        ) {
            const { errorResponse } = require('../utils/response');
            errorResponse(res, 'Transaction access denied', 403);
            return true;
        }

        return transactionController
            .getUserTransactions(
                req,
                res,
                userId
            );
    }


    if (
        req.method === 'POST' &&
        req.url === '/api/v1/transactions/batch'
    ) {

        const adminAuthorized =
            await requireAdmin(
                req,
                res
            );

        if (!adminAuthorized) {
            return true;
        }

        return transactionController
            .createBatch(
                req,
                res,
                body
            );
    }


    return false;
}

module.exports =
    transactionRoutes;
