const crypto = require('crypto');
const repository = require('../repositories/withdrawal.repository');
const notificationRepository = require('../repositories/notification.repository');
const ledgerService = require('./ledger.service');
const db = require('../database/db');

const METHODS = ['BANK_TRANSFER', 'CRYPTO_WALLET', 'PAYPAL', 'CARD'];
const FORBIDDEN_CREDENTIAL_FIELDS = new Set([
    'password',
    'bank_password',
    'paypal_password',
    'passcode',
    'pin',
    'card_pin',
    'cvv',
    'cvc',
    'security_code',
    'card_number',
    'full_card_number'
]);

function validateDestination(method, details) {
    if (!METHODS.includes(method)) throw new Error('Unsupported withdrawal method');
    if (!details || typeof details !== 'object') throw new Error('Destination details are required');
    const required = {
        BANK_TRANSFER: ['account_holder_name', 'bank_name', 'account_number', 'country'],
        CRYPTO_WALLET: ['asset', 'network', 'wallet_address'],
        PAYPAL: ['email'],
        CARD: ['cardholder_name', 'last_four', 'provider_reference']
    }[method];
    for (const field of required) {
        if (!String(details[field] || '').trim()) throw new Error(`${field.replaceAll('_', ' ')} is required`);
    }
    if (method === 'PAYPAL' && !String(details.email).includes('@')) throw new Error('Enter a valid PayPal email');
    if (method === 'CARD' && !/^\d{4}$/.test(String(details.last_four))) throw new Error('Card last four must contain four digits');
    const forbidden = Object.keys(details).find(field =>
        FORBIDDEN_CREDENTIAL_FIELDS.has(String(field).toLowerCase())
    );
    if (forbidden) {
        throw new Error('Passwords, PINs, CVVs and full card numbers must not be collected or stored');
    }
}

function serializeDestination(row) {
    return row ? { ...row, details: JSON.parse(row.details_json), details_json: undefined } : row;
}

async function saveDestination(user, data, id) {
    const method = String(data.method || '').toUpperCase();
    validateDestination(method, data.details);
    if (id) {
        const existing = await repository.getDestination(id);
        if (!existing || Number(existing.user_id) !== Number(user.id)) {
            throw new Error('Withdrawal destination not found');
        }
    }
    const payload = {
        user_id: user.id,
        method,
        label: String(data.label || method.replaceAll('_', ' ')).trim(),
        details_json: JSON.stringify(data.details),
        is_preferred: Boolean(data.is_preferred)
    };
    const row = id
        ? await repository.updateDestination(id, user.id, payload)
        : await repository.createDestination(payload);
    return serializeDestination(row);
}

async function requestWithdrawal(user, data) {
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Withdrawal amount must be greater than zero');
    if (amount > Number(user.balance)) throw new Error('Withdrawal amount exceeds available balance');
    const destination = await repository.getDestination(data.destination_id);
    if (!destination || Number(destination.user_id) !== Number(user.id)) throw new Error('Withdrawal destination not found');
    const reference = `WDL-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const request = await repository.createRequest({
        user_id: user.id,
        destination_id: destination.id,
        method: destination.method,
        amount,
        currency: user.preferred_currency || 'USD',
        destination_snapshot_json: destination.details_json,
        reference,
        note: String(data.note || '').trim()
    });
    return { ...request, destination: JSON.parse(request.destination_snapshot_json), destination_snapshot_json: undefined };
}

async function updateStatus(admin, id, status) {
    const allowed = ['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED', 'FAILED'];
    const normalized = String(status || '').toUpperCase();
    if (!allowed.includes(normalized)) throw new Error('Invalid withdrawal status');
    const current = await repository.getRequest(id);
    if (!current) throw new Error('Withdrawal request not found');
    if (current.status === 'COMPLETED' && normalized === 'COMPLETED') return current;
    const request = await db.withTransaction(async () => {
        const existing = await repository.getRequest(id);
        if (existing.status === 'COMPLETED') {
            throw new Error('Completed withdrawals cannot be changed');
        }
        if (normalized === 'COMPLETED') {
            await ledgerService.postEntry({
                user_id: existing.user_id,
                reference: `TXN-WDL-${existing.id}-DEBIT`,
                type: 'DEBIT',
                category: 'withdrawal',
                amount: existing.amount,
                currency: existing.currency,
                status: 'COMPLETED',
                description: `Withdrawal ${existing.reference}`,
                created_by: admin.id
            });
        }
        return repository.updateRequestStatus(id, normalized, admin.id);
    });
    await notificationRepository.createNotification({
        user_id: request.user_id,
        title: 'Withdrawal update',
        message: `Withdrawal ${request.reference} is now ${normalized.toLowerCase()}.`,
        type: normalized === 'COMPLETED' ? 'SUCCESS' : normalized === 'REJECTED' ? 'WARNING' : 'INFO',
        action_link: '/withdrawals',
        created_by: admin.id
    });
    return request;
}

module.exports = {
    listDestinations: async userId => (await repository.listDestinations(userId)).map(serializeDestination),
    saveDestination,
    deleteDestination: repository.deleteDestination,
    requestWithdrawal,
    listRequests: async userId => (await repository.listRequests(userId)).map(row => ({
        ...row, destination: JSON.parse(row.destination_snapshot_json), destination_snapshot_json: undefined
    })),
    listAllRequests: repository.listAllRequests,
    updateStatus
};
