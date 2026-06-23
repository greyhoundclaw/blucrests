const db = require('../database/db');

async function getSettings() {
    const rows = await db.query(`SELECT * FROM email_settings WHERE id = 1`);
    return rows[0] || null;
}

async function saveSettings(data) {
    const existing = await getSettings();
    if (existing) {
        await db.query(
            `UPDATE email_settings SET smtp_host = ?, smtp_port = ?, smtp_username = ?,
             smtp_password_encrypted = ?, smtp_secure = ?, sender_email = ?, sender_name = ?,
             updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
            [data.smtp_host, data.smtp_port, data.smtp_username, data.smtp_password_encrypted,
             data.smtp_secure ? 1 : 0, data.sender_email, data.sender_name, data.updated_by]
        );
    } else {
        await db.query(
            `INSERT INTO email_settings (id, smtp_host, smtp_port, smtp_username,
             smtp_password_encrypted, smtp_secure, sender_email, sender_name, updated_by)
             VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.smtp_host, data.smtp_port, data.smtp_username, data.smtp_password_encrypted,
             data.smtp_secure ? 1 : 0, data.sender_email, data.sender_name, data.updated_by]
        );
    }
    return getSettings();
}

async function createLog(data) {
    const sql = db.USE_POSTGRES
        ? `INSERT INTO email_logs (recipient_user_id, recipient_email, subject, status, sent_by)
           VALUES (?, ?, ?, ?, ?) RETURNING *`
        : `INSERT INTO email_logs (recipient_user_id, recipient_email, subject, status, sent_by)
           VALUES (?, ?, ?, ?, ?)`;
    const result = await db.query(sql, [
        data.recipient_user_id || null, data.recipient_email, data.subject, 'QUEUED', data.sent_by
    ]);
    if (db.USE_POSTGRES) return result[0];
    const inserted = await db.query(`SELECT last_insert_rowid() AS id`);
    const rows = await db.query(`SELECT * FROM email_logs WHERE id = ?`, [inserted[0].id]);
    return rows[0];
}

async function updateLog(id, data) {
    await db.query(
        `UPDATE email_logs SET status = ?, provider_message_id = ?, error_message = ?,
         sent_at = CASE WHEN ? = 'SENT' THEN CURRENT_TIMESTAMP ELSE sent_at END WHERE id = ?`,
        [data.status, data.provider_message_id || null, data.error_message || null, data.status, id]
    );
}

async function getLogs() {
    return db.query(`SELECT * FROM email_logs ORDER BY id DESC`);
}

module.exports = { getSettings, saveSettings, createLog, updateLog, getLogs };
