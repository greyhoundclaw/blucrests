const activityRepository =
    require('../repositories/activity.repository');

async function logActivity(data) {

    return await activityRepository
        .createActivity(data);
}

async function fetchActivities() {

    return await activityRepository
        .getActivities();
}

module.exports = {
    logActivity,
    fetchActivities
};