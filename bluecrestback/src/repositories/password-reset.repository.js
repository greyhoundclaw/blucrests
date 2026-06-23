const db = require('../database/db');

async function create(data) {
    await db.query(`UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL`, [data.user_id]);
    await db.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`,
        [data.user_id, data.token_hash, data.expires_at]
    );
}

async function activeForUser(userId) {
    const rows = await db.query(
        `SELECT * FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL ORDER BY id DESC`,
        [userId]
    );
    return rows[0];
}

async function consume(id) {
    await db.query(`UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
}

module.exports = { create, activeForUser, consume };
