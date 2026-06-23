const db = require('../database/db');

async function createLoan(data) {
    const insertSql = db.USE_POSTGRES
        ? `
        INSERT INTO loans (
            user_id,
    requested_amount,
    purpose,
    interest_rate,
    repayment_months,
    monthly_payment,
    disbursement_fee,
    fee_status,
    status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        `
        : `
        INSERT INTO loans (
            user_id,
    requested_amount,
    purpose,
    interest_rate,
    repayment_months,
    monthly_payment,
    disbursement_fee,
    fee_status,
    status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    const result = await db.query(
        insertSql,
        [
            data.user_id,
            data.requested_amount,
            data.purpose,
            data.interest_rate || 0,
            data.repayment_months || 12,
            data.monthly_payment || 0,
            data.disbursement_fee || 0,
            data.fee_status || 'UNPAID',
            data.status || 'PENDING'
        ]
    );

    if (db.USE_POSTGRES) {
        return result[0];
    }

    const inserted = await db.query(`SELECT last_insert_rowid() AS id`);

    return await getLoanById(inserted[0].id);
}

async function getLoans() {

    return await db.query(`
        SELECT *
        FROM loans
        ORDER BY id DESC
    `);
}

async function getLoanById(
    loanId
) {

    const loans =
        await db.query(
            `
            SELECT *
            FROM loans
            WHERE id = ?
            `,
            [loanId]
        );

    return loans[0];
}

async function getLoansByUser(
    userId
) {

    return await db.query(
        `
        SELECT *
        FROM loans
        WHERE user_id = ?
        ORDER BY id DESC
        `,
        [userId]
    );
}

async function updateLoanStatus(
    loanId,
    status,
    approvedBy
) {

    await db.query(
        `
        UPDATE loans
        SET
            status = ?,
            approved_by = ?,
            approved_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [
            status,
            approvedBy,
            loanId
        ]
    );

    return await getLoanById(
        loanId
    );
}


async function updateLoanFee(
    loanId,
    feeAmount
) {

    await db.query(
        `
        UPDATE loans
        SET
            disbursement_fee = ?,
            status = 'AWAITING_DISBURSEMENT_FEE'
        WHERE id = ?
        `,
        [
            feeAmount,
            loanId
        ]
    );

    return await getLoanById(
        loanId
    );
}


async function confirmLoanFee(
    loanId
) {

    await db.query(
        `
        UPDATE loans
        SET
            fee_status = 'PAID',
            status = 'READY_FOR_DISBURSEMENT'
        WHERE id = ?
        `,
        [loanId]
    );

    return await getLoanById(
        loanId
    );
}





module.exports = {
    createLoan,
    getLoans,
    getLoanById,
    getLoansByUser,
    updateLoanStatus,
    updateLoanFee,
    confirmLoanFee
};
