// Subsystems 6 & 12 — Approval routing, self-approval prevention, escalation.
const db = require('../../database/db');
const User = require('../models/userModel');

// "A user may never approve, reject or act on their own request in any
// capacity... Where the routing rules would produce self-approval, the
// request routes to the next level above." (Section 3.4 of the FRD)
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

function recordSelfApprovalBlock(leaveRequestId, approvalId, approvalLevel, attemptedByUserId, routedToUserId, violationType = 'SELF_APPROVAL') {
  db.prepare(`
    INSERT INTO self_approvals (leave_request_id, approval_id, approval_level, attempted_by_user_id, violation_type, routed_to_user_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(leaveRequestId, approvalId || null, approvalLevel, attemptedByUserId, violationType, routedToUserId || null);
}

module.exports = { resolveApprover, recordSelfApprovalBlock };
