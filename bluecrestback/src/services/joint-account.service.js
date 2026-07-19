const crypto = require('crypto');
const db = require('../database/db');
const notifications = require('../repositories/notification.repository');
const emailService = require('./email.service');
const bcrypt = require('bcrypt');
const ledgerService = require('./ledger.service');

const ACCOUNT_TYPES = ['CHECKING', 'SAVINGS', 'FIXED_DEPOSIT'];

function normalizeAccountType(value) {
    const type = String(value || '').trim().toUpperCase().replace(/\s+/g, '_').replace(/_ACCOUNT$/, '');
    if (!ACCOUNT_TYPES.includes(type)) throw new Error('Choose a valid account type');
    return type;
}

async function generateAccountNumber() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const number = String(crypto.randomInt(1000000000, 2147483647));
        const existing = await db.query(`SELECT id FROM accounts WHERE account_number = ?`, [number]);
        if (!existing[0]) return number;
    }
    throw new Error('Unable to generate a joint account number');
}

async function accountForOwner(accountId, userId, requirePrimary = false) {
    const rows = await db.query(`
        SELECT a.*, ao.role AS owner_role, ao.status AS owner_status
        FROM accounts a JOIN account_owners ao ON ao.account_id = a.id
        WHERE a.id = ? AND ao.user_id = ? AND ao.status = 'ACCEPTED'
    `, [accountId, userId]);
    const account = rows[0];
    if (!account) throw new Error('Joint account access denied');
    if (requirePrimary && account.owner_role !== 'PRIMARY_OWNER') throw new Error('Only the primary owner can manage owners');
    return account;
}

async function findInvitee(data) {
    const type = String(data.identifier_type || 'EMAIL').toUpperCase();
    const identifier = String(data.invite_identifier || '').trim();
    if (!identifier) throw new Error('Enter an email, phone number, customer ID, or username');

    const lookups = {
        EMAIL: ['LOWER(email) = LOWER(?)', identifier],
        PHONE: ['phone = ?', identifier],
        CUSTOMER_ID: ['CAST(id AS TEXT) = ? OR account_number = ?', identifier, identifier],
        USERNAME: ['LOWER(username) = LOWER(?)', identifier]
    };
    const lookup = lookups[type];
    if (!lookup) throw new Error('Invalid invitation identifier type');
    const [where, ...params] = lookup;
    return { type, identifier, user: (await db.query(`SELECT * FROM users WHERE ${where} LIMIT 1`, params))[0] || null };
}

function invitationMatchesUser(invitation, user) {
    const normalize = value => String(value || '').trim().toLowerCase();
    const customerIdentifiers = new Set([
        normalize(user.id),
        normalize(user.account_number)
    ].filter(Boolean));
    return (
        (invitation.email && normalize(invitation.email) === normalize(user.email)) ||
        (invitation.phone && normalize(invitation.phone) === normalize(user.phone)) ||
        (invitation.username && normalize(invitation.username) === normalize(user.username)) ||
        (invitation.customer_id && customerIdentifiers.has(normalize(invitation.customer_id)))
    );
}

async function linkInvitationsAndOwnership(userId) {
    const user = (await db.query(`SELECT * FROM users WHERE id = ?`, [userId]))[0];
    if (!user) throw new Error('User not found');

    const unclaimed = await db.query(`
        SELECT * FROM joint_account_invitations
        WHERE invitee_user_id IS NULL AND status IN ('PENDING', 'ACCEPTED')
    `);
    for (const invitation of unclaimed) {
        if (invitationMatchesUser(invitation, user)) {
            await db.query(`
                UPDATE joint_account_invitations
                SET invitee_user_id = ?
                WHERE id = ? AND invitee_user_id IS NULL
            `, [user.id, invitation.id]);
        }
    }

    const accepted = await db.query(`
        SELECT ji.* FROM joint_account_invitations ji
        JOIN accounts a ON a.id = ji.account_id
        WHERE ji.invitee_user_id = ? AND ji.status = 'ACCEPTED' AND a.account_kind = 'JOINT'
    `, [user.id]);
    for (const invitation of accepted) {
        const owner = (await db.query(`
            SELECT * FROM account_owners WHERE account_id = ? AND user_id = ?
        `, [invitation.account_id, user.id]))[0];
        if (owner) {
            if (owner.status !== 'ACCEPTED' || owner.role !== 'JOINT_OWNER') {
                await db.query(`
                    UPDATE account_owners SET status = 'ACCEPTED', role = 'JOINT_OWNER' WHERE id = ?
                `, [owner.id]);
            }
        } else {
            await db.query(`
                INSERT INTO account_owners (account_id, user_id, role, status)
                VALUES (?, ?, 'JOINT_OWNER', 'ACCEPTED')
            `, [invitation.account_id, user.id]);
        }
    }
    return user;
}

