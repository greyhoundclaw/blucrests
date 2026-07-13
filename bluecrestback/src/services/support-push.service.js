const webpush = require('web-push');
const db = require('../database/db');

async function setting(key) {
    return (await db.query(`SELECT setting_value FROM app_settings WHERE setting_key = ?`, [key]))[0]?.setting_value;
}

async function keys() {
    let publicKey = process.env.VAPID_PUBLIC_KEY || await setting('vapid_public_key');
    let privateKey = process.env.VAPID_PRIVATE_KEY || await setting('vapid_private_key');
    if (!publicKey || !privateKey) {
        const generated = webpush.generateVAPIDKeys();
        publicKey = generated.publicKey;
        privateKey = generated.privateKey;
        await db.query(`INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value`, ['vapid_public_key', publicKey]);
        await db.query(`INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value`, ['vapid_private_key', privateKey]);
    }
    return { publicKey, privateKey };
}

async function sendToRole(role, payload) {
    const vapid = await keys();
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:bluecrestsupport@gmail.com', vapid.publicKey, vapid.privateKey);
    const subscriptions = await db.query(`SELECT ps.* FROM push_subscriptions ps JOIN users u ON u.id = ps.user_id WHERE u.role = ?`, [role]);
    await Promise.allSettled(subscriptions.map(async subscription => {
        try {
            await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(payload));
        } catch (error) {
            if ([404, 410].includes(error.statusCode)) await db.query(`DELETE FROM push_subscriptions WHERE id = ?`, [subscription.id]);
        }
    }));
}

module.exports = { keys, sendToRole };
