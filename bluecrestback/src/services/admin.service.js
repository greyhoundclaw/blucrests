const userRepository =
    require('../repositories/user.repository');

const transferRepository =
    require('../repositories/transfer.repository');

const activityRepository =
    require('../repositories/activity.repository');

async function getDashboardStats() {

    const users =
        await userRepository.getAllUsers();
    const transfers =
        await transferRepository.getTransfers();

    const activities =
        await activityRepository.getActivities();

    return {
        total_users: users.length,

        total_transfers:
            transfers.length,

        pending_transfers:
            transfers.filter(
                t => t.status === 'PENDING'
            ).length,

        completed_transfers:
            transfers.filter(
                t => t.status === 'COMPLETED'
            ).length,

        total_activities:
            activities.length,

        total_balance:
            users.reduce(
                (sum, user) =>
                    sum + Number(user.balance || 0),
                0
            )
    };
}

module.exports = {
    getDashboardStats
};