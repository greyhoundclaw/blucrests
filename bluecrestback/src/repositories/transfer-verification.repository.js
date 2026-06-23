const db = require('../database/db');

async function getActiveForUser(userId) {
    const rows = await db.query(
        `SELECT * FROM transfer_verification_codes WHERE user_id = ? AND status = 'ACTIVE' ORDER BY id DESC`,
        [userId]
    );
    return rows[0];
}

async function getCode(id) {
    const rows = await db.query(`SELECT * FROM transfer_verification_codes WHERE id = ?`, [id]);
    return rows[0];
}

async function createCode(data) {
    await db.query(
        `UPDATE transfer_verification_codes SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND status = 'ACTIVE'`,
        [data.user_id]
    );
    const sql = db.USE_POSTGRES
        ? `INSERT INTO transfer_verification_codes (user_id, code_hash, code_last_four, status, created_by)
           VALUES (?, ?, ?, 'ACTIVE', ?) RETURNING *`
        : `INSERT INTO transfer_verification_codes (user_id, code_hash, code_last_four, status, created_by)
           VALUES (?, ?, ?, 'ACTIVE', ?)`;
    const result = await db.query(sql, [
        data.user_id, data.code_hash, data.code_last_four, data.created_by
    ]);
    if (db.USE_POSTGRES) return result[0];
    const inserted = await db.query(`SELECT last_insert_rowid() AS id`);
    return getCode(inserted[0].id);
}

async function revoke(id) {
    await db.query(
        `UPDATE transfer_verification_codes SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [id]
    );
    return getCode(id);
}

async function listCodes() {
    return db.query(
        `SELECT c.id, c.user_id, c.code_last_four, c.status, c.created_by, c.created_at,
         c.updated_at, c.revoked_at, u.first_name, u.last_name, u.email
         FROM transfer_verification_codes c JOIN users u ON u.id = c.user_id ORDER BY c.id DESC`
    );
}

async function logAttempt(data) {
    await db.query(
        `INSERT INTO transfer_verification_attempts (user_id, code_id, success, ip_address)
         VALUES (?, ?, ?, ?)`,
        [data.user_id, data.code_id || null, data.success ? 1 : 0, data.ip_address || null]
    );
}

async function listAttempts() {
    return db.query(
        `SELECT a.*, u.first_name, u.last_name, u.email, c.code_last_four
         FROM transfer_verification_attempts a JOIN users u ON u.id = a.user_id
         LEFT JOIN transfer_verification_codes c ON c.id = a.code_id ORDER BY a.id DESC`
    );
}

async function createSession(data) {
    await db.query(
        `INSERT INTO transfer_verification_sessions (user_id, code_id, token, expires_at)
         VALUES (?, ?, ?, ?)`,
        [data.user_id, data.code_id, data.token, data.expires_at]
    );
}

async function consumeSession(token, userId) {
    const rows = await db.query(
        `SELECT * FROM transfer_verification_sessions WHERE token = ? AND user_id = ? AND used_at IS NULL`,
        [token, userId]
    );
    const session = rows[0];
    if (!session || new Date(session.expires_at).getTime() <= Date.now()) return null;
    await db.query(`UPDATE transfer_verification_sessions SET used_at = CURRENT_TIMESTAMP WHERE id = ?`, [session.id]);
    return session;
}

async function transferHistory(codeId) {
    return db.query(`SELECT * FROM transfers WHERE verification_code_id = ? ORDER BY id DESC`, [codeId]);
}

module.exports = {
    getActiveForUser, createCode, revoke, listCodes, logAttempt, listAttempts,
    createSession, consumeSession, transferHistory
};
