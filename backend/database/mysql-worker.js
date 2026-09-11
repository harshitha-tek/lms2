require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const input = await new Promise(resolve => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(JSON.parse(data)));
  });
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE, multipleStatements: input.action === 'exec',
    decimalNumbers: true,
    // Pure DATE columns (start_date, end_date, holiday_date, joined_date,
    // effective_from/to, ...) must come back as the plain 'YYYY-MM-DD'
    // string MySQL holds, not a JS Date. Letting mysql2 hand back a Date
    // object here means it gets constructed at local midnight and then
    // re-serialized to UTC by JSON.stringify, shifting the date backward
    // by the server's UTC offset (a full day off in IST). Scoped to DATE
    // only so DATETIME/TIMESTAMP audit columns (created_at, decided_at...)
    // are unaffected.
    dateStrings: ['DATE'],
  });
  const [rows] = await connection.query(input.sql, input.params);
  await connection.end();
  if (input.action === 'run') {
    process.stdout.write(JSON.stringify({ changes: Number(rows.affectedRows || 0), lastInsertRowid: Number(rows.insertId || 0) }));
  } else if (input.action === 'get') {
    process.stdout.write(JSON.stringify(Array.isArray(rows) ? (rows[0] || null) : rows));
  } else {
    process.stdout.write(JSON.stringify(rows));
  }
}

main().catch(error => { process.stderr.write(error.stack || error.message); process.exit(1); });
