const bcrypt = require('bcrypt');
const crypto = require('crypto');
const repository = require('../repositories/transfer-verification.repository');
const userRepository = require('../repositories/user.repository');
const notificationRepository = require('../repositories/notification.repository');

async function assign(admin, data) {
    const user = await userRepository.findUserById(data.user_id);
    if (!user) throw new Error('User not found');
    const code = String(data.code || crypto.randomInt(10000000, 99999999)).trim();
    if (!/^\d{6,12}$/.test(code)) throw new Error('Verification code must contain 6 to 12 digits');
    const record = await repository.createCode({
        user_id: user.id,
        code_hash: await bcrypt.hash(code, 10),
        code_last_four: code.slice(-4),
        created_by: admin.id
    });
    await userRepository.updateTransferFlow(user.id, 'AUTHORIZATION_REQUIRED');
    await notificationRepository.createNotification({
        user_id: user.id,
        title: 'Transfer Authorization Code',
        message: `Your transfer authorization code is ${code}. Use it to continue your held transfer.`,
        type: 'SECURITY',
        action_link: '/local-transfer',
        created_by: admin.id
    });
    return { ...record, code };
}

async function verify(user, input, ipAddress) {
    const record = await repository.getActiveForUser(user.id);
    if (!record) {
        await repository.logAttempt({ user_id: user.id, success: false, ip_address: ipAddress });
        const error = new Error('No Transfer Verification Code has been assigned to your account.');
        error.code = 'NO_CODE';
        throw error;
    }
    const valid = await bcrypt.compare(String(input || ''), record.code_hash);
    await repository.logAttempt({ user_id: user.id, code_id: record.id, success: valid, ip_address: ipAddress });
    if (!valid) throw new Error('Invalid Transfer Verification Code.');
    const token = crypto.randomBytes(32).toString('hex');
    await repository.createSession({
        user_id: user.id,
        code_id: record.id,
        token,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });
    return { verification_token: token, expires_in_seconds: 600 };
}

async function consume(userId, token) {
    if (!token) throw new Error('Transfer verification is required');
    const session = await repository.consumeSession(token, userId);
    if (!session) throw new Error('Transfer verification expired or has already been used');
    return session;
}

module.exports = {
    assign, verify, consume,
    revoke: repository.revoke,
    listCodes: repository.listCodes,
    listAttempts: repository.listAttempts,
    transferHistory: repository.transferHistory
};
