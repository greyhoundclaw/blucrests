const authService =
    require('../services/auth.service');

const {
    successResponse,
    errorResponse
} = require('../utils/response');

async function login(req, res, body) {

    try {

        const result =
            await authService.login(
                body.email,
                body.password
            );

        return successResponse(
            res,
            result,
            'Login successful'
        );

    } catch (error) {

        return errorResponse(
            res,
            error.message,
            401
        );
    }
}

async function me(req, res) {

    try {

        const authHeader =
            req.headers['authorization'];

        const token =
            authHeader.replace('Bearer ', '');

        const user =
            await authService.getCurrentUser(token);

        return successResponse(
            res,
            user,
            'Current user fetched'
        );

    } catch (error) {

        return errorResponse(
            res,
            error.message,
            401
        );
    }
}

async function logout(req, res) {

    try {

        const authHeader =
            req.headers['authorization'];

        const token =
            authHeader.replace('Bearer ', '');

        await authService.logout(token);

        return successResponse(
            res,
            null,
            'Logout successful'
        );

    } catch (error) {

        return errorResponse(
            res,
            error.message,
            400
        );
    }
}

async function completeLoginCode(req, res, body) {
    try {
        return successResponse(res, await authService.completeLoginCode(body), 'Login code verified');
    } catch (error) {
        return errorResponse(res, error.message, 401);
    }
}

async function forgotPassword(req, res, body) {
    try {
        return successResponse(res, await authService.requestPasswordReset(body.email), 'Password reset requested');
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
}

async function resetPassword(req, res, body) {
    try {
        return successResponse(res, await authService.resetPassword(body), 'Password reset successfully');
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
}

async function changePassword(req, res, body) {
    try {
        const { requireAuth } = require('../middleware/auth.middleware');
        if (!await requireAuth(req, res)) return true;
        return successResponse(res, await authService.changePassword(req.user, body), 'Password changed successfully');
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
}

async function adminResetPassword(req, res, body, userId) {
    try {
        return successResponse(res, await authService.adminResetPassword(userId, body), 'Temporary password created');
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
}

module.exports = {
    login,
    completeLoginCode,
    me,
    logout
    ,forgotPassword
    ,resetPassword
    ,changePassword
    ,adminResetPassword
};
