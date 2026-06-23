const { requireAuth } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/admin.middleware');
const { successResponse, errorResponse } = require('../utils/response');
const service = require('../services/withdrawal.service');

async function withdrawalRoutes(req, res, body) {
    try {
        if (req.url === '/api/v1/withdrawal-destinations' && req.method === 'GET') {
            if (!await requireAuth(req, res)) return true;
            return successResponse(res, await service.listDestinations(req.user.id), 'Destinations fetched');
        }
        if (req.url === '/api/v1/withdrawal-destinations' && req.method === 'POST') {
            if (!await requireAuth(req, res)) return true;
            return successResponse(res, await service.saveDestination(req.user, body), 'Destination saved', 201);
        }
        if (/^\/api\/v1\/withdrawal-destinations\/\d+$/.test(req.url) && req.method === 'PUT') {
            if (!await requireAuth(req, res)) return true;
            const id = req.url.split('/').pop();
            return successResponse(res, await service.saveDestination(req.user, body, id), 'Destination updated');
        }
        if (/^\/api\/v1\/withdrawal-destinations\/\d+$/.test(req.url) && req.method === 'DELETE') {
            if (!await requireAuth(req, res)) return true;
            const id = req.url.split('/').pop();
            await service.deleteDestination(id, req.user.id);
            return successResponse(res, null, 'Destination deleted');
        }
        if (req.url === '/api/v1/withdrawals' && req.method === 'POST') {
            if (!await requireAuth(req, res)) return true;
            return successResponse(res, await service.requestWithdrawal(req.user, body), 'Withdrawal submitted', 201);
        }
        if (req.url === '/api/v1/withdrawals' && req.method === 'GET') {
            if (!await requireAuth(req, res)) return true;
            return successResponse(res, await service.listRequests(req.user.id), 'Withdrawals fetched');
        }
        if (req.url === '/api/v1/admin/withdrawals' && req.method === 'GET') {
            if (!await requireAdmin(req, res)) return true;
            return successResponse(res, await service.listAllRequests(), 'Withdrawals fetched');
        }
        if (/^\/api\/v1\/admin\/withdrawals\/\d+$/.test(req.url) && req.method === 'PATCH') {
            if (!await requireAdmin(req, res)) return true;
            const id = req.url.split('/').pop();
            return successResponse(res, await service.updateStatus(req.user, id, body.status), 'Withdrawal updated');
        }
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
    return false;
}

module.exports = withdrawalRoutes;
