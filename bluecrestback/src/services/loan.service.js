const loanRepository =
    require('../repositories/loan.repository');


const ledgerService =
    require('./ledger.service');

const db =
    require('../database/db');

async function createLoan(
    user,
    data
) {

    if (
        user.kyc_status !== 'VERIFIED'
    ) {

        throw new Error(
            'KYC verification required before applying for a loan'
        );
    }

    return await loanRepository
        .createLoan({

            user_id:
                user.id,

            requested_amount:
                data.requested_amount,

            purpose:
                data.purpose,

            interest_rate:
                data.interest_rate || 0,

            repayment_months:
                data.repayment_months || 12,

            monthly_payment:
                data.monthly_payment || 0,

            status:
                'PENDING'
        });
}

async function fetchLoans() {

    return await loanRepository
        .getLoans();
}

async function fetchUserLoans(
    userId
) {

    return await loanRepository
        .getLoansByUser(
            userId
        );
}

async function changeLoanStatus(
    loanId,
    status,
    adminId
) {

    return await loanRepository
        .updateLoanStatus(
            loanId,
            status,
            adminId
        );
}



async function assignLoanFee(
    loanId,
    feeAmount
) {

    return await loanRepository
        .updateLoanFee(
            loanId,
            feeAmount
        );
}



async function confirmLoanFee(
    loanId
) {

    return await loanRepository
        .confirmLoanFee(
            loanId
        );
}


async function disburseLoan(
    loanId,
    adminId
) {

    return await db.withTransaction(async () => {
        const loan =
            await loanRepository
                .getLoanById(
                    loanId
                );

        if (!loan) {

            throw new Error(
                'Loan not found'
            );
        }

        if (loan.status === 'DISBURSED') {
            return loan;
        }

        if (
            loan.status !==
            'READY_FOR_DISBURSEMENT'
        ) {

            throw new Error(
                'Loan is not ready for disbursement'
            );
        }

        await ledgerService
            .postEntry({

                user_id:
                    loan.user_id,

                reference:
                    `TXN-LOAN-${loan.id}-DISBURSEMENT`,

                type:
                    'CREDIT',

                category:
                    'loan_disbursement',

                amount:
                    loan.requested_amount,

                description:
                    `Loan Disbursement (#${loan.id})`,

                created_by:
                    adminId
            });

        return await loanRepository
            .updateLoanStatus(
                loanId,
                'DISBURSED',
                adminId
            );
    });
}




module.exports = {
    createLoan,
    fetchLoans,
    fetchUserLoans,
    changeLoanStatus,

    assignLoanFee,
    confirmLoanFee,
    disburseLoan
};
