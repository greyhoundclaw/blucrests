const { requireAuth } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/admin.middleware');
const { successResponse, errorResponse } = require('../utils/response');
const db = require('../database/db');
const push = require('../services/support-push.service');
const notifications = require('../repositories/notification.repository');

async function conversationFor(userId, create = false) {
    let conversation = (await db.query(`SELECT * FROM support_conversations WHERE user_id = ?`, [userId]))[0];
    if (!conversation && create) {
        if (db.USE_POSTGRES) conversation = (await db.query(`INSERT INTO support_conversations (user_id) VALUES (?) RETURNING *`, [userId]))[0];
        else {
            await db.query(`INSERT INTO support_conversations (user_id) VALUES (?)`, [userId]);
            conversation = (await db.query(`SELECT * FROM support_conversations WHERE user_id = ?`, [userId]))[0];
        }
    }
    return conversation;
}

async function supportRoutes(req, res, body) {
    try {
        if (req.method === 'GET' && req.url === '/api/v1/push/public-key') {
            if (!await requireAuth(req, res)) return true;
            return successResponse(res, { public_key: (await push.keys()).publicKey }, 'Push key fetched');
        }
        if (req.method === 'POST' && req.url === '/api/v1/push/subscribe') {
            if (!await requireAuth(req, res)) return true;
            const subscription = body.subscription || body;
            if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) throw new Error('Invalid push subscription');
            await db.query(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`, [req.user.id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]);
            return successResponse(res, null, 'Phone alerts enabled', 201);
        }
        if (req.method === 'GET' && req.url === '/api/v1/support/conversation') {
            if (!await requireAuth(req, res)) return true;
            const conversation = await conversationFor(req.user.id);
            const messages = conversation ? await db.query(`SELECT * FROM support_messages WHERE conversation_id = ? ORDER BY id ASC`, [conversation.id]) : [];
            if (conversation) await db.query(`UPDATE support_messages SET is_read = 1 WHERE conversation_id = ? AND sender_role = 'ADMIN'`, [conversation.id]);
            return successResponse(res, { conversation, messages }, 'Support conversation fetched');
        }
        if (req.method === 'POST' && req.url === '/api/v1/support/messages') {
            if (!await requireAuth(req, res)) return true;
            const message = String(body.message || '').trim();
            if (!message || message.length > 4000) throw new Error('Enter a message up to 4,000 characters');
            const conversation = await conversationFor(req.user.id, true);
            await db.query(`INSERT INTO support_messages (conversation_id, sender_id, sender_role, message) VALUES (?, ?, 'USER', ?)`, [conversation.id, req.user.id, message]);
            await db.query(`UPDATE support_conversations SET status = 'OPEN', last_message_at = CURRENT_TIMESTAMP WHERE id = ?`, [conversation.id]);
            const admins = await db.query(`SELECT id FROM users WHERE UPPER(role) = 'ADMIN'`);
            for (const admin of admins) {
                await notifications.createNotification({
                    user_id: admin.id,
                    title: `Support message from ${req.user.first_name} ${req.user.last_name}`,
                    message: message.slice(0, 180),
                    type: 'INFO',
                    action_link: `/admin?support=${conversation.id}`,
                    created_by: req.user.id
                });
            }
            await push.sendToRole('ADMIN', { title: `Support: ${req.user.first_name} ${req.user.last_name}`, body: message.slice(0, 120), url: `/?support=${conversation.id}` });
            return successResponse(res, null, 'Message sent', 201);
        }
        if (req.method === 'GET' && req.url === '/api/v1/admin/support/conversations') {
            if (!await requireAdmin(req, res)) return true;
            const rows = await db.query(`SELECT c.*, u.first_name, u.last_name, u.email, u.account_number, (SELECT message FROM support_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message, (SELECT COUNT(*) FROM support_messages m WHERE m.conversation_id = c.id AND m.sender_role = 'USER' AND m.is_read = 0) AS unread_count FROM support_conversations c JOIN users u ON u.id = c.user_id ORDER BY c.last_message_at DESC`);
            return successResponse(res, rows, 'Support conversations fetched');
        }
        const adminThread = req.url.match(/^\/api\/v1\/admin\/support\/conversations\/(\d+)$/);
        if (adminThread && req.method === 'GET') {
            if (!await requireAdmin(req, res)) return true;
            const id = Number(adminThread[1]);
            const conversation = (await db.query(`SELECT c.*, u.first_name, u.last_name, u.email, u.account_number FROM support_conversations c JOIN users u ON u.id = c.user_id WHERE c.id = ?`, [id]))[0];
            if (!conversation) throw new Error('Conversation not found');
            await db.query(`UPDATE support_messages SET is_read = 1 WHERE conversation_id = ? AND sender_role = 'USER'`, [id]);
            return successResponse(res, { conversation, messages: await db.query(`SELECT * FROM support_messages WHERE conversation_id = ? ORDER BY id ASC`, [id]) }, 'Conversation fetched');
        }
        if (adminThread && req.method === 'POST') {
            if (!await requireAdmin(req, res)) return true;
            const id = Number(adminThread[1]);
            const message = String(body.message || '').trim();
            if (!message || message.length > 4000) throw new Error('Enter a message up to 4,000 characters');
            const conversation = (await db.query(`SELECT * FROM support_conversations WHERE id = ?`, [id]))[0];
            if (!conversation) throw new Error('Conversation not found');
            await db.query(`INSERT INTO support_messages (conversation_id, sender_id, sender_role, message) VALUES (?, ?, 'ADMIN', ?)`, [id, req.user.id, message]);
            await db.query(`UPDATE support_conversations SET status = 'OPEN', last_message_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
            await notifications.createNotification({ user_id: conversation.user_id, title: 'New support reply', message: message.slice(0, 180), type: 'INFO', action_link: '/support', created_by: req.user.id });
            return successResponse(res, null, 'Reply sent', 201);
        }
        if (adminThread && req.method === 'PATCH') {
            if (!await requireAdmin(req, res)) return true;
            const status = String(body.status || '').toUpperCase();
            if (!['OPEN', 'PENDING', 'CLOSED'].includes(status)) throw new Error('Invalid conversation status');
            await db.query(`UPDATE support_conversations SET status = ? WHERE id = ?`, [status, Number(adminThread[1])]);
            return successResponse(res, null, 'Conversation updated');
        }
    } catch (error) { return errorResponse(res, error.message, 400); }
    return false;
}
module.exports = supportRoutes;
