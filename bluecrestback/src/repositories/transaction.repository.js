const db = require('../database/db');

async function createTransaction(data) {
    const insertSql = db.USE_POSTGRES
        ? `
        INSERT INTO transactions (
            user_id,
            reference,
            type,
            category,
            amount,
            currency,
            status,
            description,
            created_by,
            transaction_date
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,?)
        RETURNING *
        `
        : `
        INSERT INTO transactions (
            user_id,
            reference,
            type,
            category,
            amount,
            currency,
            status,
            description,
            created_by,
            transaction_date
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,?)
        `;

    const result = await db.query(
        insertSql,
        [
            data.user_id,
            data.reference,
            data.type,
            data.category,
            data.amount,
            data.currency || 'USD',
            data.status || 'COMPLETED',
            data.description || '',
            data.created_by || null,
            data.transaction_date || null
        ]
    );

    if (db.USE_POSTGRES) {
        return result[0];
    }

    return getTransactionByReference(data.reference);
}

async function getTransactions() {

    return await db.query(`
        SELECT *
        FROM transactions
        ORDER BY id DESC
    `);
}

async function getUserTransactions(
    userId
) {

    return await db.query(
        `
        SELECT *
        FROM transactions
        WHERE user_id = ?
        ORDER BY id DESC
        `,
        [userId]
    );
}

async function updateTransactionStatus(
    reference,
    status
) {
    await db.query(
        `
        UPDATE transactions
        SET status = ?
        WHERE reference = ?
        `,
        [status, reference]
    );

    return getTransactionByReference(reference);
}

async function getTransactionByReference(reference) {
    const transactions = await db.query(
        `
        SELECT *
        FROM transactions
        WHERE reference = ?
        `,
        [reference]
    );

    return transactions[0];
}

module.exports = {
    createTransaction,
    getTransactions,
    getUserTransactions,
    updateTransactionStatus,
    getTransactionByReference
};