async function createInvitation(accountId, inviter, data) {
    const account = await accountForOwner(accountId, inviter.id, true);
    const { type, identifier, user } = await findInvitee(data);
    if (user && Number(user.id) === Number(inviter.id)) throw new Error('You already own this account');

    if (user) {
        const existingOwner = (await db.query(`SELECT * FROM account_owners WHERE account_id = ? AND user_id = ?`, [account.id, user.id]))[0];
        if (existingOwner?.status === 'ACCEPTED') throw new Error('This customer already owns the account');
    }

    const existingPending = user
        ? (await db.query(`SELECT id FROM joint_account_invitations WHERE account_id = ? AND invitee_user_id = ? AND status = 'PENDING'`, [account.id, user.id]))[0]
        : (await db.query(`SELECT id FROM joint_account_invitations WHERE account_id = ? AND LOWER(COALESCE(email, '')) = LOWER(?) AND status = 'PENDING'`, [account.id, type === 'EMAIL' ? identifier : '']))[0];
    if (existingPending) throw new Error('A pending invitation already exists');

    const fields = { email: null, phone: null, customer_id: null, username: null };
    fields[type.toLowerCase()] = identifier;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const sql = db.USE_POSTGRES
        ? `INSERT INTO joint_account_invitations (account_id, invited_by, invitee_user_id, email, phone, customer_id, username, requires_kyc, token, status, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?) RETURNING *`
        : `INSERT INTO joint_account_invitations (account_id, invited_by, invitee_user_id, email, phone, customer_id, username, requires_kyc, token, status, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`;
    const result = await db.query(sql, [account.id, inviter.id, user?.id || null, fields.email, fields.phone, fields.customer_id, fields.username, user ? 0 : 1, token, expiresAt]);
    const invitation = db.USE_POSTGRES ? result[0] : (await db.query(`SELECT * FROM joint_account_invitations WHERE token = ?`, [token]))[0];

    if (user) {
        await notifications.createNotification({
            user_id: user.id,
            title: 'Joint account invitation',
            message: `${inviter.first_name} ${inviter.last_name} invited you to share a ${account.account_type.replaceAll('_', ' ').toLowerCase()} account.`,
            type: 'INFO',
            action_link: '/joint-accounts',
            created_by: inviter.id
        });
    }
    const recipientEmail = user?.email || (type === 'EMAIL' ? identifier : null);
    if (recipientEmail) {
        emailService.sendEmail({
            to: recipientEmail,
            subject: 'You are invited to a Blue Crest joint account',
            text: `${inviter.first_name} ${inviter.last_name} invited you to share a Blue Crest ${account.account_type.replaceAll('_', ' ').toLowerCase()} account. Sign in or register with this email, complete KYC, then accept the invitation from Profile > Joint Accounts.`,
            html: `<p><strong>${inviter.first_name} ${inviter.last_name}</strong> invited you to share a Blue Crest ${account.account_type.replaceAll('_', ' ').toLowerCase()} account.</p><p>Sign in or register with this email, complete KYC, then accept the invitation from <strong>Profile &gt; Joint Accounts</strong>.</p>`
        }).catch(() => {});
    }
    return { ...invitation, recipient_registered: Boolean(user) };
}

