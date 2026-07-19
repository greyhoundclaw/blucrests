const { requireAdmin } = require('../middleware/admin.middleware');
const { successResponse, errorResponse } = require('../utils/response');
const emailService = require('../services/email.service');

async function emailRoutes(req, res, body) {
    if (!req.url.startsWith('/api/v1/admin/email')) return false;
    if (!await requireAdmin(req, res)) return true;
    try {
        if (req.method === 'GET' && req.url === '/api/v1/admin/email/settings') {
            return successResponse(res, await emailService.getSettings(), 'Email settings fetched');
        }
        if (req.method === 'PUT' && req.url === '/api/v1/admin/email/settings') {
            return successResponse(res, await emailService.saveSettings(req.user, body), 'Email settings saved');
        }
        if (req.method === 'POST' && req.url === '/api/v1/admin/email/test') {
            return successResponse(res, await emailService.verifySettings(), 'Email provider connection verified');
        }
        if (req.method === 'POST' && req.url === '/api/v1/admin/email/send') {
            return successResponse(res, await emailService.sendAdminEmail(req.user, body), 'Email delivery completed', 201);
        }
        if (req.method === 'GET' && req.url === '/api/v1/admin/email/logs') {
            return successResponse(res, await emailService.getLogs(), 'Email logs fetched');
        }
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
    return false;
}

module.exports = emailRoutes;
