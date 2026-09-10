const fs = require('fs');
const db = require('./db');

function ensureColumn(table, column, definition) {
  const exists = db.prepare('SELECT 1 AS present FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?').get(table, column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

ensureColumn('users', 'full_name', "full_name VARCHAR(255) NOT NULL DEFAULT '' AFTER email");
ensureColumn('users', 'employee_type', "employee_type VARCHAR(20) NOT NULL DEFAULT 'EMPLOYEE'");
ensureColumn('users', 'phone_number', 'phone_number VARCHAR(40) NULL');
ensureColumn('users', 'personal_email', 'personal_email VARCHAR(255) NULL');
ensureColumn('users', 'profile_image', 'profile_image VARCHAR(255) NULL');
ensureColumn('holidays', 'holiday_type', "holiday_type VARCHAR(20) NOT NULL DEFAULT 'NATIONAL'");
ensureColumn('leave_types', 'allows_half_day', 'allows_half_day BOOLEAN NOT NULL DEFAULT TRUE');
ensureColumn('leave_types', 'carry_forward_allowed', 'carry_forward_allowed BOOLEAN NOT NULL DEFAULT FALSE');
ensureColumn('leave_types', 'carry_forward_cap', 'carry_forward_cap DECIMAL(6,2) NULL');
ensureColumn('leave_requests', 'start_date', 'start_date DATE NULL');
ensureColumn('leave_requests', 'end_date', 'end_date DATE NULL');
ensureColumn('leave_requests', 'is_half_day', 'is_half_day BOOLEAN NOT NULL DEFAULT FALSE');
ensureColumn('leave_requests', 'half_day_part', 'half_day_part VARCHAR(20) NULL');
ensureColumn('leave_requests', 'deducted_days', 'deducted_days DECIMAL(6,2) NOT NULL DEFAULT 0');
ensureColumn('leave_requests', 'reason', 'reason TEXT NULL');
ensureColumn('leave_requests', 'submitted_at', 'submitted_at DATETIME NULL');
ensureColumn('leave_approvals', 'decision_reason', 'decision_reason TEXT NULL');
ensureColumn('leave_approvals', 'created_at', 'created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
ensureColumn('watchers', 'effective_from', 'effective_from DATE NULL');
ensureColumn('watchers', 'effective_to', 'effective_to DATE NULL');
ensureColumn('notifications', 'subject', "subject VARCHAR(255) NOT NULL DEFAULT ''");
ensureColumn('notifications', 'body', "body TEXT NOT NULL");
ensureColumn('scheduler_executions', 'detail', 'detail TEXT NULL');
const seed = fs.readFileSync(require('path').join(__dirname, 'seed.sql'), 'utf8').replace(/INSERT INTO/gi, 'INSERT IGNORE INTO');
db.exec(seed);
console.log('MySQL schema compatibility columns and reference data are ready.');
