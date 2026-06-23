require('dotenv').config();

const reconciliationService = require('../src/services/reconciliation.service');
const sqlite = require('../src/database/sqlite');

(async () => {
    try {
        const results = await reconciliationService.reconcileAll();
        const mismatches = results.filter(result => !result.reconciled);

        console.table(results);

        if (mismatches.length > 0) {
            console.error(`Ledger reconciliation found ${mismatches.length} mismatch(es).`);
            process.exitCode = 1;
        } else {
            console.log(`Ledger reconciliation passed for ${results.length} user(s).`);
        }
    } catch (error) {
        console.error('Ledger reconciliation failed:', error);
        process.exitCode = 1;
    } finally {
        if (!process.env.DATABASE_URL) {
            sqlite.close();
        }
    }
})();
