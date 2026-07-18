const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const bcrypt = require('bcrypt');

const databasePath = path.join(__dirname, 'joint-accounts.test.db');
fs.rmSync(databasePath, { force: true });
process.env.SQLITE_DB_PATH = databasePath;
delete process.env.DATABASE_URL;

const initializeDatabase = require('../src/database/init');
const db = require('../src/database/db');
const sqlite = require('../src/database/sqlite');
const userService = require('../src/services/user.service');
const jointAccountService = require('../src/services/joint-account.service');
const ledgerService = require('../src/services/ledger.service');
const depositRoutes = require('../src/routes/deposit.routes');

let primary;
let coOwner;
let jointAccount;

test.before(async () => {
    await initializeDatabase();
    primary = await userService.registerUser({
        first_name: 'Ada', last_name: 'Primary', username: 'ada-primary',
        email: 'ada@example.com', phone: '+15550000001', password: 'Password123!',
        preferred_currency: 'USD', account_type: 'SAVINGS'
    });
    coOwner = await userService.registerUser({
        first_name: 'Grace', last_name: 'Owner', username: 'grace-owner',
        email: 'grace@example.com', phone: '+15550000002', password: 'Password123!',
        preferred_currency: 'USD', account_type: 'CHECKING'
    });
    await db.query(`UPDATE users SET kyc_status = 'VERIFIED' WHERE id IN (?, ?)`, [primary.id, coOwner.id]);
    primary.kyc_status = 'VERIFIED';
    coOwner.kyc_status = 'VERIFIED';
});

test.after(() => {
    sqlite.close();
    fs.rmSync(databasePath, { force: true });
});

test('registration creates the selected primary account type and ownership link', async () => {
    const account = (await db.query(`
        SELECT a.*, ao.role, ao.status FROM accounts a
        JOIN account_owners ao ON ao.account_id = a.id
        WHERE ao.user_id = ? AND a.account_kind = 'PRIMARY'
    `, [primary.id]))[0];
    assert.equal(account.account_type, 'SAVINGS');
    assert.equal(account.role, 'PRIMARY_OWNER');
    assert.equal(account.status, 'ACCEPTED');
});

test('joint invitation acceptance gives both owners the same account data', async () => {
    const opened = await jointAccountService.openJointAccount(primary, {
        account_type: 'CHECKING', identifier_type: 'EMAIL', invite_identifier: coOwner.email
    });
    jointAccount = opened.account;
    await jointAccountService.respondToInvitation(opened.invitation.id, coOwner, 'ACCEPTED');

    const primaryView = await jointAccountService.getDashboard(primary.id);
    const coOwnerView = await jointAccountService.getDashboard(coOwner.id);
    const primaryJoint = primaryView.accounts.find(account => account.id === jointAccount.id);
    const coOwnerJoint = coOwnerView.accounts.find(account => account.id === jointAccount.id);
    assert.equal(primaryJoint.account_number, coOwnerJoint.account_number);
    assert.equal(Number(primaryJoint.owner_count), 2);
    assert.equal(Number(coOwnerJoint.owner_count), 2);
});

test('a shared ledger entry is visible to both owners with performer attribution', async () => {
    await ledgerService.postEntry({
        user_id: primary.id,
        account_id: jointAccount.id,
        performed_by: primary.id,
        type: 'CREDIT',
        amount: 750,
        currency: 'USD',
        description: 'Joint account opening deposit'
    });

    const primaryView = await jointAccountService.getDashboard(primary.id);
    const coOwnerView = await jointAccountService.getDashboard(coOwner.id);
    const first = primaryView.accounts.find(account => account.id === jointAccount.id);
    const second = coOwnerView.accounts.find(account => account.id === jointAccount.id);
    assert.equal(Number(first.balance), 750);
    assert.equal(Number(second.balance), 750);
    assert.equal(first.transactions[0].performed_by_first_name, 'Ada');
    assert.equal(second.transactions[0].description, 'Joint account opening deposit');
});

test('either owner can move personal funds into the same joint balance', async () => {
    await ledgerService.postEntry({ user_id: coOwner.id, type: 'CREDIT', amount: 500, currency: 'USD', description: 'Personal funding source' });
    await db.query(`UPDATE users SET transfer_pin = ? WHERE id = ?`, [await bcrypt.hash('4321', 4), coOwner.id]);
    const authenticatedOwner = (await db.query(`SELECT * FROM users WHERE id = ?`, [coOwner.id]))[0];

    await jointAccountService.fundFromPersonalAccount(jointAccount.id, authenticatedOwner, { amount: 125, pin: '4321' });

    const primaryView = await jointAccountService.getDashboard(primary.id);
    const coOwnerView = await jointAccountService.getDashboard(coOwner.id);
    assert.equal(Number(primaryView.accounts.find(account => account.id === jointAccount.id).balance), 875);
    assert.equal(Number(coOwnerView.accounts.find(account => account.id === jointAccount.id).balance), 875);
    assert.equal(Number((await db.query(`SELECT balance FROM users WHERE id = ?`, [coOwner.id]))[0].balance), 375);
});

test('deposit API exposes Bitcoin instructions and rejects removed gift cards', async () => {
    await db.query(`INSERT INTO sessions (user_id, token, expires_at) VALUES (?, 'bitcoin-deposit-user', ?)`, [coOwner.id, new Date(Date.now() + 60_000).toISOString()]);
    const response = { status: 0, payload: null, writeHead(status) { this.status = status; }, end(body) { this.payload = JSON.parse(body); } };
    const headers = { authorization: 'Bearer bitcoin-deposit-user' };

    await depositRoutes({ method: 'GET', url: '/api/v1/deposits/config', headers }, response, {});
    assert.equal(response.status, 200);
    assert.ok(response.payload.data.bitcoin_address);
    assert.equal(response.payload.data.network, 'Bitcoin (BTC)');

    await depositRoutes(
        { method: 'POST', url: '/api/v1/deposits', headers },
        response,
        { method: 'GIFTCARD', amount: 50, card_name: 'Removed', images: [{ name: 'receipt.png', data: 'data:image/png;base64,AA==' }] }
    );
    assert.equal(response.status, 400);
    assert.match(response.payload.error.message, /Bitcoin is the only available deposit method/);
});

test('an approved deposit request credits the selected joint account exactly once', async () => {
    const inserted = await db.query(`INSERT INTO deposit_requests (user_id, account_id, method, amount, images_json, status) VALUES (?, ?, 'BITCOIN', 50, '[]', 'PENDING')`, [coOwner.id, jointAccount.id]);
    const depositId = Number(inserted.lastInsertRowid);
    await db.query(`INSERT INTO sessions (user_id, token, expires_at) VALUES (1, 'joint-deposit-admin', ?)`, [new Date(Date.now() + 60_000).toISOString()]);
    const response = { status: 0, payload: null, writeHead(status) { this.status = status; }, end(body) { this.payload = JSON.parse(body); } };
    const request = { method: 'PATCH', url: `/api/v1/admin/deposits/${depositId}`, headers: { authorization: 'Bearer joint-deposit-admin' } };

    await depositRoutes(request, response, { status: 'APPROVED' });
    await depositRoutes(request, response, { status: 'APPROVED' });

    assert.equal(response.status, 200);
    assert.equal(Number((await db.query(`SELECT balance FROM accounts WHERE id = ?`, [jointAccount.id]))[0].balance), 925);
    assert.equal((await db.query(`SELECT COUNT(*) AS count FROM transactions WHERE reference = ?`, [`DEP-${depositId}`]))[0].count, 1);
});
