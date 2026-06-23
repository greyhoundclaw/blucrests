require('dotenv').config();

const initializeDatabase = require('../src/database/init');
const db = require('../src/database/db');

(async () => {
    try {
        await initializeDatabase();
        console.log('Database migration/bootstrap completed.');
    } catch (error) {
        console.error('Database migration/bootstrap failed:', error);
        process.exitCode = 1;
    } finally {
        await db.close();
    }
})();
