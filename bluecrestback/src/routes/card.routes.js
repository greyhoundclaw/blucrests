const cardController = require('../controllers/card.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/admin.middleware');

async function cardRoutes(req, res, body) {
    if (req.method === 'POST' && req.url === '/api/v1/cards/apply') {
        if (!await requireAuth(req, res)) return true;
        return cardController.apply(req, res, body);
    }

    if (req.method === 'GET' && req.url === '/api/v1/cards/me') {
        if (!await requireAuth(req, res)) return true;
        return cardController.mine(req, res);
    }

    if (req.method === 'GET' && req.url === '/api/v1/cards/payment-instructions') {
        if (!await requireAuth(req, res)) return true;

        const { successResponse } = require('../utils/response');
        return successResponse(res, {
            bitcoin_address: String(process.env.BITCOIN_PAYMENT_ADDRESS || '').trim()
        }, 'Card payment instructions fetched successfully');
    }

    if (req.method === 'GET' && req.url === '/api/v1/cards') {
        if (!await requireAdmin(req, res)) return true;
        return cardController.all(req, res);
    }

    const match = req.url.match(/^\/api\/v1\/cards\/(\d+)\/(approve|reject|confirm-payment|release)$/);
    if (req.method === 'PATCH' && match) {
        if (!await requireAdmin(req, res)) return true;
        const [, cardId, action] = match;
        if (action === 'approve') return cardController.approve(req, res, body, cardId);
        if (action === 'reject') return cardController.reject(req, res, cardId);
        if (action === 'confirm-payment') return cardController.confirmPayment(req, res, cardId);
        if (action === 'release') return cardController.release(req, res, cardId);
    }

    const referenceMatch = req.url.match(/^\/api\/v1\/cards\/(\d+)\/txn-reference$/);
    if (req.method === 'POST' && referenceMatch) {
        if (!await requireAuth(req, res)) return true;
        return cardController.submitTxnReference(
            req,
            res,
            body,
            referenceMatch[1]
        );
    }

    return false;
}

module.exports = cardRoutes;
