const db = require('../database/db');

async function reconcileUser(userId) {
    const users = await db.query(
        `SELECT id, account_number, email, balance FROM users WHERE id = ?`,
        [userId]
    );
    const user = users[0];

    if (!user) {
        throw new Error('User not found');
    }

    const totals = await db.query(
        `SELECT
            COALESCE(SUM(CASE WHEN type = 'CREDIT' AND status = 'COMPLETED' THEN amount ELSE 0 END), 0) AS credits,
            COALESCE(SUM(CASE WHEN type = 'DEBIT' AND status = 'COMPLETED' THEN amount ELSE 0 END), 0) AS debits
         FROM transactions
         WHERE user_id = ?`,
        [userId]
    );

    const credits = Number(totals[0].credits || 0);
    const debits = Number(totals[0].debits || 0);
    const expectedBalance = credits - debits;
    const actualBalance = Number(user.balance || 0);

    return {
        user_id: user.id,
        account_number: user.account_number,
        email: user.email,
        actual_balance: actualBalance,
        expected_balance: expectedBalance,
        difference: actualBalance - expectedBalance,
        reconciled: Math.abs(actualBalance - expectedBalance) < 0.000001
    };
}

async function reconcileAll() {
    const users = await db.query(`SELECT id FROM users ORDER BY id`);
    return Promise.all(users.map(user => reconcileUser(user.id)));
}

module.exports = {
    reconcileUser,
    reconcileAll
};
