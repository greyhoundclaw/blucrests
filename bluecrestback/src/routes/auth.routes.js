const authController =
    require('../controllers/auth.controller');
const { requireAdmin } = require('../middleware/admin.middleware');

async function authRoutes(req, res, body) {

    if (
        req.method === 'POST' &&
        req.url === '/api/v1/auth/login'
    ) {
        return authController.login(req, res, body);
    }

    if (req.method === 'POST' && req.url === '/api/v1/auth/login-code') {
        return authController.completeLoginCode(req, res, body);
    }

    if (req.method === 'POST' && req.url === '/api/v1/auth/forgot-password') {
        return authController.forgotPassword(req, res, body);
    }

    if (req.method === 'POST' && req.url === '/api/v1/auth/reset-password') {
        return authController.resetPassword(req, res, body);
    }

    if (req.method === 'POST' && req.url === '/api/v1/auth/change-password') {
        return authController.changePassword(req, res, body);
    }

    if (req.method === 'POST' && /^\/api\/v1\/admin\/users\/\d+\/reset-password$/.test(req.url)) {
        if (!await requireAdmin(req, res)) return true;
        return authController.adminResetPassword(req, res, body, req.url.split('/')[5]);
    }

    if (
        req.method === 'GET' &&
        req.url === '/api/v1/auth/me'
    ) {
        return authController.me(req, res);
    }

    if (
        req.method === 'POST' &&
        req.url === '/api/v1/auth/logout'
    ) {
        return authController.logout(req, res);
    }

    return false;
}

module.exports = authRoutes;
