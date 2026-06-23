const { requireAuth } = require('../middleware/auth.middleware');
const { successResponse, errorResponse } = require('../utils/response');
const service = require('../services/withdrawal-account.service');

async function withdrawalAccountRoutes(req, res, body) {
    try {
        if (req.url === '/api/v1/withdrawal-methods/link' && req.method === 'POST') {
            if (!await requireAuth(req, res)) return true;
            return successResponse(res, await service.link(req.user, body), 'Withdrawal account linked', 201);
        }
        if (req.url === '/api/v1/withdrawal-methods' && req.method === 'GET') {
            if (!await requireAuth(req, res)) return true;
            return successResponse(res, await service.list(req.user.id), 'Linked accounts fetched');
        }
        if (/^\/api\/v1\/withdrawal-methods\/\d+$/.test(req.url) && req.method === 'DELETE') {
            if (!await requireAuth(req, res)) return true;
            await service.unlink(req.user.id, req.url.split('/').pop());
            return successResponse(res, null, 'Withdrawal account removed');
        }
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
    return false;
}

module.exports = withdrawalAccountRoutes;