async function openJointAccount(user, data) {
    const type = normalizeAccountType(data.account_type || 'CHECKING');
    const accountNumber = await generateAccountNumber();
    return db.withTransaction(async () => {
        const sql = db.USE_POSTGRES
            ? `INSERT INTO accounts (account_number, account_type, account_kind, currency, balance) VALUES (?, ?, 'JOINT', ?, 0) RETURNING *`
            : `INSERT INTO accounts (account_number, account_type, account_kind, currency, balance) VALUES (?, ?, 'JOINT', ?, 0)`;
        const result = await db.query(sql, [accountNumber, type, user.preferred_currency || 'USD']);
        const account = db.USE_POSTGRES ? result[0] : (await db.query(`SELECT * FROM accounts WHERE account_number = ?`, [accountNumber]))[0];
        await db.query(`INSERT INTO account_owners (account_id, user_id, role, status) VALUES (?, ?, 'PRIMARY_OWNER', 'ACCEPTED')`, [account.id, user.id]);
        const invitation = data.invite_identifier ? await createInvitation(account.id, user, data) : null;
        return { account, invitation };
    });
}

async function getDashboard(userId) {
    await linkInvitationsAndOwnership(userId);
    await db.query(`UPDATE joint_account_invitations SET status = 'EXPIRED' WHERE status = 'PENDING' AND expires_at < ?`, [new Date().toISOString()]);
    const accounts = await db.query(`
        SELECT a.*, ao.role AS owner_role, ao.status AS owner_status,
               (SELECT COUNT(*) FROM account_owners owners WHERE owners.account_id = a.id AND owners.status = 'ACCEPTED') AS owner_count
        FROM accounts a JOIN account_owners ao ON ao.account_id = a.id
        WHERE ao.user_id = ? AND ao.status = 'ACCEPTED'
        ORDER BY a.created_at ASC
    `, [userId]);

    for (const account of accounts) {
        account.owners = await db.query(`
            SELECT ao.id, ao.user_id, ao.role, ao.status, ao.created_at, u.first_name, u.last_name, u.email, u.username
            FROM account_owners ao JOIN users u ON u.id = ao.user_id
            WHERE ao.account_id = ? ORDER BY CASE WHEN ao.role = 'PRIMARY_OWNER' THEN 0 ELSE 1 END, ao.id
        `, [account.id]);
        account.transactions = await db.query(`
            SELECT t.*, u.first_name AS performed_by_first_name, u.last_name AS performed_by_last_name
            FROM transactions t LEFT JOIN users u ON u.id = COALESCE(t.performed_by, t.created_by, t.user_id)
            WHERE t.account_id = ? ORDER BY t.id DESC LIMIT 100
        `, [account.id]);
        account.invitations = account.owner_role === 'PRIMARY_OWNER' ? await db.query(`
            SELECT ji.*, u.first_name, u.last_name, u.email AS registered_email
            FROM joint_account_invitations ji LEFT JOIN users u ON u.id = ji.invitee_user_id
            WHERE ji.account_id = ? ORDER BY ji.id DESC
        `, [account.id]) : [];
        account.shared_cards = [];
    }

    const receivedInvitations = await db.query(`
        SELECT ji.*, a.account_number, a.account_type, a.currency,
               u.first_name AS inviter_first_name, u.last_name AS inviter_last_name
        FROM joint_account_invitations ji
        JOIN accounts a ON a.id = ji.account_id
        JOIN users u ON u.id = ji.invited_by
        WHERE ji.invitee_user_id = ? ORDER BY ji.id DESC
    `, [userId]);
    return { accounts, received_invitations: receivedInvitations };
}

