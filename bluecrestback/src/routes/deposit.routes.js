const { requireAuth } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/admin.middleware');
const { successResponse, errorResponse } = require('../utils/response');
const db = require('../database/db');
const notifications = require('../repositories/notification.repository');
const ledgerService = require('../services/ledger.service');
const BITCOIN_ADDRESS = String(process.env.BITCOIN_PAYMENT_ADDRESS || 'bc1qdxsym4k0rfne6cd0pn6233llkh5sy4fhj7p44l').trim();

async function depositRoutes(req, res, body) {
    try {
        if (req.url === '/api/v1/deposits/config' && req.method === 'GET') {
            if (!await requireAuth(req, res)) return true;
            return successResponse(res, { bitcoin_address: BITCOIN_ADDRESS, network: 'Bitcoin (BTC)' }, 'Deposit configuration fetched');
        }
        if (req.url === '/api/v1/deposits' && req.method === 'POST') {
            if (!await requireAuth(req, res)) return true;
            const method = String(body.method || '').toUpperCase();
            const amount = Number(body.amount);
            const images = Array.isArray(body.images) ? body.images : [];
            if (method !== 'BITCOIN') throw new Error('Bitcoin is the only available deposit method');
            if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a valid deposit amount');
            if (!images.length) throw new Error('Bitcoin transaction receipt is required');
            let targetAccount = null;
            if (body.account_id) {
                targetAccount = (await db.query(`
                    SELECT a.* FROM accounts a JOIN account_owners ao ON ao.account_id = a.id
                    WHERE a.id = ? AND ao.user_id = ? AND ao.status = 'ACCEPTED' AND a.account_kind = 'JOINT'
                `, [Number(body.account_id), req.user.id]))[0];
                if (!targetAccount) throw new Error('Joint account access denied');
            } else {
                targetAccount = (await db.query(`
                    SELECT a.* FROM accounts a JOIN account_owners ao ON ao.account_id = a.id
                    WHERE ao.user_id = ? AND ao.role = 'PRIMARY_OWNER' AND ao.status = 'ACCEPTED' AND a.account_kind = 'PRIMARY'
                    ORDER BY ao.id ASC LIMIT 1
                `, [req.user.id]))[0] || null;
            }
            const sql = db.USE_POSTGRES
                ? `INSERT INTO deposit_requests (user_id, account_id, method, amount, card_name, bitcoin_address, images_json) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
                : `INSERT INTO deposit_requests (user_id, account_id, method, amount, card_name, bitcoin_address, images_json) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            const result = await db.query(sql, [req.user.id, targetAccount?.id || null, method, amount, body.card_name || null, method === 'BITCOIN' ? BITCOIN_ADDRESS : null, JSON.stringify(images)]);
            const deposit = db.USE_POSTGRES ? result[0] : (await db.query(`SELECT * FROM deposit_requests WHERE id = (SELECT MAX(id) FROM deposit_requests)`))[0];
            await notifications.createNotification({ user_id: req.user.id, title: 'Deposit request received', message: `Your Bitcoin deposit to ${targetAccount?.account_kind === 'JOINT' ? 'the joint account' : 'your account'} is pending review.`, type: 'INFO', action_link: targetAccount?.account_kind === 'JOINT' ? '/joint-accounts' : '/deposit' });
            return successResponse(res, deposit, 'Deposit submitted', 201);
        }
        if (req.url === '/api/v1/deposits' && req.method === 'GET') {
            if (!await requireAuth(req, res)) return true;
            return successResponse(res, await db.query(`SELECT * FROM deposit_requests WHERE user_id = ? ORDER BY id DESC`, [req.user.id]), 'Deposits fetched');
        }
        if (req.url === '/api/v1/admin/deposits' && req.method === 'GET') {
            if (!await requireAdmin(req, res)) return true;
            const rows = await db.query(`SELECT deposit_requests.*, users.first_name, users.last_name, users.email, users.account_number, accounts.account_number AS target_account_number, accounts.account_kind AS target_account_kind FROM deposit_requests JOIN users ON users.id = deposit_requests.user_id LEFT JOIN accounts ON accounts.id = deposit_requests.account_id ORDER BY deposit_requests.id DESC`);
            return successResponse(res, rows, 'Deposit requests fetched');
        }
        if (/^\/api\/v1\/admin\/deposits\/\d+$/.test(req.url) && req.method === 'PATCH') {
            if (!await requireAdmin(req, res)) return true;
            const id = Number(req.url.split('/').pop());
            const status = String(body.status || '').toUpperCase();
            if (!['APPROVED', 'REJECTED'].includes(status)) throw new Error('Status must be approved or rejected');
            const existing = (await db.query(`SELECT * FROM deposit_requests WHERE id = ?`, [id]))[0];
            if (!existing) throw new Error('Deposit request not found');
            if (existing.status !== 'PENDING') return successResponse(res, existing, `Deposit was already ${existing.status.toLowerCase()}`);
            await db.withTransaction(async () => {
                if (status === 'APPROVED') {
                    await ledgerService.postEntry({ user_id: existing.user_id, account_id: existing.account_id || null, reference: `DEP-${existing.id}`, type: 'CREDIT', category: 'deposit', amount: existing.amount, description: `${existing.method === 'GIFTCARD' ? 'Gift card' : 'Bitcoin'} deposit`, performed_by: existing.user_id, created_by: req.user.id });
                }
                await db.query(`UPDATE deposit_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, id]);
            });
            const target = existing.account_id ? (await db.query(`SELECT account_kind FROM accounts WHERE id = ?`, [existing.account_id]))[0] : null;
            await notifications.createNotification({ user_id: existing.user_id, title: `Deposit ${status.toLowerCase()}`, message: `Your ${existing.method === 'GIFTCARD' ? 'gift card' : 'Bitcoin'} deposit request was ${status.toLowerCase()}.`, type: status === 'APPROVED' ? 'SUCCESS' : 'WARNING', action_link: target?.account_kind === 'JOINT' ? '/joint-accounts' : '/deposit', created_by: req.user.id });
            return successResponse(res, (await db.query(`SELECT * FROM deposit_requests WHERE id = ?`, [id]))[0], 'Deposit reviewed');
        }
    } catch (error) { return errorResponse(res, error.message, 400); }
    return false;
}
module.exports = depositRoutes;
