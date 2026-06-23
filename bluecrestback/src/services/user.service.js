const bcrypt = require('bcrypt');

const userRepository =
    require('../repositories/user.repository');

const ledgerService =
    require('./ledger.service');

function generateAccountNumber() {

    return Math.floor(
        1000000000 +
        Math.random() * 9000000000
    ).toString();
}

async function generateUniqueAccountNumber() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const accountNumber = generateAccountNumber();
        const existing = await userRepository.findUserByAccountNumber(accountNumber);

        if (!existing) {
            return accountNumber;
        }
    }

    throw new Error('Unable to generate a unique account number');
}

async function registerUser(userData) {

    const existingUser =
        await userRepository
            .findUserByEmail(
                userData.email
            );

    if (existingUser) {
        throw new Error(
            'Email already exists'
        );
    }

    const hashedPassword =
        await bcrypt.hash(
            userData.password,
            10
        );

    const accountNumber = await generateUniqueAccountNumber();

    const user =
        await userRepository
            .createUser({

                account_number:
                    accountNumber,

                first_name:
                    userData.first_name,

                last_name:
                    userData.last_name,

                username:
                    userData.username,

                email:
                    userData.email,

                phone:
                    userData.phone,

                password:
                    hashedPassword,

                gender:
                    userData.gender,

                date_of_birth:
                    userData.date_of_birth,

                country:
                    userData.country,

                state:
                    userData.state,

                zip_code:
                    userData.zip_code,

                marital_status:
                    userData.marital_status,

                occupation:
                    userData.occupation,

                address:
                    userData.address,

                government_id_number:
                    userData.government_id_number,

                profile_image:
                    userData.profile_image || '',

                preferred_currency:
                    userData.preferred_currency || 'USD',

                balance: 0,

                email_verified: 0,

                transfer_pin: null,

                transfer_flow:
                    userData.transfer_flow || 'PENDING',

                status: 'ACTIVE',

                role: 'USER'
            });

    delete user.password;

    return user;
}

async function fetchUsers() {

    const users =
        await userRepository
            .getAllUsers();

    return users.map(user => {

        user.transfer_pin_set = Boolean(user.transfer_pin);
        delete user.password;
        delete user.transfer_pin;

        return user;
    });
}

async function changeUserBalance(
    userId,
    balance
) {
    const currentUser = await userRepository.findUserById(userId);
    if (!currentUser) {
        throw new Error('User not found');
    }

    const targetBalance = Number(balance);
    const isDeposit = targetBalance > Number(currentUser.balance);

    const result = await ledgerService
        .adjustBalanceTo(
            userId,
            targetBalance,
            {
                category: isDeposit ? 'deposit' : 'account_debit',
                description: isDeposit ? 'Account Deposit' : 'Account Debit'
            }
        );

    return result.user;
}
async function setTransferPin(
    userId,
    pin
) {

    if (!pin) {
        throw new Error(
            'Transfer PIN is required'
        );
    }

    if (pin.length < 4) {
        throw new Error(
            'Transfer PIN must be at least 4 digits'
        );
    }

    const hashedPin =
        await bcrypt.hash(
            pin,
            10
        );

    const user =
        await userRepository
            .updateTransferPin(
                userId,
                hashedPin
            );

    user.transfer_pin_set = Boolean(user.transfer_pin);
    delete user.password;
    delete user.transfer_pin;

    return user;
}


async function changeTransferFlow(
    userId,
    transferFlow
) {

    return await userRepository
        .updateTransferFlow(
            userId,
            transferFlow
        );
}

async function changeUserRole(
    userId,
    role
) {
    return await userRepository
        .updateUserRole(
            userId,
            role
        );
}