async function respondToInvitation(invitationId, user, status) {
    const responseStatus = String(status).toUpperCase();
    if (!['ACCEPTED', 'DECLINED'].includes(responseStatus)) throw new Error('Invalid invitation response');
    return db.withTransaction(async () => {
        await linkInvitationsAndOwnership(user.id);
        const invitation = (await db.query(`SELECT * FROM joint_account_invitations WHERE id = ? AND invitee_user_id = ?`, [invitationId, user.id]))[0];
        if (!invitation) throw new Error('Invitation not found');
        if (invitation.status !== 'PENDING') throw new Error(`Invitation is already ${invitation.status.toLowerCase()}`);
        if (new Date(invitation.expires_at).getTime() <= Date.now()) {
            await db.query(`UPDATE joint_account_invitations SET status = 'EXPIRED' WHERE id = ?`, [invitation.id]);
            throw new Error('Invitation has expired');
        }
        if (responseStatus === 'ACCEPTED' && Number(invitation.requires_kyc || 0) === 1 && String(user.kyc_status || '').toUpperCase() !== 'VERIFIED') {
            throw new Error('Complete KYC verification before accepting a joint account invitation');
        }
        await db.query(`UPDATE joint_account_invitations SET status = ?, responded_at = ? WHERE id = ?`, [responseStatus, new Date().toISOString(), invitation.id]);
        if (responseStatus === 'ACCEPTED') {
            const account = (await db.query(`SELECT * FROM accounts WHERE id = ?`, [invitation.account_id]))[0];
            if (!account || account.account_kind !== 'JOINT') throw new Error('Joint account not found');
            const owner = (await db.query(`SELECT * FROM account_owners WHERE account_id = ? AND user_id = ?`, [invitation.account_id, user.id]))[0];
            if (owner) await db.query(`UPDATE account_owners SET status = 'ACCEPTED', role = 'JOINT_OWNER' WHERE id = ?`, [owner.id]);
            else await db.query(`INSERT INTO account_owners (account_id, user_id, role, status) VALUES (?, ?, 'JOINT_OWNER', 'ACCEPTED')`, [invitation.account_id, user.id]);
        }
        await notifications.createNotification({
            user_id: invitation.invited_by,
            title: `Joint account invitation ${responseStatus.toLowerCase()}`,
            message: `${user.first_name} ${user.last_name} ${responseStatus.toLowerCase()} your joint account invitation.`,
            type: responseStatus === 'ACCEPTED' ? 'SUCCESS' : 'WARNING',
            action_link: '/joint-accounts',
            created_by: user.id
        });
        return { ...invitation, status: responseStatus };
    });
}

async function leaveAccount(accountId, user) {
    const account = await accountForOwner(accountId, user.id);
    if (account.owner_role === 'PRIMARY_OWNER') throw new Error('The primary owner cannot leave; transfer or close ownership first');
    await db.query(`UPDATE account_owners SET status = 'LEFT' WHERE account_id = ? AND user_id = ?`, [accountId, user.id]);
    return { left: true };
}

async function fundFromPersonalAccount(accountId, user, data) {
    const account = await accountForOwner(accountId, user.id);
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a valid funding amount');
    if (!user.transfer_pin) throw new Error('Create your transfer PIN before funding a joint account');
    if (!await bcrypt.compare(String(data.pin || ''), user.transfer_pin)) throw new Error('Invalid transfer PIN');
    if (Number(user.balance || 0) < amount) throw new Error('Insufficient personal account balance');

    const reference = ledgerService.generateReference('JNT');
    await db.withTransaction(async () => {
        await ledgerService.postEntry({
            user_id: user.id, reference: `${reference}-OUT`, type: 'DEBIT',
            category: 'joint_account_funding', amount,
            currency: account.currency || user.preferred_currency,
            description: `Transfer to joint account ending ${account.account_number.slice(-4)}`,
            performed_by: user.id
        });
        await ledgerService.postEntry({
            user_id: user.id, account_id: account.id, reference: `${reference}-IN`, type: 'CREDIT',
            category: 'joint_account_funding', amount,
            currency: account.currency || user.preferred_currency,
            description: `${user.first_name} ${user.last_name} funded the joint account`,
            performed_by: user.id
        });
    });

    return {
        account: (await db.query(`SELECT * FROM accounts WHERE id = ?`, [account.id]))[0],
        personal_balance: Number((await db.query(`SELECT balance FROM users WHERE id = ?`, [user.id]))[0].balance)
    };
}

async function removeOwner(accountId, ownerId, user) {
    await accountForOwner(accountId, user.id, true);
    const owner = (await db.query(`SELECT * FROM account_owners WHERE account_id = ? AND id = ?`, [accountId, ownerId]))[0];
    if (!owner) throw new Error('Owner not found');
    if (owner.role === 'PRIMARY_OWNER') throw new Error('The primary owner cannot be removed');
    await db.query(`UPDATE account_owners SET status = 'REMOVED' WHERE id = ?`, [owner.id]);
    await notifications.createNotification({ user_id: owner.user_id, title: 'Joint account access updated', message: 'The primary owner removed you from a joint account.', type: 'WARNING', action_link: '/joint-accounts', created_by: user.id });
    return { removed: true };
}

module.exports = { openJointAccount, getDashboard, createInvitation, respondToInvitation, fundFromPersonalAccount, leaveAccount, removeOwner, normalizeAccountType };
