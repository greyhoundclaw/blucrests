require('dotenv').config();

const initializeDatabase = require('../src/database/init');
const db = require('../src/database/db');

(async () => {
    try {
        await initializeDatabase();
        console.log('Development seed completed.');
    } catch (error) {
        console.error('Development seed failed:', error);
        process.exitCode = 1;
    } finally {
        await db.close();
    }
})();
