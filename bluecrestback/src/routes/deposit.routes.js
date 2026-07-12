const { requireAuth } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/admin.middleware');
const { successResponse, errorResponse } = require('../utils/response');
const db = require('../database/db');
const notifications = require('../repositories/notification.repository');
const BITCOIN_ADDRESS = 'bc1qdxsym4k0rfne6cd0pn6233llkh5sy4fhj7p44l';

async function depositRoutes(req, res, body) {
    try {
        if (req.url === '/api/v1/deposits' && req.method === 'POST') {
            if (!await requireAuth(req, res)) return true;
            const method = String(body.method || '').toUpperCase();
            const amount = Number(body.amount);
            const images = Array.isArray(body.images) ? body.images : [];
            if (!['GIFTCARD', 'BITCOIN'].includes(method)) throw new Error('Select a valid deposit method');
            if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a valid deposit amount');
            if (!images.length) throw new Error(method === 'BITCOIN' ? 'Payment receipt is required' : 'At least one gift card image is required');
            if (method === 'GIFTCARD' && !String(body.card_name || '').trim()) throw new Error('Card name is required');
            const sql = db.USE_POSTGRES
                ? `INSERT INTO deposit_requests (user_id, method, amount, card_name, bitcoin_address, images_json) VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
                : `INSERT INTO deposit_requests (user_id, method, amount, card_name, bitcoin_address, images_json) VALUES (?, ?, ?, ?, ?, ?)`;
            const result = await db.query(sql, [req.user.id, method, amount, body.card_name || null, method === 'BITCOIN' ? BITCOIN_ADDRESS : null, JSON.stringify(images)]);
            const deposit = db.USE_POSTGRES ? result[0] : (await db.query(`SELECT * FROM deposit_requests WHERE id = (SELECT MAX(id) FROM deposit_requests)`))[0];
            await notifications.createNotification({ user_id: req.user.id, title: 'Deposit request received', message: `Your ${method === 'GIFTCARD' ? 'gift card' : 'Bitcoin'} deposit is pending review.`, type: 'INFO', action_link: '/deposit' });
            return successResponse(res, deposit, 'Deposit submitted', 201);
        }
        if (req.url === '/api/v1/deposits' && req.method === 'GET') {
            if (!await requireAuth(req, res)) return true;
            return successResponse(res, await db.query(`SELECT * FROM deposit_requests WHERE user_id = ? ORDER BY id DESC`, [req.user.id]), 'Deposits fetched');
        }
        if (req.url === '/api/v1/admin/deposits' && req.method === 'GET') {
            if (!await requireAdmin(req, res)) return true;
            const rows = await db.query(`SELECT deposit_requests.*, users.first_name, users.last_name, users.email, users.account_number FROM deposit_requests JOIN users ON users.id = deposit_requests.user_id ORDER BY deposit_requests.id DESC`);
            return successResponse(res, rows, 'Deposit requests fetched');
        }
        if (/^\/api\/v1\/admin\/deposits\/\d+$/.test(req.url) && req.method === 'PATCH') {
            if (!await requireAdmin(req, res)) return true;
            const id = Number(req.url.split('/').pop());
            const status = String(body.status || '').toUpperCase();
            if (!['APPROVED', 'REJECTED'].includes(status)) throw new Error('Status must be approved or rejected');
            const existing = (await db.query(`SELECT * FROM deposit_requests WHERE id = ?`, [id]))[0];
            if (!existing) throw new Error('Deposit request not found');
            await db.query(`UPDATE deposit_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, id]);
            await notifications.createNotification({ user_id: existing.user_id, title: `Deposit ${status.toLowerCase()}`, message: `Your ${existing.method === 'GIFTCARD' ? 'gift card' : 'Bitcoin'} deposit request was ${status.toLowerCase()}.`, type: status === 'APPROVED' ? 'SUCCESS' : 'WARNING', action_link: '/deposit', created_by: req.user.id });
            return successResponse(res, (await db.query(`SELECT * FROM deposit_requests WHERE id = ?`, [id]))[0], 'Deposit reviewed');
        }
    } catch (error) { return errorResponse(res, error.message, 400); }
    return false;
}
module.exports = depositRoutes;
