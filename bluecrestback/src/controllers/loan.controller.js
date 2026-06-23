const loanService =
    require('../services/loan.service');

const {
    successResponse,
    errorResponse
} = require('../utils/response');

async function create(
    req,
    res,
    body
) {

    try {

        const loan =
            await loanService
                .createLoan(
                    req.user,
                    body
                );

        return successResponse(
            res,
            loan,
            'Loan application submitted successfully',
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

        const loans =
            await loanService
                .fetchLoans();

        return successResponse(
            res,
            loans,
            'Loans fetched successfully'
        );

    } catch (error) {

        return errorResponse(
            res,
            error.message,
            500
        );
    }
}

async function getUserLoans(
    req,
    res,
    userId
) {

    try {

        const loans =
            await loanService
                .fetchUserLoans(
                    userId
                );

        return successResponse(
            res,
            loans,
            'User loans fetched successfully'
        );

    } catch (error) {

        return errorResponse(
            res,
            error.message,
            500
        );
    }
}

async function updateStatus(
    req,
    res,
    body,
    loanId
) {

    try {

        const loan =
            await loanService
                .changeLoanStatus(
                    loanId,
                    body.status,
                    req.user.id
                );

        return successResponse(
            res,
            loan,
            'Loan status updated successfully'
        );

    } catch (error) {

        return errorResponse(
            res,
            error.message,
            500
        );
    }
}


async function assignFee(
    req,
    res,
    body,
    loanId
) {

    try {

        const loan =
            await loanService
                .assignLoanFee(
                    loanId,
                    body.disbursement_fee
                );

        return successResponse(
            res,
            loan,
            'Loan fee assigned successfully'
        );

    } catch (error) {

        return errorResponse(
            res,
            error.message,
            500
        );
    }
}

async function confirmFee(
    req,
    res,
    loanId
) {

    try {

        const loan =
            await loanService
                .confirmLoanFee(
                    loanId
                );

        return successResponse(
            res,
            loan,
            'Loan fee confirmed successfully'
        );

    } catch (error) {

        return errorResponse(
            res,
            error.message,
            500
        );
    }
}

async function disburse(
    req,
    res,
    loanId
) {

    try {

        const loan =
            await loanService
                .disburseLoan(
                    loanId,
                    req.user.id
                );

        return successResponse(
            res,
            loan,
            'Loan disbursed successfully'
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
    getUserLoans,
    updateStatus,
    assignFee,
    confirmFee,
    disburse
};