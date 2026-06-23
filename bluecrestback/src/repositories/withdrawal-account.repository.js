const db = require('../database/db');

async function list(userId) {
    return db.query(
        `SELECT * FROM withdrawal_accounts WHERE user_id = ? AND linked = 1 ORDER BY id DESC`,
        [userId]
    );
}

async function find(id, userId) {
    const rows = await db.query(
        `SELECT * FROM withdrawal_accounts WHERE id = ? AND user_id = ?`,
        [id, userId]
    );
    return rows[0];
}

async function upsert(data) {
    const existing = await db.query(
        `SELECT * FROM withdrawal_accounts WHERE user_id = ? AND method = ? AND username = ?`,
        [data.user_id, data.method, data.username]
    );
    if (existing[0]) {
        await db.query(
            `UPDATE withdrawal_accounts SET display_name = ?, details_json = ?, destination_id = ?,
             linked = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [data.display_name, data.details_json, data.destination_id, existing[0].id]
        );
        return find(existing[0].id, data.user_id);
    }
    const sql = db.USE_POSTGRES
        ? `INSERT INTO withdrawal_accounts (user_id, method, username, display_name, details_json, destination_id)
           VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
        : `INSERT INTO withdrawal_accounts (user_id, method, username, display_name, details_json, destination_id)
           VALUES (?, ?, ?, ?, ?, ?)`;
    const result = await db.query(sql, [
        data.user_id, data.method, data.username, data.display_name,
        data.details_json, data.destination_id
    ]);
    if (db.USE_POSTGRES) return result[0];
    const inserted = await db.query(`SELECT last_insert_rowid() AS id`);
    return find(inserted[0].id, data.user_id);
}

async function unlink(id, userId) {
    await db.query(
        `UPDATE withdrawal_accounts SET linked = 0, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`,
        [id, userId]
    );
}

module.exports = { list, find, upsert, unlink };
