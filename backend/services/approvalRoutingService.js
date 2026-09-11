// Subsystems 6 & 12 — Approval routing, self-approval prevention, escalation.
const db = require('../database/db');
const User = require('../models/userModel');

// "A user may never approve, reject or act on their own request in any
// capacity... Where the routing rules would produce self-approval, the
// request routes to the next level above." (Section 3.4 of the FRD)
// The approval row always stays assigned to the actual manager — a
// delegation grants the delegate *additional* access to the manager's
// queue (see isActiveDelegateFor), it does not transfer ownership away
// from the manager. This ensures the primary manager never loses the
// ability to act on their own approvals just because they delegated.
function resolveApprover(employeeId, level) {
  const employee = User.findById(employeeId);
  if (!employee || !employee.manager_id) return null;

  let candidate = employee.manager_id;
  const seen = new Set();
  while (candidate === employeeId || seen.has(candidate)) {
    seen.add(candidate);
    const candidateRow = User.findById(candidate);
    if (!candidateRow || !candidateRow.manager_id) return null; // exhausted -> HR queue
    candidate = candidateRow.manager_id;
  }

  return candidate;
}

// True if userId is currently an active delegate for managerId, i.e. the
// manager delegated their approval queue to userId and that delegation
// window covers today. Used to grant delegates additional (not exclusive)
// access to the manager's pending approvals.
function isActiveDelegateFor(userId, managerId) {
  const row = db.prepare(`
    SELECT 1 FROM delegations
    WHERE manager_id = ? AND delegate_id = ?
      AND effective_from <= date('now') AND (effective_to IS NULL OR effective_to >= date('now'))
  `).get(managerId, userId);
  return !!row;
}

// All manager_ids who currently have userId as an active delegate.
function delegatedManagerIdsFor(userId) {
  return db.prepare(`
    SELECT manager_id FROM delegations
    WHERE delegate_id = ?
      AND effective_from <= date('now') AND (effective_to IS NULL OR effective_to >= date('now'))
  `).all(userId).map(r => r.manager_id);
}

function recordSelfApprovalBlock(leaveRequestId, approvalId, approvalLevel, attemptedByUserId, routedToUserId, violationType = 'SELF_APPROVAL') {
  db.prepare(`
    INSERT INTO self_approvals (leave_request_id, approval_id, approval_level, attempted_by_user_id, violation_type, routed_to_user_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(leaveRequestId, approvalId || null, approvalLevel, attemptedByUserId, violationType, routedToUserId || null);
}

module.exports = { resolveApprover, recordSelfApprovalBlock, isActiveDelegateFor, delegatedManagerIdsFor };
