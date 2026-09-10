const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const db = require('./db');

const sqlite = new DatabaseSync(path.join(__dirname, 'lms.sqlite'));
const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map(row => row.name);
const missing = [];

for (const table of tables) {
  const sqliteColumns = sqlite.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
  const mysqlColumns = db.prepare(`SHOW COLUMNS FROM ${table}`).all().map(row => row.Field);
  const absent = sqliteColumns.filter(column => !mysqlColumns.includes(column));
  if (absent.length) missing.push({ table, columns: absent.join(', ') });
}

if (missing.length) {
  console.table(missing);
  process.exitCode = 1;
} else {
  console.log('MySQL contains every application column from the SQLite schema.');
}
