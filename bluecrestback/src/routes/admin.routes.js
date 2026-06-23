const {
    requireAdmin
} = require('../middleware/admin.middleware');

const userService =
    require('../services/user.service');

const transferService =
    require('../services/transfer.service');

const activityService =
    require('../services/activity.service');

const adminService =
    require('../services/admin.service');

const {
    successResponse,
    errorResponse
} = require('../utils/response');

async function adminRoutes(req, res) {

    const adminEndpoints = [
        '/api/v1/admin/users',
        '/api/v1/admin/transfers',
        '/api/v1/admin/activities',
        '/api/v1/admin/stats'
    ];

    if (!adminEndpoints.includes(req.url)) {
        return false;
    }

    const authorized =
        await requireAdmin(req, res);

    if (!authorized) {
        return true;
    }

    try {

        if (req.url === '/api/v1/admin/users') {

            const users =
                await userService.fetchUsers();

            return successResponse(
                res,
                users,
                'Admin users fetched'
            );
        }

        if (req.url === '/api/v1/admin/transfers') {

            const transfers =
                await transferService.fetchTransfers();

            return successResponse(
                res,
                transfers,
                'Admin transfers fetched'
            );
        }

        if (req.url === '/api/v1/admin/activities') {

            const activities =
                await activityService.fetchActivities();

            return successResponse(
                res,
                activities,
                'Admin activities fetched'
            );
        }

        if (req.url === '/api/v1/admin/stats') {

            const stats =
                await adminService
                    .getDashboardStats();

            return successResponse(
                res,
                stats,
                'Dashboard statistics fetched'
            );
        }

    } catch (error) {

        console.log(error);

        return errorResponse(
            res,
            error.message
        );
    }

    return false;
}

module.exports = adminRoutes;