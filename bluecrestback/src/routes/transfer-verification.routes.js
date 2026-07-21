const { requireAuth } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/admin.middleware');
const { successResponse, errorResponse } = require('../utils/response');
const service = require('../services/transfer-verification.service');

async function transferVerificationRoutes(req, res, body) {
    try {
        if (req.url === '/api/v1/transfer-verification/verify-pin' && req.method === 'POST') {
            if (!await requireAuth(req, res)) return true;
            return successResponse(res, await service.verifyPin(req.user, body.pin), 'Transfer PIN verified');
        }
        if (req.url === '/api/v1/transfer-verification/verify' && req.method === 'POST') {
            if (!await requireAuth(req, res)) return true;
            return successResponse(res, await service.verify(
                req.user, body.code, req.headers['x-forwarded-for'] || req.socket?.remoteAddress
            ), 'Transfer verification successful');
        }
        if (req.url === '/api/v1/admin/transfer-verification/codes' && req.method === 'GET') {
            if (!await requireAdmin(req, res)) return true;
            return successResponse(res, await service.listCodes(), 'Verification codes fetched');
        }
        if (req.url === '/api/v1/admin/transfer-verification/codes' && req.method === 'POST') {
            if (!await requireAdmin(req, res)) return true;
            return successResponse(res, await service.assign(req.user, body), 'Verification code assigned', 201);
        }
        if (/^\/api\/v1\/admin\/transfer-verification\/codes\/\d+$/.test(req.url) && req.method === 'DELETE') {
            if (!await requireAdmin(req, res)) return true;
            return successResponse(res, await service.revoke(req.url.split('/').pop()), 'Verification code revoked');
        }
        if (req.url === '/api/v1/admin/transfer-verification/attempts' && req.method === 'GET') {
            if (!await requireAdmin(req, res)) return true;
            return successResponse(res, await service.listAttempts(), 'Verification attempts fetched');
        }
        if (/^\/api\/v1\/admin\/transfer-verification\/codes\/\d+\/transfers$/.test(req.url) && req.method === 'GET') {
            if (!await requireAdmin(req, res)) return true;
            return successResponse(res, await service.transferHistory(req.url.split('/')[6]), 'Associated transfers fetched');
        }
    } catch (error) {
        return errorResponse(res, error.message, error.code === 'NO_CODE' ? 409 : 400);
    }
    return false;
}

module.exports = transferVerificationRoutes;
