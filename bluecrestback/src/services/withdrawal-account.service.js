const accountRepository = require('../repositories/withdrawal-account.repository');
const destinationRepository = require('../repositories/withdrawal.repository');

const METHODS = ['PAYPAL', 'SKRILL', 'BANK_TRANSFER', 'CRYPTO_WALLET'];

function publicAccount(row) {
    return {
        ...row,
        linked: Boolean(row.linked),
        details: row.details_json ? JSON.parse(row.details_json) : {},
        details_json: undefined
    };
}

async function link(user, data) {
    if ('password' in data) {
        throw new Error('Third-party passwords are not accepted. Link accounts using an identifier only.');
    }
    const method = String(data.method || '').toUpperCase();
    const username = String(data.username || '').trim();
    if (!METHODS.includes(method)) throw new Error('Unsupported withdrawal account method');
    if (!username) throw new Error('Account email, username, or identifier is required');
    if (['PAYPAL', 'SKRILL'].includes(method) && !username.includes('@')) {
        throw new Error(`Enter a valid ${method === 'PAYPAL' ? 'PayPal' : 'Skrill'} email`);
    }

    const details = data.details && typeof data.details === 'object' ? { ...data.details } : {};
    if (method === 'BANK_TRANSFER') details.account_number = username;
    if (method === 'CRYPTO_WALLET') details.wallet_address = username;
    const destinationDetails = method === 'PAYPAL'
        ? { email: username, account_name: data.display_name || username }
        : method === 'SKRILL'
            ? { email: username, account_name: data.display_name || username }
            : details;

    const destinationMethod = method === 'SKRILL' ? 'PAYPAL' : method;
    const destination = await destinationRepository.createDestination({
        user_id: user.id,
        method: destinationMethod,
        label: data.display_name || `${method.replaceAll('_', ' ')} account`,
        details_json: JSON.stringify(destinationDetails),
        is_preferred: Boolean(data.is_preferred)
    });

    const account = await accountRepository.upsert({
        user_id: user.id,
        method,
        username,
        display_name: data.display_name || username,
        details_json: JSON.stringify(details),
        destination_id: destination.id
    });
    return publicAccount(account);
}

async function unlink(userId, id) {
    const account = await accountRepository.find(id, userId);
    if (!account) throw new Error('Linked withdrawal account not found');
    await accountRepository.unlink(id, userId);
    if (account.destination_id) {
        await destinationRepository.deleteDestination(account.destination_id, userId);
    }
}

module.exports = {
    link,
    unlink,
    list: async userId => (await accountRepository.list(userId)).map(publicAccount)
};
