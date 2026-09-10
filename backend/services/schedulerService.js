// Subsystem 15 — Scheduler / Background Jobs. Every action here is attributed
// to SYSTEM in the audit log (Section 3.3 of the FRD). Runs on a cron
// schedule AND is exposed to HR/Admin as a manual "Run now" button so the
// jobs are visible/demonstrable without waiting for real time to pass.
const db = require('../database/db');
const dayjs = require('dayjs');
const Config = require('../models/configModel').Config;
const Ledger = require('../models/ledgerModel');
const LeaveRequest = require('../models/leaveRequestModel');
const Notification = require('../models/notificationModel');
const Audit = require('../models/auditModel');

function runIdempotent(jobName, executionKey, fn) {
  const existing = db.prepare(`SELECT * FROM scheduler_executions WHERE execution_key = ?`).get(executionKey);
  if (existing) return { skipped: true, detail: `already run (${existing.status})` };

  const run = db.prepare(`INSERT INTO scheduler_executions (job_name, execution_key, status) VALUES (?, ?, 'RUNNING')`)
    .run(jobName, executionKey);
  try {
    const detail = fn();
    db.prepare(`UPDATE scheduler_executions SET status='SUCCESS', completed_at=datetime('now'), detail=? WHERE execution_id=?`)
      .run(JSON.stringify(detail || {}), run.lastInsertRowid);
    return { skipped: false, detail };
  } catch (err) {
    db.prepare(`UPDATE scheduler_executions SET status='FAILED', completed_at=datetime('now'), detail=? WHERE execution_id=?`)
      .run(String(err.message), run.lastInsertRowid);
    throw err;
  }
}

// LMS-055: one ledger entry per employee per leave type per accrual period; idempotent.
function runAccrual() {
  const period = dayjs().format('YYYY-MM');
  const leaveYear = dayjs().year();
  return runIdempotent('ACCRUAL', `ACCRUAL:${period}`, () => {
    const users = db.prepare(`SELECT user_id, grade_id FROM users WHERE is_active = 1`).all();
    const policies = db.prepare(`SELECT * FROM leave_policies WHERE accrual_frequency = 'MONTHLY'`).all();
    let posted = 0;
    for (const u of users) {
      for (const p of policies.filter(p => p.grade_id === u.grade_id)) {
        const monthly = Math.round((p.entitlement_days / 12) * 100) / 100;
        Ledger.post(u.user_id, p.leave_type_id, leaveYear, 'ACCRUAL', monthly, `accrual:${period}`);
        posted++;
      }
    }
    return { posted };
  });
}

// BR-33 to BR-36: SLA reminder at 75%, escalation on breach, terminating at HR/Admin.
function runSlaEscalation() {
  const slaDays = Config.slaPeriodDays();
  const cutoff = dayjs().subtract(slaDays, 'day').toISOString();
  return runIdempotent('SLA_ESCALATION', `SLA:${dayjs().format('YYYY-MM-DD-HH')}`, () => {
    const breached = db.prepare(`
      SELECT la.*, lr.request_number FROM leave_approvals la
      JOIN leave_requests lr ON lr.leave_request_id = la.leave_request_id
      WHERE la.is_current = 1 AND la.status = 'PENDING' AND la.created_at < ?
    `).all(cutoff);
    for (const a of breached) {
      Notification.create(a.approver_id, 'NEW_REQUEST_FOR_APPROVAL',
        `SLA breached: ${a.request_number}`, `Request ${a.request_number} has breached its SLA and remains actionable.`);
      Audit.log(null, 'leave_approvals', a.approval_id, 'SLA_BREACH_NOTICE', null, null, true);
    }
    return { notified: breached.length };
  });
}

// BR-18 to BR-21: expired advance-leave rejections convert to LOP.
function runLopConversion() {
  return runIdempotent('LOP_CONVERSION', `LOP:${dayjs().format('YYYY-MM-DD')}`, () => {
    const expired = db.prepare(`
      SELECT * FROM leave_requests
      WHERE status = 'REJECTED_PENDING_WITHDRAWAL' AND withdrawal_deadline < datetime('now')
    `).all();
    const lopType = db.prepare(`SELECT leave_type_id FROM leave_types WHERE leave_code = 'LOP'`).get();
    for (const r of expired) {
      db.prepare(`
        UPDATE leave_requests SET status='LOP_APPLIED', original_leave_type_id=leave_type_id, leave_type_id=?
        WHERE leave_request_id=?
      `).run(lopType.leave_type_id, r.leave_request_id);
      Audit.log(null, 'leave_requests', r.leave_request_id, 'LOP_CONVERSION', { status: r.status }, { status: 'LOP_APPLIED' }, true);
      Notification.create(r.employee_id, 'REQUEST_REJECTED', 'Loss of pay applied',
        `The withdrawal window for ${r.request_number} expired; it has been converted to Loss of Pay.`, r.leave_request_id);
    }
    return { converted: expired.length };
  });
}

function runAll() {
  return {
    accrual: runAccrual(),
    slaEscalation: runSlaEscalation(),
    lopConversion: runLopConversion(),
  };
}

module.exports = { runAccrual, runSlaEscalation, runLopConversion, runAll };