async function submitKyc(
    userId,
    data
) {

    if (
        !data.government_id_number
    ) {

        throw new Error(
            'Government ID number is required'
        );
    }

    if (
        !data.id_front_image
    ) {

        throw new Error(
            'Front ID image is required'
        );
    }

    if (
        !data.id_back_image
    ) {

        throw new Error(
            'Back ID image is required'
        );
    }

    return await userRepository
        .submitKyc(
            userId,
            data
        );
}

async function updateKycStatus(
    userId,
    status
) {

    return await userRepository
        .updateKycStatus(
            userId,
            status
        );
}

async function updateUser(userId, data) {
    const existing = await userRepository.findUserById(userId);
    if (!existing) {
        throw new Error('User not found');
    }
    const merged = {
        first_name: data.first_name !== undefined ? data.first_name : existing.first_name,
        last_name: data.last_name !== undefined ? data.last_name : existing.last_name,
        username: data.username !== undefined ? data.username : existing.username,
        email: data.email !== undefined ? data.email : existing.email,
        phone: data.phone !== undefined ? data.phone : existing.phone,
        gender: data.gender !== undefined ? data.gender : existing.gender,
        date_of_birth: data.date_of_birth !== undefined ? data.date_of_birth : existing.date_of_birth,
        country: data.country !== undefined ? data.country : existing.country,
        state: data.state !== undefined ? data.state : existing.state,
        zip_code: data.zip_code !== undefined ? data.zip_code : existing.zip_code,
        marital_status: data.marital_status !== undefined ? data.marital_status : existing.marital_status,
        occupation: data.occupation !== undefined ? data.occupation : existing.occupation,
        address: data.address !== undefined ? data.address : existing.address,
        government_id_number: data.government_id_number !== undefined ? data.government_id_number : existing.government_id_number,
        preferred_currency: data.preferred_currency !== undefined ? data.preferred_currency : existing.preferred_currency,
        balance: existing.balance,
        status: data.status !== undefined ? data.status : existing.status,
        profile_image: data.profile_image !== undefined ? data.profile_image : existing.profile_image,
        two_factor_enabled: data.two_factor_enabled !== undefined ? (data.two_factor_enabled ? 1 : 0) : existing.two_factor_enabled
    };
    await userRepository.updateUser(userId, merged);

    if (data.balance !== undefined && data.balance !== null && data.balance !== existing.balance) {
        await changeUserBalance(userId, data.balance);
    }

    if (data.password !== undefined && data.password !== null && data.password !== '') {
        const hashedPassword = await bcrypt.hash(data.password, 10);
        await userRepository.updateUserPassword(userId, hashedPassword);
    }

    if (data.transfer_pin !== undefined && data.transfer_pin !== null && data.transfer_pin !== '') {
        if (data.transfer_pin.length < 4) {
            throw new Error('Transfer PIN must be at least 4 digits');
        }
        const hashedPin = await bcrypt.hash(data.transfer_pin, 10);
        await userRepository.updateTransferPin(userId, hashedPin);
    }

    if (data.transfer_flow !== undefined && data.transfer_flow !== null && data.transfer_flow !== '') {
        await userRepository.updateTransferFlow(userId, data.transfer_flow.toUpperCase());
    }

    const updated = await userRepository.findUserById(userId);
    if (updated) {
        updated.transfer_pin_set = Boolean(updated.transfer_pin);
        delete updated.password;
        delete updated.transfer_pin;
    }
    return updated;
}

async function deleteUser(userId) {
    return await userRepository.deleteUser(userId);
}

async function lookupUserByAccountNumber(accountNumber) {
    const user = await userRepository.findUserByAccountNumber(accountNumber);
    if (!user) {
        return null;
    }
    return {
        id: user.id,
        account_number: user.account_number,
        first_name: user.first_name,
        last_name: user.last_name
    };
}

module.exports = {
    registerUser,
    fetchUsers,
    changeUserBalance,
    setTransferPin,
    changeTransferFlow,
    changeUserRole,
    submitKyc,
    updateKycStatus,
    updateUser,
    deleteUser,
    lookupUserByAccountNumber
};
