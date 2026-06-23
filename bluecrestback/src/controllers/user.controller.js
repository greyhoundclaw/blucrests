const activityService =
    require('../services/activity.service');

const {
    validateRegisterInput
} = require('../validation/user.validation');

const userService =
    require('../services/user.service');

const {
    successResponse,
    errorResponse
} = require('../utils/response');

async function register(req, res, body) {

    try {

        const validation =
            validateRegisterInput(body);

        if (!validation.valid) {

            return errorResponse(
                res,
                validation.errors.join(', '),
                400
            );
        }

        const user =
            await userService.registerUser(body);

        await activityService.logActivity({
            user_id: user.id,
            type: 'USER_REGISTERED',
            description:
                `${user.first_name} ${user.last_name} registered`
        });

        return successResponse(
            res,
            user,
            'User registered successfully',
            201
        );

    } catch (error) {

        return errorResponse(
            res,
            error.message,
            400
        );
    }
}

async function getUsers(req, res) {

    try {

        const users =
            await userService.fetchUsers();

        return successResponse(
            res,
            users,
            'Users fetched successfully'
        );

    } catch (error) {

        return errorResponse(
            res,
            error.message
        );
    }
}

async function updateBalance(
    req,
    res,
    body,
    userId
) {

    try {

        const updatedUser =
            await userService
                .changeUserBalance(
                    userId,
                    body.balance
                );

        await activityService.logActivity({
            user_id: userId,
            type: 'BALANCE_UPDATED',
            description:
                `Balance updated to ${body.balance}`
        });

        return successResponse(
            res,
            updatedUser,
            'Balance updated successfully'
        );

    } catch (error) {

        return errorResponse(
            res,
            error.message
        );
    }
}

async function setTransferPin(
    req,
    res,
    body
) {

    try {

        const user =
            await userService
                .setTransferPin(
                    req.user.id,
                    body.pin
                );

        await activityService
            .logActivity({
                user_id: req.user.id,
                type: 'TRANSFER_PIN_SET',
                description:
                    'Transfer PIN created'
            });

        return successResponse(
            res,
            user,
            'Transfer PIN set successfully'
        );

    } catch (error) {

        return errorResponse(
            res,
            error.message,
            400
        );
    }
}

async function submitKyc(
    req,
    res,
    body
) {

    try {

        const user =
            await userService
                .submitKyc(
                    req.user.id,
                    body
                );

        return successResponse(
            res,
            user,
            'KYC submitted successfully'
        );

    } catch (error) {

        return errorResponse(
            res,
            error.message,
            500
        );
    }
}

async function updateKycStatus(
    req,
    res,
    body,
    userId
) {

    try {

        const user =
            await userService
                .updateKycStatus(
                    userId,
                    body.status
                );

        return successResponse(
            res,
            user,
            'KYC status updated successfully'
        );

    } catch (error) {

        return errorResponse(
            res,
            error.message,
            500
        );
    }
}

async function updateUserProfile(req, res, body, userId) {
    try {
        const isAdmin = req.user && (req.user.role === 'ADMIN' || req.user.role === 'Admin');
        if (!isAdmin) {
            delete body.balance;
            delete body.role;
            delete body.status;
            delete body.transfer_flow;
            delete body.transfer_pin;
        }
        const user = await userService.updateUser(userId, body);
        return successResponse(res, user, 'User profile updated successfully');
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
}

async function deleteUser(req, res, userId) {
    try {
        await userService.deleteUser(userId);
        return successResponse(res, null, 'User deleted successfully');
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
}

async function lookupUser(req, res, accountNumber) {
    try {
        if (!accountNumber) {
            return errorResponse(res, 'Account number query parameter is required', 400);
        }
        const user = await userService.lookupUserByAccountNumber(accountNumber);
        if (!user) {
            return errorResponse(res, 'Recipient account not found', 404);
        }
        return successResponse(res, user, 'Recipient account found');
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
}

module.exports = {
    register,
    getUsers,
    updateBalance,
    setTransferPin,
    submitKyc,
    updateKycStatus,
    updateUserProfile,
    deleteUser,
    lookupUser
};