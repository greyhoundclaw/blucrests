const Database = require('better-sqlite3');

const db = new Database(process.env.SQLITE_DB_PATH || 'local.db');

db.pragma('foreign_keys = ON');

module.exports = db;
