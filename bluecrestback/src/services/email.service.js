const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const db = require('../database/db');
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

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function emailShell(title, firstName, content) {
    return `
        <div style="background:#f5f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#172033">
            <div style="max-width:600px;margin:auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e7eaf0">
                <div style="background:#003399;color:#fff;padding:24px 28px">
                    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.8">Blue Crest Bank</div>
                    <h1 style="font-size:22px;margin:8px 0 0">${escapeHtml(title)}</h1>
                </div>
                <div style="padding:28px">
                    <p style="margin-top:0">Hello ${escapeHtml(firstName || 'Customer')},</p>
                    ${content}
                    <p style="font-size:12px;color:#6b7280;margin:28px 0 0">If you did not expect this message, contact Blue Crest support immediately.</p>
                </div>
            </div>
        </div>`;
}

function money(amount, currency = 'USD') {
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: String(currency || 'USD').toUpperCase()
        }).format(Number(amount));
    } catch (_error) {
        return `${currency || 'USD'} ${Number(amount).toFixed(2)}`;
    }
}

async function issueEmailVerification(user, options = {}) {
    if (!user?.id || !user?.email) throw new Error('A valid user is required');
    if (Number(user.email_verified) === 1) return { verified: true, already_verified: true };

    const existingRows = await db.query(
        'SELECT created_at FROM email_verifications WHERE user_id = ? ORDER BY id DESC',
        [user.id]
    );
    const createdAt = existingRows[0]?.created_at;
    const createdAtText = String(createdAt || '');
    const lastIssuedAt = createdAt instanceof Date
        ? createdAt.getTime()
        : createdAtText
            ? new Date(createdAtText.includes('T') ? createdAtText : `${createdAtText.replace(' ', 'T')}Z`).getTime()
            : 0;
    if (options.deliver !== false && lastIssuedAt && Date.now() - lastIssuedAt < 60_000) {
        throw new Error('Please wait one minute before requesting another code');
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await db.query('DELETE FROM email_verifications WHERE user_id = ?', [user.id]);
    await db.query(
        'INSERT INTO email_verifications (user_id, token, expires_at, attempts) VALUES (?, ?, ?, 0)',
        [user.id, codeHash, expiresAt]
    );

    if (options.deliver !== false) {
        const subject = 'Confirm your Blue Crest email address';
        const text = `Hello ${user.first_name || 'Customer'}, your Blue Crest email confirmation code is ${code}. It expires in 30 minutes.`;
        const html = emailShell(subject, user.first_name, `
            <p>Use the confirmation code below to verify your email address.</p>
            <div style="font-size:30px;font-weight:800;letter-spacing:8px;text-align:center;background:#f1f5ff;color:#003399;border-radius:14px;padding:18px;margin:24px 0">${code}</div>
            <p style="color:#4b5563">This code expires in 30 minutes. Never share it with anyone.</p>`);
        await sendEmail({ to: user.email, subject, text, html });
    }

    const result = { verified: false, sent: options.deliver !== false, expires_at: expiresAt };
    if (process.env.NODE_ENV !== 'production') result.development_code = code;
    return result;
}

async function verifyEmailCode(user, rawCode) {
    if (!user?.id) throw new Error('Authentication is required');
    if (Number(user.email_verified) === 1) return { verified: true, already_verified: true };

    const code = String(rawCode || '').trim();
    if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit confirmation code');

    const rows = await db.query(
        'SELECT * FROM email_verifications WHERE user_id = ? ORDER BY id DESC',
        [user.id]
    );
    const record = rows[0];
    if (!record) throw new Error('Request a new confirmation code');
    if (new Date(record.expires_at).getTime() < Date.now()) {
        await db.query('DELETE FROM email_verifications WHERE user_id = ?', [user.id]);
        throw new Error('Confirmation code has expired. Request a new one');
    }
    if (Number(record.attempts || 0) >= 5) {
        await db.query('DELETE FROM email_verifications WHERE user_id = ?', [user.id]);
        throw new Error('Too many incorrect attempts. Request a new code');
    }
    if (!await bcrypt.compare(code, record.token)) {
        await db.query('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?', [record.id]);
        throw new Error('Invalid confirmation code');
    }

    await db.withTransaction(async () => {
        await db.query('UPDATE users SET email_verified = 1 WHERE id = ?', [user.id]);
        await db.query('DELETE FROM email_verifications WHERE user_id = ?', [user.id]);
    });
    return { verified: true };
}

async function sendTransferReceivedEmail(recipient, sender, transfer) {
    if (!recipient?.email || transfer?.transfer_type !== 'INTERNAL') return null;
    const amount = money(transfer.amount, transfer.currency || recipient.preferred_currency);
    const senderName = `${sender?.first_name || ''} ${sender?.last_name || ''}`.trim() || 'another Blue Crest account';
    const subject = `Transfer received: ${amount}`;
    const text = `Hello ${recipient.first_name || 'Customer'}, you received ${amount} from ${senderName}. Reference: ${transfer.reference || transfer.id}.`;
    const html = emailShell('Transfer received', recipient.first_name, `
        <p>A transfer has been credited to your Blue Crest account.</p>
        <div style="background:#f8fafc;border-radius:14px;padding:18px;margin:20px 0">
            <p style="margin:0 0 10px"><strong>Amount:</strong> ${escapeHtml(amount)}</p>
            <p style="margin:0 0 10px"><strong>From:</strong> ${escapeHtml(senderName)}</p>
            <p style="margin:0"><strong>Reference:</strong> ${escapeHtml(transfer.reference || transfer.id)}</p>
        </div>`);
    return sendEmail({ to: recipient.email, subject, text, html });
}

async function sendSingleTransactionEmail(user, transaction) {
    if (!user?.email || !transaction) return null;
    const amount = money(transaction.amount, transaction.currency || user.preferred_currency);
    const isCredit = transaction.type === 'CREDIT';
    const title = isCredit ? 'Account credited' : 'Account debited';
    const subject = `${title}: ${amount}`;
    const text = `Hello ${user.first_name || 'Customer'}, your account was ${isCredit ? 'credited' : 'debited'} ${amount}. ${transaction.description || ''} Reference: ${transaction.reference}.`;
    const html = emailShell(title, user.first_name, `
        <p>A single account transaction has been added to your account.</p>
        <div style="background:#f8fafc;border-radius:14px;padding:18px;margin:20px 0">
            <p style="margin:0 0 10px"><strong>Amount:</strong> ${escapeHtml(amount)}</p>
            <p style="margin:0 0 10px"><strong>Description:</strong> ${escapeHtml(transaction.description || title)}</p>
            <p style="margin:0"><strong>Reference:</strong> ${escapeHtml(transaction.reference)}</p>
        </div>`);
    return sendEmail({ to: user.email, subject, text, html });
}

async function sendTransferStatusEmail(user, transfer, status) {
    if (!user?.email || !transfer) return null;
    const normalizedStatus = String(status || transfer.status || '').toUpperCase();
    if (!['PENDING', 'RESTRICTED'].includes(normalizedStatus)) return null;

    const amount = money(transfer.amount, transfer.currency || user.preferred_currency);
    const pending = normalizedStatus === 'PENDING';
    const title = pending ? 'Transfer pending review' : 'Transfer restricted';
    const subject = `${title}: ${amount}`;
    const explanation = pending
        ? 'Your transfer was received and is currently pending administrative review. No completed debit will occur until it is approved.'
        : 'Your transfer has been restricted and cannot be completed at this time. Please contact Blue Crest support for assistance.';
    const text = `Hello ${user.first_name || 'Customer'}, ${explanation} Amount: ${amount}. Transfer ID: ${transfer.id}.`;
    const html = emailShell(title, user.first_name, `
        <p>${escapeHtml(explanation)}</p>
        <div style="background:${pending ? '#fffbeb' : '#fff1f2'};border-radius:14px;padding:18px;margin:20px 0">
            <p style="margin:0 0 10px"><strong>Status:</strong> ${normalizedStatus}</p>
            <p style="margin:0 0 10px"><strong>Amount:</strong> ${escapeHtml(amount)}</p>
            <p style="margin:0"><strong>Transfer ID:</strong> ${escapeHtml(transfer.id)}</p>
        </div>`);
    return sendEmail({ to: user.email, subject, text, html });
}

async function sendAccountRestrictionEmail(user) {
    if (!user?.email) return null;
    const subject = 'Important: Your Blue Crest account has been restricted';
    const explanation = 'Your account transfer access has been restricted. To ask about this restriction or restore access, please contact Blue Crest support.';
    const text = `Hello ${user.first_name || 'Customer'}, ${explanation} Please contact Blue Crest support for assistance.`;
    const html = emailShell('Account restricted', user.first_name, `
        <p>${escapeHtml(explanation)}</p>
        <div style="background:#fff1f2;color:#9f1239;border-radius:14px;padding:18px;margin:20px 0">
            <strong>Status: RESTRICTED</strong>
        </div>
        <p>Please contact Blue Crest support if you need assistance.</p>`);
    return sendEmail({ to: user.email, subject, text, html });
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
    issueEmailVerification,
    verifyEmailCode,
    sendTransferReceivedEmail,
    sendSingleTransactionEmail,
    sendTransferStatusEmail,
    sendAccountRestrictionEmail,
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
