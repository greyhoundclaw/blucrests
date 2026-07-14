const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

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
