const { requireAuth } = require('../middleware/auth.middleware');
const { successResponse, errorResponse } = require('../utils/response');
const service = require('../services/joint-account.service');

async function jointAccountRoutes(req, res, body) {
    if (!req.url.startsWith('/api/v1/joint-accounts')) return false;
    try {
        if (!await requireAuth(req, res)) return true;

        if (req.method === 'GET' && req.url === '/api/v1/joint-accounts') {
            return successResponse(res, await service.getDashboard(req.user.id), 'Joint accounts fetched');
        }
        if (req.method === 'POST' && req.url === '/api/v1/joint-accounts') {
            return successResponse(res, await service.openJointAccount(req.user, body), 'Joint account opened', 201);
        }
        const inviteAccount = req.url.match(/^\/api\/v1\/joint-accounts\/(\d+)\/invitations$/);
        if (inviteAccount && req.method === 'POST') {
            return successResponse(res, await service.createInvitation(Number(inviteAccount[1]), req.user, body), 'Joint owner invited', 201);
        }
        const invitation = req.url.match(/^\/api\/v1\/joint-accounts\/invitations\/(\d+)\/(accept|decline)$/);
        if (invitation && req.method === 'POST') {
            return successResponse(res, await service.respondToInvitation(Number(invitation[1]), req.user, invitation[2] === 'accept' ? 'ACCEPTED' : 'DECLINED'), `Invitation ${invitation[2]}ed`);
        }
        const leave = req.url.match(/^\/api\/v1\/joint-accounts\/(\d+)\/leave$/);
        if (leave && req.method === 'POST') {
            return successResponse(res, await service.leaveAccount(Number(leave[1]), req.user), 'You left the joint account');
        }
        const owner = req.url.match(/^\/api\/v1\/joint-accounts\/(\d+)\/owners\/(\d+)$/);
        if (owner && req.method === 'DELETE') {
            return successResponse(res, await service.removeOwner(Number(owner[1]), Number(owner[2]), req.user), 'Owner removed');
        }
        return false;
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
}

module.exports = jointAccountRoutes;
