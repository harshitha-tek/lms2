// Subsystem 15 — Scheduler / Background Jobs. Every action here is attributed
// to SYSTEM in the audit log (Section 3.3 of the FRD). Runs on a cron
// schedule AND is exposed to HR/Admin as a manual "Run now" button so the
// jobs are visible/demonstrable without waiting for real time to pass.
const db = require('../database/db');
const dayjs = require('dayjs');
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

// BR-33 to BR-36: escalation on SLA breach, one level up the reporting
// hierarchy, terminating at the HR/Admin queue. The request stays in
// PENDING_MANAGER (state machine: PENDING_MANAGER -> PENDING_MANAGER); only
// the current approver is reassigned. A request is never auto-decided.
const SLA_TEST_WINDOW_MINUTES = 2; // shortened for demo; production uses Config.slaPeriodDays()

function hrAdminIds() {
  return db.prepare(`
    SELECT ur.user_id FROM user_roles ur
    JOIN roles r ON r.role_id = ur.role_id
    JOIN users u ON u.user_id = ur.user_id
    WHERE r.role_code = 'HR_ADMIN' AND u.is_active = 1
  `).all().map(row => row.user_id);
}

function runSlaEscalation() {
  const cutoff = dayjs().subtract(SLA_TEST_WINDOW_MINUTES, 'minute').format('YYYY-MM-DD HH:mm:ss');
  return runIdempotent('SLA_ESCALATION', `SLA:${dayjs().format('YYYY-MM-DD-HH-mm')}`, () => {
    const breached = db.prepare(`
      SELECT la.*, lr.request_number, lr.employee_id
      FROM leave_approvals la
      JOIN leave_requests lr ON lr.leave_request_id = la.leave_request_id
      WHERE la.is_current = 1 AND la.status = 'PENDING'
        AND la.approval_level = 'MANAGER' AND lr.status = 'PENDING_MANAGER'
        AND la.created_at < ?
    `).all(cutoff);

    const hrIds = hrAdminIds();
    let escalated = 0;

    for (const a of breached) {
      // Walk one level up from the CURRENT approver, skipping the employee.
      const currentApprover = db.prepare(`SELECT user_id, manager_id FROM users WHERE user_id = ?`).get(a.approver_id);
      let nextApproverId = currentApprover ? currentApprover.manager_id : null;
      if (nextApproverId === a.employee_id) {
        const up = db.prepare(`SELECT manager_id FROM users WHERE user_id = ?`).get(nextApproverId);
        nextApproverId = up ? up.manager_id : null;
      }

      // Retire the breached approval first so it can never stay "current".
      db.prepare(`UPDATE leave_approvals SET is_current = 0 WHERE approval_id = ?`).run(a.approval_id);

      const seq = (a.reassignment_seq || 0) + 1;
      const recipients = [];

      if (nextApproverId) {
        db.prepare(`
          INSERT INTO leave_approvals
            (leave_request_id, approval_level, reassignment_seq, approver_id, escalated_from_approval_id, is_current, status)
          VALUES (?, 'MANAGER', ?, ?, ?, 1, 'PENDING')
        `).run(a.leave_request_id, seq, nextApproverId, a.approval_id);
        recipients.push(nextApproverId);
      } else {
        // Hierarchy exhausted -> HR/Admin queue (BR-36).
        for (const hrId of hrIds) {
          db.prepare(`
            INSERT INTO leave_approvals
              (leave_request_id, approval_level, reassignment_seq, approver_id, escalated_from_approval_id, is_current, status)
            VALUES (?, 'HR', ?, ?, ?, 1, 'PENDING')
          `).run(a.leave_request_id, seq, hrId, a.approval_id);
          recipients.push(hrId);
        }
      }

      for (const rid of recipients) {
        Notification.create(rid, 'NEW_REQUEST_FOR_APPROVAL', `Escalated: ${a.request_number}`,
          `${a.request_number} breached its approval SLA and was escalated to you.`, a.leave_request_id);
      }
      // BR-35: the original approver is notified.
      Notification.create(a.approver_id, 'REQUEST_ESCALATED', `Escalated away: ${a.request_number}`,
        `${a.request_number} was pending with you past the SLA and has been escalated.`, a.leave_request_id);

      Audit.log(null, 'leave_approvals', a.approval_id, 'SLA_ESCALATION',
        { is_current: 1, approver_id: a.approver_id },
        { is_current: 0, escalated_to: nextApproverId || hrIds }, true);
      escalated++;
    }
    return { escalated };
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
