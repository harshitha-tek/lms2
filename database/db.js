const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

// Uses Node's BUILT-IN SQLite driver (stable since Node 22.5+/24) instead of
// better-sqlite3, specifically so this app never requires a native compile
// step (node-gyp / Visual Studio Build Tools / Xcode CLT). If your Node
// version is older than 22.5, upgrade Node rather than swapping this back —
// it's the whole point of using node:sqlite here.
const DB_PATH = path.join(__dirname, 'lms.sqlite');
const isFirstRun = !fs.existsSync(DB_PATH);

const rawDb = new DatabaseSync(DB_PATH);
rawDb.exec('PRAGMA foreign_keys = ON');

// Thin wrapper matching the better-sqlite3-style API the rest of the app is
// written against (db.prepare(sql).run/get/all, db.exec, db.transaction),
// so models/controllers didn't need to change when we swapped drivers.
function wrapStatement(stmt) {
  return {
    run: (...args) => {
      const info = stmt.run(...args);
      return { changes: Number(info.changes), lastInsertRowid: Number(info.lastInsertRowid) };
    },
    get: (...args) => stmt.get(...args),
    all: (...args) => stmt.all(...args),
  };
}

const db = {
  exec: (sql) => rawDb.exec(sql),
  prepare: (sql) => wrapStatement(rawDb.prepare(sql)),
  pragma: (str) => rawDb.exec(`PRAGMA ${str}`),
  transaction: (fn) => (...args) => {
    rawDb.exec('BEGIN');
    try {
      const result = fn(...args);
      rawDb.exec('COMMIT');
      return result;
    } catch (err) {
      rawDb.exec('ROLLBACK');
      throw err;
    }
  },
};

if (isFirstRun) {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
  db.exec(schema);
  db.exec(seed);
  console.log('[db] fresh lms.sqlite created from schema.sql + seed.sql (36 tables).');
}

module.exports = db;
