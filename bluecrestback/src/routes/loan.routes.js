const loanController =
    require('../controllers/loan.controller');

const {
    requireAuth
} = require('../middleware/auth.middleware');

const {
    requireAdmin
} = require('../middleware/admin.middleware');

async function loanRoutes(
    req,
    res,
    body
) {

    // CREATE LOAN APPLICATION

    if (
        req.method === 'POST' &&
        req.url === '/api/v1/loans'
    ) {

        const authenticated =
            await requireAuth(
                req,
                res
            );

        if (!authenticated) {
            return true;
        }

        return loanController
            .create(
                req,
                res,
                body
            );
    }

    // GET ALL LOANS (ADMIN)

    if (
        req.method === 'GET' &&
        req.url === '/api/v1/loans'
    ) {

        const adminAuthorized =
            await requireAdmin(
                req,
                res
            );

        if (!adminAuthorized) {
            return true;
        }

        return loanController
            .getAll(
                req,
                res
            );
    }

    // GET USER LOANS

    if (
        req.method === 'GET' &&
        req.url.startsWith(
            '/api/v1/loans/user/'
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
            req.url
                .split('/')
                .pop();

        return loanController
            .getUserLoans(
                req,
                res,
                userId
            );
    }


    if (
        req.method === 'PATCH' &&
        req.url.endsWith('/fee')
    ) {

        const adminAuthorized =
            await requireAdmin(
                req,
                res
            );

        if (!adminAuthorized) {
            return true;
        }

        const parts =
            req.url.split('/');

        const loanId =
            parts[4];

        return loanController
            .assignFee(
                req,
                res,
                body,
                loanId
            );
    }

    if (
        req.method === 'PATCH' &&
        req.url.endsWith(
            '/confirm-fee'
        )
    ) {

        const adminAuthorized =
            await requireAdmin(
                req,
                res
            );

        if (!adminAuthorized) {
            return true;
        }

        const parts =
            req.url.split('/');

        const loanId =
            parts[4];

        return loanController
            .confirmFee(
                req,
                res,
                loanId
            );
    }


    if (
        req.method === 'PATCH' &&
        req.url.endsWith(
            '/disburse'
        )
    ) {

        const adminAuthorized =
            await requireAdmin(
                req,
                res
            );

        if (!adminAuthorized) {
            return true;
        }

        const parts =
            req.url.split('/');

        const loanId =
            parts[4];

        return loanController
            .disburse(
                req,
                res,
                loanId
            );
    }




    // APPROVE / REJECT LOAN


    if (
        req.method === 'PATCH' &&
        req.url.startsWith(
            '/api/v1/loans/'
        )
    ) {

        const adminAuthorized =
            await requireAdmin(
                req,
                res
            );

        if (!adminAuthorized) {
            return true;
        }

        const loanId =
            req.url
                .split('/')
                .pop();

        return loanController
            .updateStatus(
                req,
                res,
                body,
                loanId
            );
    }

    return false;
}

module.exports =
    loanRoutes;