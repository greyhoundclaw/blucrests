const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const bcrypt = require('bcrypt');

const databasePath = path.join(__dirname, 'login-code.test.db');
fs.rmSync(databasePath, { force: true });
process.env.SQLITE_DB_PATH = databasePath;
delete process.env.DATABASE_URL;

const initializeDatabase = require('../src/database/init');
const db = require('../src/database/db');
const sqlite = require('../src/database/sqlite');
const authService = require('../src/services/auth.service');
const emailService = require('../src/services/email.service');

test.before(async () => {
    await initializeDatabase();
    await db.query(`
        INSERT INTO users (account_number, first_name, last_name, username, email, phone, password, status, role)
        VALUES ('3000000003', 'Existing', 'Customer', 'existing-customer', 'existing@example.com', '+15550000003', ?, 'ACTIVE', 'USER')
    `, [await bcrypt.hash('Password123!', 4)]);
});

test.after(() => {
    sqlite.close();
    fs.rmSync(databasePath, { force: true });
});

test('password login creates only a short-lived code challenge', async () => {
    const result = await authService.login('existing@example.com', 'Password123!');
    assert.equal(result.requires_login_code_setup, true);
    assert.ok(result.challenge_token);
    assert.equal(result.token, undefined);
    assert.equal((await db.query(`SELECT COUNT(*) AS count FROM sessions`))[0].count, 0);
});

test('post-registration enrollment saves the code without creating a dashboard session', async () => {
    const user = (await db.query(`SELECT * FROM users WHERE email = 'existing@example.com'`))[0];
    const enrollmentToken = await authService.createLoginCodeEnrollment(user.id);
    const result = await authService.completeLoginCode({
        challenge_token: enrollmentToken,
        login_code: '2468',
        login_code_confirmation: '2468'
    });
    assert.equal(result.enrolled, true);
    assert.equal(result.token, undefined);
    assert.equal((await db.query(`SELECT COUNT(*) AS count FROM sessions`))[0].count, 0);
});

test('an existing customer enrolls a code once and receives a real session', async () => {
    const challenge = await authService.login('existing@example.com', 'Password123!');
    await db.query(`UPDATE users SET login_code_hash = NULL WHERE email = 'existing@example.com'`);
    const result = await authService.completeLoginCode({
        challenge_token: challenge.challenge_token,
        login_code: '2468',
        login_code_confirmation: '2468'
    });
    assert.ok(result.token);
    assert.equal(result.user.login_code_set, true);
    assert.equal(result.user.login_code_hash, undefined);
});

test('future logins reject the wrong code and accept the enrolled code', async () => {
    const challenge = await authService.login('existing@example.com', 'Password123!');
    assert.equal(challenge.requires_login_code_setup, false);
    await assert.rejects(
        authService.completeLoginCode({ challenge_token: challenge.challenge_token, login_code: '1111' }),
        /Incorrect login code/
    );
    const result = await authService.completeLoginCode({ challenge_token: challenge.challenge_token, login_code: '2468' });
    assert.ok(result.token);
});

test('email remains pending until the six-digit confirmation code is accepted', async () => {
    const user = (await db.query(`SELECT * FROM users WHERE email = 'existing@example.com'`))[0];
    const issued = await emailService.issueEmailVerification(user, { deliver: false });

    assert.match(issued.development_code, /^\d{6}$/);
    await assert.rejects(
        emailService.verifyEmailCode(user, '000000'),
        /Invalid confirmation code/
    );
    assert.notEqual(
        Number((await db.query(`SELECT email_verified FROM users WHERE id = ?`, [user.id]))[0].email_verified),
        1
    );

    const verified = await emailService.verifyEmailCode(user, issued.development_code);
    assert.equal(verified.verified, true);
    assert.equal(
        Number((await db.query(`SELECT email_verified FROM users WHERE id = ?`, [user.id]))[0].email_verified),
        1
    );
    assert.equal(
        Number((await db.query(`SELECT COUNT(*) AS count FROM email_verifications WHERE user_id = ?`, [user.id]))[0].count),
        0
    );
});
