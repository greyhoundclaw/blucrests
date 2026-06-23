const userRepository = require('../repositories/user.repository');
const loanRepository = require('../repositories/loan.repository');
const ledgerService = require('../services/ledger.service');
const loanService = require('../services/loan.service');
const { requireAdmin } = require('../middleware/admin.middleware');
const { successResponse, errorResponse } = require('../utils/response');

async function sandboxRoutes(req, res, body) {
    if (
        req.method === 'POST' &&
        req.url === '/api/v1/test/sandbox'
    ) {
        if (
            process.env.NODE_ENV === 'production' &&
            process.env.SANDBOX_ENABLED !== 'true'
        ) {
            return errorResponse(res, 'Route not found', 404);
        }

        const authorized = await requireAdmin(req, res);
        if (!authorized) {
            return true;
        }

        try {
            const { email, balance, kycStatus, loanId, loanStatus, transferLock } = body;

            if (!email) {
                return errorResponse(res, 'Email identifier is required for sandbox overrides', 400);
            }

            const user = await userRepository.findUserByEmail(email);
            if (!user) {
                return errorResponse(res, `User profile not found for email: ${email}`, 404);
            }

            // 1. Balance Adjustment
            if (typeof balance === 'number') {
                    await ledgerService.adjustBalanceTo(user.id, balance, {
                        category: 'sandbox_balance_adjustment',
                        description: `Sandbox balance adjusted to ${balance}`,
                        created_by: req.user.id
                });
            }

            // 2. KYC Status Override
            if (typeof kycStatus === 'string') {
                // Map frontend values to backend-friendly uppercase strings
                let mappedKyc = kycStatus.toUpperCase();
                if (mappedKyc === 'NOT SUBMITTED') mappedKyc = 'NOT_SUBMITTED';
                await userRepository.updateKycStatus(user.id, mappedKyc);
            }

            // 3. Transfer restriction simulation lock
            if (typeof transferLock === 'boolean') {
                const status = transferLock ? 'RESTRICTED' : 'COMPLETED';
                await userRepository.updateTransferFlow(user.id, status);
            }

            // 4. Loan Lifecycle State Transition
            if (loanId && loanStatus) {
                const loan = await loanRepository.getLoanById(loanId);
                if (!loan) {
                    return errorResponse(res, `Loan #${loanId} not found`, 444);
                }

                // If moving status to DISBURSED, execute atomic disbursement
                if (loanStatus === 'DISBURSED' && loan.status !== 'DISBURSED') {
                    if (loan.status !== 'READY_FOR_DISBURSEMENT') {
                        await loanRepository.confirmLoanFee(loanId);
                    }

                    await loanService.disburseLoan(loanId, req.user.id);
                } else if (loanStatus === 'AWAITING_DISBURSEMENT_FEE') {
                    // Automatically calculate a mockup administrative fee (e.g. 5% of loan amount)
                    const calculatedFee = Math.round(loan.requested_amount * 0.05);
                    await loanRepository.updateLoanFee(loanId, calculatedFee);
                } else if (loanStatus === 'READY_FOR_DISBURSEMENT') {
                    await loanRepository.confirmLoanFee(loanId);
                } else {
                    await loanRepository.updateLoanStatus(loanId, loanStatus);
                }
            }

            const updatedUser = await userRepository.findUserById(user.id);
            return successResponse(res, updatedUser, 'Developer sandbox settings applied successfully');
        } catch (err) {
            console.error('SANDBOX ERROR:', err);
            return errorResponse(res, err.message, 500);
        }
    }

    return false;
}

module.exports = sandboxRoutes;
