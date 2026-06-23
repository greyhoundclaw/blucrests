const db = require('../database/db');

async function createActivity(data) {

    await db.query(
        `
        INSERT INTO activities (
            user_id,
            type,
            description
        )
        VALUES (?, ?, ?)
        `,
        [
            data.user_id,
            data.type,
            data.description
        ]
    );
}

async function getActivities() {

    return await db.query(`
        SELECT * FROM activities
        ORDER BY id DESC
    `);
}

module.exports = {
    createActivity,
    getActivities
};