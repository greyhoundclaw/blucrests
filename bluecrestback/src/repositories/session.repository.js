const db = require('../database/db');

async function createSession(sessionData) {

    await db.query(
        `
        INSERT INTO sessions (
            user_id,
            token,
            expires_at
        )
        VALUES (?, ?, ?)
        `,
        [
            sessionData.user_id,
            sessionData.token,
            sessionData.expires_at
        ]
    );
}

async function findSessionByToken(token) {

    const sessions = await db.query(
        `
        SELECT * FROM sessions
        WHERE token = ?
        `,
        [token]
    );

    return sessions[0];
}

async function deleteSession(token) {

    await db.query(
        `
        DELETE FROM sessions
        WHERE token = ?
        `,
        [token]
    );
}

module.exports = {
    createSession,
    findSessionByToken,
    deleteSession
};