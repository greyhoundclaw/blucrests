const db = require('../database/db');

async function createUser(userData) {

    await db.query(
        `
        INSERT INTO users (
            account_number,

            first_name,
            last_name,
            username,

            email,
            phone,
            password,

            email_verified,

            gender,
            date_of_birth,

            country,
            state,
            zip_code,

            marital_status,

            occupation,
            address,

            government_id_number,

            profile_image,

            preferred_currency,

            balance,

            transfer_pin,
            transfer_flow,
            status,

            role
        )
        VALUES (
           ?,?,?,?,?,?,?,?,?,?,
    ?,?,?,?,?,?,?,?,?,?,
    ?,?,?,?
        )
        `,
        [
            userData.account_number,

            userData.first_name,
            userData.last_name,
            userData.username,

            userData.email,
            userData.phone,

            userData.password,

            userData.email_verified,

            userData.gender,
            userData.date_of_birth,

            userData.country,
            userData.state,
            userData.zip_code,

            userData.marital_status,

            userData.occupation,
            userData.address,

            userData.government_id_number,

            userData.profile_image,

            userData.preferred_currency,

            userData.balance,

            userData.transfer_pin,

            userData.transfer_flow || 'PENDING',

            userData.status,

            userData.role
        ]
    );

    return findUserByEmail(
        userData.email
    );
}

async function findUserByEmail(email) {

    const users = await db.query(
        `
        SELECT * FROM users
        WHERE email = ?
        `,
        [email]
    );

    return users[0];
}

async function findUserById(id) {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) return null;

    const users = await db.query(
        `
        SELECT * FROM users
        WHERE id = ?
        `,
        [parsedId]
    );

    return users[0];
}

async function getAllUsers() {

    return await db.query(
        `
        SELECT *
        FROM users
        ORDER BY id DESC
        `
    );
}

async function updateUserBalance(
    userId,
    balance
) {
    const parsedId = parseInt(userId, 10);
    await db.query(
        `
        UPDATE users
        SET balance = ?
        WHERE id = ?
        `,
        [balance, parsedId]
    );

    const users = await db.query(
        `
        SELECT *
        FROM users
        WHERE id = ?
        `,
        [parsedId]
    );

    return users[0];
}

async function incrementBalance(
    userId,
    amount
) {
    const parsedId = parseInt(userId, 10);
    await db.query(
        `
        UPDATE users
        SET balance = balance + ?
        WHERE id = ?
        `,
        [amount, parsedId]
    );

    return await findUserById(
        parsedId
    );
}



async function updateUser(
    userId,
    data
) {
    const parsedId = parseInt(userId, 10);
    await db.query(
        `
        UPDATE users
        SET
            first_name = ?,
            last_name = ?,
            username = ?,
            email = ?,
            phone = ?,
            gender = ?,
            date_of_birth = ?,
            country = ?,
            state = ?,
            zip_code = ?,
            marital_status = ?,
            occupation = ?,
            address = ?,
            government_id_number = ?,
            preferred_currency = ?,
            balance = ?,
            status = ?,
            profile_image = ?,
            two_factor_enabled = ?
        WHERE id = ?
        `,
        [
            data.first_name,
            data.last_name,
            data.username,
            data.email,
            data.phone,
            data.gender,
            data.date_of_birth,
            data.country,
            data.state,
            data.zip_code,
            data.marital_status,
            data.occupation,
            data.address,
            data.government_id_number,
            data.preferred_currency,
            data.balance,
            data.status,
            data.profile_image !== undefined ? data.profile_image : null,
            data.two_factor_enabled !== undefined ? (data.two_factor_enabled ? 1 : 0) : 0,
            parsedId
        ]
    );

    const users = await db.query(
        `
        SELECT *
        FROM users
        WHERE id = ?
        `,
        [parsedId]
    );

    return users[0];
}

async function updateUserPassword(
    userId,
    hashedPassword,
    forcePasswordChange = false
) {
    const parsedId = parseInt(userId, 10);
    await db.query(
        `
        UPDATE users
        SET password = ?, force_password_change = ?, password_changed_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [hashedPassword, forcePasswordChange ? 1 : 0, parsedId]
    );
}

async function setForcePasswordChange(userId, value) {
    await db.query(
        `UPDATE users SET force_password_change = ? WHERE id = ?`,
        [value ? 1 : 0, parseInt(userId, 10)]
    );
    return findUserById(userId);
}

async function updateTransferPin(
    userId,
    hashedPin
) {
    const parsedId = parseInt(userId, 10);
    await db.query(
        `
        UPDATE users
        SET transfer_pin = ?
        WHERE id = ?
        `,
        [
            hashedPin,
            parsedId
        ]
    );

    const users =
        await db.query(
            `
            SELECT *
            FROM users
            WHERE id = ?
            `,
            [parsedId]
        );

    return users[0];
}

async function submitKyc(
    userId,
    data
) {
    const parsedId = parseInt(userId, 10);
    await db.query(
        `
        UPDATE users
        SET
            government_id_number = ?,
            id_front_image = ?,
            id_back_image = ?,
            kyc_status = 'PENDING'
        WHERE id = ?
        `,
        [
            data.government_id_number,
            data.id_front_image,
            data.id_back_image,
            parsedId
        ]
    );

    return await findUserById(
        parsedId
    );
}

async function updateKycStatus(
    userId,
    status
) {
    const parsedId = parseInt(userId, 10);
    await db.query(
        `
        UPDATE users
        SET
            kyc_status = ?
        WHERE id = ?
        `,
        [
            status,
            parsedId
        ]
    );

    return await findUserById(
        parsedId
    );
}



async function findUserByAccountNumber(
    accountNumber
) {

    const users =
        await db.query(
            `
            SELECT *
            FROM users
            WHERE account_number = ?
            `,
            [accountNumber]
        );

    return users[0];
}

async function updateTransferFlow(
    userId,
    transferFlow
) {
    const parsedId = parseInt(userId, 10);
    await db.query(
        `
        UPDATE users
        SET transfer_flow = ?
        WHERE id = ?
        `,
        [
            transferFlow,
            parsedId
        ]
    );

    const users =
        await db.query(
            `
            SELECT *
            FROM users
            WHERE id = ?
            `,
            [parsedId]
        );

    return users[0];
}

async function updateUserRole(
    userId,
    role
) {
    const parsedId = parseInt(userId, 10);
    await db.query(
        `
        UPDATE users
        SET role = ?
        WHERE id = ?
        `,
        [role, parsedId]
    );

    const users = await db.query(
        `
        SELECT *
        FROM users
        WHERE id = ?
        `,
        [parsedId]
    );

    return users[0];
}



async function deleteUser(userId) {
    const parsedId = parseInt(userId, 10);
    await db.query(
        `DELETE FROM users WHERE id = ?`,
        [parsedId]
    );
}

module.exports = {
    createUser,
    findUserByEmail,
    findUserById,
    getAllUsers,
    updateUserBalance,
    updateUser,
    updateTransferPin,
    updateUserPassword,
    setForcePasswordChange,
    findUserByAccountNumber,
    updateTransferFlow,
    incrementBalance,
    submitKyc,
    updateKycStatus,
    deleteUser
};
