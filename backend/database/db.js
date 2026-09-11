const path = require('path');
const { spawnSync } = require('child_process');

// Keep the existing synchronous model interface while routing every operation
// to the MySQL database configured in .env.
const worker = path.join(__dirname, 'mysql-worker.js');

function mysql(action, sql, params = []) {
  const result = spawnSync(process.execPath, [worker], {
    input: JSON.stringify({ action, sql, params }), encoding: 'utf8', env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || 'MySQL query failed.');
  return JSON.parse(result.stdout);
}

function normalize(sql) {
  return sql
    .replace(/datetime\('now'\)/gi, 'NOW()')
    .replace(/\bdate\('now'\)/gi, 'CURDATE()')
    .replace(/INSERT OR IGNORE/gi, 'INSERT IGNORE');
}

const db = {
  exec: sql => mysql('exec', normalize(sql)),
  prepare: sql => ({
    run: (...params) => mysql('run', normalize(sql), params),
    get: (...params) => mysql('get', normalize(sql), params),
    all: (...params) => mysql('all', normalize(sql), params),
  }),
  pragma: () => undefined,
  transaction: fn => (...args) => fn(...args),
};

db.prepare('SELECT 1 AS connected').get();

module.exports = db;
