const db = require('../database/db');

async function getDestination(id) {
    const rows = await db.query(`SELECT * FROM withdrawal_destinations WHERE id = ?`, [id]);
    return rows[0];
}

async function listDestinations(userId) {
    return db.query(
        `SELECT * FROM withdrawal_destinations WHERE user_id = ? ORDER BY is_preferred DESC, id DESC`,
        [userId]
    );
}

async function createDestination(data) {
    if (data.is_preferred) {
        await db.query(`UPDATE withdrawal_destinations SET is_preferred = 0 WHERE user_id = ?`, [data.user_id]);
    }
    const sql = db.USE_POSTGRES
        ? `INSERT INTO withdrawal_destinations (user_id, method, label, details_json, is_preferred)
           VALUES (?, ?, ?, ?, ?) RETURNING *`
        : `INSERT INTO withdrawal_destinations (user_id, method, label, details_json, is_preferred)
           VALUES (?, ?, ?, ?, ?)`;
    const result = await db.query(sql, [
        data.user_id, data.method, data.label, data.details_json, data.is_preferred ? 1 : 0
    ]);
    if (db.USE_POSTGRES) return result[0];
    const inserted = await db.query(`SELECT last_insert_rowid() AS id`);
    return getDestination(inserted[0].id);
}

async function updateDestination(id, userId, data) {
    if (data.is_preferred) {
        await db.query(`UPDATE withdrawal_destinations SET is_preferred = 0 WHERE user_id = ?`, [userId]);
    }
    await db.query(
        `UPDATE withdrawal_destinations SET method = ?, label = ?, details_json = ?,
         is_preferred = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
        [data.method, data.label, data.details_json, data.is_preferred ? 1 : 0, id, userId]
    );
    return getDestination(id);
}

async function deleteDestination(id, userId) {
    return db.query(`DELETE FROM withdrawal_destinations WHERE id = ? AND user_id = ?`, [id, userId]);
}

async function createRequest(data) {
    const sql = db.USE_POSTGRES
        ? `INSERT INTO withdrawal_requests (user_id, destination_id, method, amount, currency,
           destination_snapshot_json, status, reference, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
        : `INSERT INTO withdrawal_requests (user_id, destination_id, method, amount, currency,
           destination_snapshot_json, status, reference, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const result = await db.query(sql, [
        data.user_id, data.destination_id, data.method, data.amount, data.currency,
        data.destination_snapshot_json, 'PENDING', data.reference, data.note || null
    ]);
    if (db.USE_POSTGRES) return result[0];
    const inserted = await db.query(`SELECT last_insert_rowid() AS id`);
    const rows = await db.query(`SELECT * FROM withdrawal_requests WHERE id = ?`, [inserted[0].id]);
    return rows[0];
}

async function listRequests(userId) {
    return db.query(`SELECT * FROM withdrawal_requests WHERE user_id = ? ORDER BY id DESC`, [userId]);
}

async function listAllRequests() {
    return db.query(`SELECT * FROM withdrawal_requests ORDER BY id DESC`);
}

async function getRequest(id) {
    const rows = await db.query(`SELECT * FROM withdrawal_requests WHERE id = ?`, [id]);
    return rows[0];
}

async function updateRequestStatus(id, status, adminId) {
    await db.query(
        `UPDATE withdrawal_requests SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, adminId, id]
    );
    const rows = await db.query(`SELECT * FROM withdrawal_requests WHERE id = ?`, [id]);
    return rows[0];
}

module.exports = {
    getDestination, listDestinations, createDestination, updateDestination,
    deleteDestination, createRequest, listRequests, listAllRequests, updateRequestStatus
    , getRequest
};
