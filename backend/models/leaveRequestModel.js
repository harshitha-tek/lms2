const db = require('../database/db');

// Permitted transitions, exactly as specified in the FRD's state machine (Section 5.11).
// Implementations must not invent, rename, merge or add states.
const TRANSITIONS = {
  DRAFT: ['PENDING_MANAGER'],
  PENDING_MANAGER: ['APPROVED', 'PENDING_HR', 'REJECTED', 'REJECTED_PENDING_WITHDRAWAL', 'WITHDRAWN'],
  PENDING_HR: ['APPROVED', 'REJECTED', 'REJECTED_PENDING_WITHDRAWAL', 'WITHDRAWN'],
  REJECTED_PENDING_WITHDRAWAL: ['WITHDRAWN', 'LOP_APPLIED'],
  APPROVED: ['CANCELLATION_REQUESTED'],
  CANCELLATION_REQUESTED: ['CANCELLED', 'APPROVED'],
};

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

const LeaveRequest = {
  TRANSITIONS,
  canTransition,

  nextRequestNumber() {
    const row = db.prepare(`SELECT COUNT(*) AS c FROM leave_requests`).get();
    return `LR-${String(row.c + 1).padStart(5, '0')}`;
  },

  findById(id) {
    return db.prepare(`
      SELECT lr.*, lt.leave_name, lt.is_sick_leave, u.full_name AS employee_name, u.manager_id
      FROM leave_requests lr
      JOIN leave_types lt ON lt.leave_type_id = lr.leave_type_id
      JOIN users u ON u.user_id = lr.employee_id
      WHERE lr.leave_request_id = ?
    `).get(id);
  },

  forEmployee(employeeId) {
    return db.prepare(`
      SELECT lr.*, lt.leave_name FROM leave_requests lr
      JOIN leave_types lt ON lt.leave_type_id = lr.leave_type_id
      WHERE lr.employee_id = ? ORDER BY lr.created_at DESC
    `).all(employeeId);
  },

  overlapping(employeeId, startDate, endDate) {
    return db.prepare(`
      SELECT * FROM leave_requests
      WHERE employee_id = ?
      AND status IN ('PENDING_MANAGER','PENDING_HR','APPROVED','CANCELLATION_REQUESTED')
      AND NOT (end_date < ? OR start_date > ?)
    `).all(employeeId, startDate, endDate);
  },

  create(data) {
    const request_number = this.nextRequestNumber();
    const info = db.prepare(`
      INSERT INTO leave_requests
        (request_number, employee_id, leave_type_id, start_date, end_date, is_half_day, half_day_part,
         deducted_days, reason, status, is_advance_leave, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      request_number, data.employee_id, data.leave_type_id, data.start_date, data.end_date,
      data.is_half_day ? 1 : 0, data.half_day_part || null, data.deducted_days, data.reason || null,
      data.status, data.is_advance_leave ? 1 : 0,
      data.status === 'DRAFT' ? null : new Date().toISOString().slice(0, 19).replace('T', ' ')
    );
    return info.lastInsertRowid;
  },

  addAttachment(leaveRequestId, fileName, uploadedBy) {
    return db.prepare(`
      INSERT INTO leave_attachments (leave_request_id, file_name, uploaded_by)
      VALUES (?, ?, ?)
    `).run(leaveRequestId, fileName, uploadedBy).lastInsertRowid;
  },

  updateStatus(id, newStatus, extra = {}) {
    const fields = ['status = ?'];
    const values = [newStatus];
    if (extra.withdrawal_deadline !== undefined) { fields.push('withdrawal_deadline = ?'); values.push(extra.withdrawal_deadline); }
    if (extra.original_leave_type_id !== undefined) { fields.push('original_leave_type_id = ?'); values.push(extra.original_leave_type_id); }
    values.push(id);
    db.prepare(`UPDATE leave_requests SET ${fields.join(', ')} WHERE leave_request_id = ?`).run(...values);
  },

  // Approvals ---------------------------------------------------------------
  createApproval(leaveRequestId, level, approverId) {
    return db.prepare(`
      INSERT INTO leave_approvals (leave_request_id, approval_level, approver_id, is_current, status)
      VALUES (?, ?, ?, 1, 'PENDING')
    `).run(leaveRequestId, level, approverId).lastInsertRowid;
  },

  currentApproval(leaveRequestId) {
    return db.prepare(`
      SELECT * FROM leave_approvals WHERE leave_request_id = ? AND is_current = 1 ORDER BY approval_id DESC LIMIT 1
    `).get(leaveRequestId);
  },

  approvalsFor(leaveRequestId) {
    return db.prepare(`
      SELECT la.*, u.full_name AS approver_name FROM leave_approvals la
      JOIN users u ON u.user_id = la.approver_id
      WHERE la.leave_request_id = ? ORDER BY la.approval_id ASC
    `).all(leaveRequestId);
  },

  decideApproval(approvalId, status, reason) {
    db.prepare(`
      UPDATE leave_approvals SET status = ?, decision_reason = ?, decided_at = datetime('now'), is_current = 0
      WHERE approval_id = ?
    `).run(status, reason || null, approvalId);
  },

  // Includes both approvals directly assigned to approverId and approvals
  // assigned to a manager who has delegated their queue to approverId — a
  // delegate gets additional visibility, the manager never loses theirs.
  pendingForApprover(approverId) {
    return db.prepare(`
      SELECT lr.*, lt.leave_name, u.full_name AS employee_name, la.approval_id, la.approval_level, la.approver_id
      FROM leave_approvals la
      JOIN leave_requests lr ON lr.leave_request_id = la.leave_request_id
      JOIN leave_types lt ON lt.leave_type_id = lr.leave_type_id
      JOIN users u ON u.user_id = lr.employee_id
      WHERE la.is_current = 1 AND la.status = 'PENDING'
        AND (
          la.approver_id = ?
          OR la.approver_id IN (
            SELECT manager_id FROM delegations
            WHERE delegate_id = ? AND effective_from <= date('now') AND (effective_to IS NULL OR effective_to >= date('now'))
          )
        )
      ORDER BY lr.created_at ASC
    `).all(approverId, approverId);
  },

  findApproval(approvalId) {
    return db.prepare(`SELECT * FROM leave_approvals WHERE approval_id = ?`).get(approvalId);
  },

  pendingCancellationsForApprover(approverId) {
    return db.prepare(`
      SELECT lr.*, lt.leave_name, u.full_name AS employee_name
      FROM leave_requests lr
      JOIN leave_types lt ON lt.leave_type_id = lr.leave_type_id
      JOIN users u ON u.user_id = lr.employee_id
      WHERE lr.status = 'CANCELLATION_REQUESTED' AND u.manager_id = ?
      ORDER BY lr.created_at ASC
    `).all(approverId);
  },

  requestDates(leaveRequestId) {
    return db.prepare(`SELECT * FROM leave_request_dates WHERE leave_request_id = ? ORDER BY leave_date`).all(leaveRequestId);
  },

  addRequestDates(leaveRequestId, dates) {
    const stmt = db.prepare(`INSERT INTO leave_request_dates (leave_request_id, leave_date, day_fraction) VALUES (?, ?, ?)`);
    const insertMany = db.transaction((rows) => { for (const r of rows) stmt.run(leaveRequestId, r.date, r.fraction); });
    insertMany(dates);
  },
};

module.exports = LeaveRequest;
