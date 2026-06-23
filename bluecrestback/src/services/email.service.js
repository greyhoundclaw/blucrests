const crypto = require('crypto');
const nodemailer = require('nodemailer');
const emailRepository = require('../repositories/email.repository');
const userRepository = require('../repositories/user.repository');

function encryptionKey() {
    const secret = process.env.SMTP_ENCRYPTION_KEY || process.env.APP_SECRET || 'bluecrest-local-development-key';
    return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(value) {
    if (!value) return '';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':');
}

function decrypt(value) {
    if (!value) return '';
    const [iv, tag, payload] = value.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(payload, 'hex')), decipher.final()]).toString('utf8');
}

async function resolvedSettings() {
    const stored = await emailRepository.getSettings();
    return {
        ...stored,
        smtp_host: stored?.smtp_host || process.env.SMTP_HOST || '',
        smtp_port: Number(stored?.smtp_port || process.env.SMTP_PORT || 587),
        smtp_username: stored?.smtp_username || process.env.SMTP_USER || '',
        smtp_password: stored?.smtp_password_encrypted
            ? decrypt(stored.smtp_password_encrypted)
            : process.env.SMTP_PASS || '',
        smtp_secure: stored
            ? Boolean(stored.smtp_secure)
            : process.env.SMTP_SECURE === 'true',
        sender_email: stored?.sender_email || process.env.MAIL_FROM || '',
        sender_name: stored?.sender_name || process.env.MAIL_FROM_NAME || 'Blue Crest'
    };
}

async function saveSettings(admin, data) {
    const current = await emailRepository.getSettings();
    const passwordEncrypted = data.smtp_password
        ? encrypt(String(data.smtp_password))
        : current?.smtp_password_encrypted ||
            (process.env.SMTP_PASS ? encrypt(process.env.SMTP_PASS) : '');
    const port = Number(data.smtp_port || 587);

    if (!String(data.smtp_host || '').trim()) {
        throw new Error('SMTP host is required');
    }

    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
        throw new Error('Enter a valid SMTP port');
    }

    if (!String(data.sender_email || '').includes('@')) {
        throw new Error('Enter a valid sender email');
    }

    const saved = await emailRepository.saveSettings({
        smtp_host: String(data.smtp_host || '').trim(),
        smtp_port: port,
        smtp_username: String(data.smtp_username || '').trim(),
        smtp_password_encrypted: passwordEncrypted,
        smtp_secure: Boolean(data.smtp_secure),
        sender_email: String(data.sender_email || '').trim(),
        sender_name: String(data.sender_name || '').trim(),
        updated_by: admin.id
    });
    return sanitizeSettings(saved);
}

function sanitizeSettings(settings) {
    if (!settings) return null;
    const { smtp_password_encrypted, ...safe } = settings;
    return { ...safe, has_password: Boolean(smtp_password_encrypted) };
}

async function createTransporter() {
    const settings = await resolvedSettings();
    if (!settings.smtp_host || !settings.sender_email) throw new Error('SMTP settings are incomplete');
    return {
        settings,
        transporter: nodemailer.createTransport({
            host: settings.smtp_host,
            port: Number(settings.smtp_port),
            secure: Boolean(settings.smtp_secure),
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 20000,
            auth: settings.smtp_username
                ? { user: settings.smtp_username, pass: settings.smtp_password }
                : undefined
        })
    };
}

async function sendEmail({ to, subject, html, text, attachments = [] }) {
    const { settings, transporter } = await createTransporter();
    return transporter.sendMail({
        from: { address: settings.sender_email, name: settings.sender_name || 'Blue Crest' },
        to,
        subject,
        html,
        text,
        attachments
    });
}

async function sendAdminEmail(admin, data) {
    const subject = String(data.subject || '').trim();
    const html = String(data.html || data.message || '').trim();
    if (!subject || !html) throw new Error('Subject and message are required');
    const users = await userRepository.getAllUsers();
    const ids = new Set((data.user_ids || []).map(Number));
    const recipients = data.send_to_all
        ? users.filter(user => user.role !== 'ADMIN')
        : users.filter(user => ids.has(Number(user.id)));
    if (!recipients.length) throw new Error('Select at least one email recipient');

    const results = [];
    for (const recipient of recipients) {
        const log = await emailRepository.createLog({
            recipient_user_id: recipient.id,
            recipient_email: recipient.email,
            subject,
            sent_by: admin.id
        });
        try {
            const info = await sendEmail({ to: recipient.email, subject, html, text: data.message });
            await emailRepository.updateLog(log.id, {
                status: 'SENT',
                provider_message_id: info.messageId
            });
            results.push({ email: recipient.email, status: 'SENT' });
        } catch (error) {
            await emailRepository.updateLog(log.id, { status: 'FAILED', error_message: error.message });
            results.push({ email: recipient.email, status: 'FAILED', error: error.message });
        }
    }
    return {
        recipient_count: results.length,
        sent_count: results.filter(item => item.status === 'SENT').length,
        failed_count: results.filter(item => item.status === 'FAILED').length,
        results
    };
}

module.exports = {
    sendEmail,
    sendAdminEmail,
    saveSettings,
    getSettings: async () => {
        const stored = await emailRepository.getSettings();
        const effective = await resolvedSettings();
        return {
            ...sanitizeSettings(stored),
            smtp_host: effective.smtp_host,
            smtp_port: effective.smtp_port,
            smtp_username: effective.smtp_username,
            smtp_secure: effective.smtp_secure,
            sender_email: effective.sender_email,
            sender_name: effective.sender_name,
            has_password: Boolean(stored?.smtp_password_encrypted || process.env.SMTP_PASS)
        };
    },
    getLogs: emailRepository.getLogs,
    verifySettings: async () => {
        const { transporter } = await createTransporter();
        await transporter.verify();
        return { verified: true };
    }
};
