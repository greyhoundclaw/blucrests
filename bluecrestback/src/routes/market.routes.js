const marketService = require('../services/market.service');
const {
    successResponse,
    errorResponse
} = require('../utils/response');

async function marketRoutes(req, res) {
    if (
        req.method !== 'GET' ||
        !req.url.startsWith('/api/v1/market')
    ) {
        return false;
    }

    const requestUrl = new URL(req.url, 'http://localhost');
    const currency = (
        requestUrl.searchParams.get('currency') || 'USD'
    ).toUpperCase();

    if (!/^[A-Z]{3}$/.test(currency)) {
        return errorResponse(
            res,
            'A valid three-letter currency code is required',
            400
        );
    }

    try {
        const snapshot =
            await marketService.getMarketSnapshot(currency);

        return successResponse(
            res,
            snapshot,
            'Market prices fetched successfully'
        );
    } catch (error) {
        console.error('Market price fetch failed:', error.message);

        return errorResponse(
            res,
            'Live market prices are temporarily unavailable',
            503
        );
    }
}

module.exports = marketRoutes;
