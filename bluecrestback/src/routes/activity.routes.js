const activityService =
    require('../services/activity.service');

const {
    successResponse,
    errorResponse
} = require('../utils/response');

const {
    requireAuth
} = require('../middleware/auth.middleware');

async function activityRoutes(req, res) {

    if (
        req.method === 'GET' &&
        req.url === '/api/v1/activities'
    ) {

        console.log('STEP 1');

        const authenticated =
            await requireAuth(req, res);

        console.log('STEP 2');

        if (!authenticated) {
            return true;
        }

        console.log('STEP 3');

        const activities =
            await activityService
                .fetchActivities();

        console.log('STEP 4', activities);

        return successResponse(
            res,
            activities,
            'Activities fetched successfully'
        );
    }

    return false;
}

module.exports = activityRoutes;