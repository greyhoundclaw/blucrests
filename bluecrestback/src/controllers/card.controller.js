const cardService = require('../services/card.service');
const { successResponse, errorResponse } = require('../utils/response');

async function apply(req, res, body) {
    try {
        return successResponse(
            res,
            await cardService.apply(req.user, body),
            'Card application submitted successfully',
            201
        );
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
}

async function mine(req, res) {
    try {
        return successResponse(res, await cardService.fetchMine(req.user.id), 'Cards fetched successfully');
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
}

async function all(req, res) {
    try {
        return successResponse(res, await cardService.fetchAll(), 'Card applications fetched successfully');
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
}

async function approve(req, res, body, cardId) {
    try {
        return successResponse(
            res,
            await cardService.approve(cardId, req.user.id),
            'Card application approved'
        );
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
}

async function submitTxnReference(req, res, body, cardId) {
    try {
        return successResponse(
            res,
            await cardService.submitTxnReference(cardId, req.user, body),
            'Transaction reference submitted for admin verification'
        );
    } catch (error) {
        const status = error.message === 'Card application access denied'
            ? 403
            : 400;
        return errorResponse(res, error.message, status);
    }
}

async function reject(req, res, cardId) {
    try {
        return successResponse(res, await cardService.reject(cardId, req.user.id), 'Card application rejected');
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
}

async function confirmPayment(req, res, cardId) {
    try {
        return successResponse(res, await cardService.confirmPayment(cardId), 'Card payment confirmed');
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
}

async function release(req, res, cardId) {
    try {
        return successResponse(res, await cardService.release(cardId), 'Debit card released successfully');
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
}

module.exports = {
    apply,
    mine,
    all,
    approve,
    submitTxnReference,
    reject,
    confirmPayment,
    release
};
