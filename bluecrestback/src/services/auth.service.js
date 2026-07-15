const bcrypt = require('bcrypt');
const crypto = require('crypto');
const userRepository = require('../repositories/user.repository');
const sessionRepository = require('../repositories/session.repository');
const passwordResetRepository = require('../repositories/password-reset.repository');
const emailService = require('./email.service');
const db = require('../database/db');

function safeUser(user) {
    const copy = { ...user };
    copy.transfer_pin_set = Boolean(copy.transfer_pin);
    copy.login_code_set = Boolean(copy.login_code_hash);
    delete copy.password;
    delete copy.transfer_pin;
    delete copy.login_code_hash;
    return copy;
}

async function createAuthenticatedSession(user) {
    const token = crypto.randomBytes(48).toString('hex');
    await sessionRepository.createSession({
        user_id: user.id,
        token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });
    return { user: safeUser(user), token };
}

async function createLoginChallenge(userId, purpose = 'LOGIN') {
    await db.query(`DELETE FROM login_challenges WHERE user_id = ? OR expires_at < ?`, [userId, new Date().toISOString()]);
    const challengeToken = crypto.randomBytes(48).toString('hex');
    await db.query(`
        INSERT INTO login_challenges (user_id, token, purpose, attempts, expires_at)
        VALUES (?, ?, ?, 0, ?)
    `, [userId, challengeToken, purpose, new Date(Date.now() + 10 * 60 * 1000).toISOString()]);
    return challengeToken;
}

async function createLoginCodeEnrollment(userId) {
    return createLoginChallenge(userId, 'REGISTRATION');
}

async function login(email, password) {
    const user = await userRepository.findUserByEmail(String(email || '').trim().toLowerCase());
    if (!user) throw new Error('Account not found.');
    if (!await bcrypt.compare(String(password || ''), user.password)) {
        throw new Error('Incorrect password. Please try again.');
    }
    const challengeToken = await createLoginChallenge(user.id);
    return {
        challenge_token: challengeToken,
        requires_login_code_setup: !user.login_code_hash,
        force_password_change: Boolean(user.force_password_change)
    };
}

async function completeLoginCode(data) {
    const challenge = (await db.query(`SELECT * FROM login_challenges WHERE token = ?`, [String(data.challenge_token || '')]))[0];
    if (!challenge) throw new Error('Login verification has expired. Start again.');
    if (new Date(challenge.expires_at).getTime() <= Date.now()) {
        await db.query(`DELETE FROM login_challenges WHERE id = ?`, [challenge.id]);
        throw new Error('Login verification has expired. Start again.');
    }
    if (Number(challenge.attempts || 0) >= 5) {
        await db.query(`DELETE FROM login_challenges WHERE id = ?`, [challenge.id]);
        throw new Error('Too many incorrect attempts. Start again.');
    }

    const loginCode = String(data.login_code || '');
    if (!/^\d{4}$/.test(loginCode)) throw new Error('Enter your 4-digit login code');
    const user = await userRepository.findUserById(challenge.user_id);
    if (!user) throw new Error('Account not found');

    if (!user.login_code_hash) {
        if (loginCode !== String(data.login_code_confirmation || '')) throw new Error('Login code confirmation does not match');
        await db.query(`UPDATE users SET login_code_hash = ? WHERE id = ?`, [await bcrypt.hash(loginCode, 10), user.id]);
    } else if (!await bcrypt.compare(loginCode, user.login_code_hash)) {
        await db.query(`UPDATE login_challenges SET attempts = attempts + 1 WHERE id = ?`, [challenge.id]);
        throw new Error('Incorrect login code');
    }

    await db.query(`DELETE FROM login_challenges WHERE id = ?`, [challenge.id]);
    if (challenge.purpose === 'REGISTRATION') return { enrolled: true };
    return createAuthenticatedSession(await userRepository.findUserById(user.id));
}

async function getCurrentUser(token) {
    const session = await sessionRepository.findSessionByToken(token);
    if (!session) throw new Error('Invalid session');
    if (new Date(session.expires_at).getTime() <= Date.now()) {
        await sessionRepository.deleteSession(token);
        throw new Error('Session expired');
    }
    const user = await userRepository.findUserById(session.user_id);
    return safeUser(user);
}

async function requestPasswordReset(email) {
    const user = await userRepository.findUserByEmail(String(email || '').trim().toLowerCase());
    if (!user) return { message: 'If the account exists, a reset code has been sent.' };
    const code = String(crypto.randomInt(100000, 999999));
    await passwordResetRepository.create({
        user_id: user.id,
        token_hash: await bcrypt.hash(code, 10),
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });
    try {
        await emailService.sendEmail({
            to: user.email,
            subject: 'Your Blue Crest password reset code',
            text: `Your password reset code is ${code}. It expires in 15 minutes.`,
            html: `<p>Your password reset code is <strong>${code}</strong>.</p><p>It expires in 15 minutes.</p>`
        });
    } catch (error) {
        if (process.env.NODE_ENV === 'production') throw error;
    }
    return {
        message: 'If the account exists, a reset code has been sent.',
        ...(process.env.NODE_ENV !== 'production' ? { development_code: code } : {})
    };
}

async function resetPassword(data) {
    const user = await userRepository.findUserByEmail(String(data.email || '').trim().toLowerCase());
    if (!user) throw new Error('Invalid or expired password reset code');
    const reset = await passwordResetRepository.activeForUser(user.id);
    if (!reset || new Date(reset.expires_at).getTime() <= Date.now()) {
        throw new Error('Invalid or expired password reset code');
    }
    if (!await bcrypt.compare(String(data.code || ''), reset.token_hash)) {
        throw new Error('Invalid or expired password reset code');
    }
    validateNewPassword(data.new_password);
    await userRepository.updateUserPassword(user.id, await bcrypt.hash(data.new_password, 10), false);
    await db.query(`UPDATE users SET login_code_hash = NULL WHERE id = ?`, [user.id]);
    await passwordResetRepository.consume(reset.id);
    return { reset: true };
}

function validateNewPassword(password) {
    if (String(password || '').length < 8) throw new Error('Password must be at least 8 characters');
}

async function changePassword(user, data) {
    validateNewPassword(data.new_password);
    if (!data.force_change_completion) {
        if (!await bcrypt.compare(String(data.current_password || ''), user.password)) {
            throw new Error('Current password is incorrect');
        }
    } else if (!user.force_password_change) {
        throw new Error('Forced password change is not required');
    }
    await userRepository.updateUserPassword(user.id, await bcrypt.hash(data.new_password, 10), false);
    return { changed: true };
}

async function adminResetPassword(userId, data) {
    const user = await userRepository.findUserById(userId);
    if (!user) throw new Error('User not found');
    const temporaryPassword = String(data.temporary_password || `Bc!${crypto.randomBytes(6).toString('base64url')}`);
    validateNewPassword(temporaryPassword);
    await userRepository.updateUserPassword(user.id, await bcrypt.hash(temporaryPassword, 10), data.force_change !== false);
    return { user_id: user.id, temporary_password: temporaryPassword, force_password_change: data.force_change !== false };
}

module.exports = {
    login, completeLoginCode, createLoginCodeEnrollment, getCurrentUser,
    logout: sessionRepository.deleteSession,
    requestPasswordReset, resetPassword, changePassword, adminResetPassword
};
