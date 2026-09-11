const dayjs = require('dayjs');
const LeaveRequest = require('../models/leaveRequestModel');
const Ledger = require('../models/ledgerModel');
const Notification = require('../models/notificationModel');
const Audit = require('../models/auditModel');
const User = require('../models/userModel');
const db = require('../database/db');
const { Config } = require('../models/configModel');
const routingService = require('../services/approvalRoutingService');

function getManagerApprovals(req, res) {
  const slaDays = Config.slaPeriodDays();
  const pending = LeaveRequest.pendingForApprover(req.currentUser.user_id);
  const cancellations = db.prepare(`
    SELECT lr.*, la.approval_id, la.approval_level FROM leave_requests lr
    JOIN leave_approvals la ON la.leave_request_id = lr.leave_request_id
    WHERE lr.status = 'CANCELLATION_REQUESTED' AND la.approver_id = ? AND la.is_current = 1
    ORDER BY lr.created_at ASC
  `).all(req.currentUser.user_id);
  res.json({ pending, cancellations, longLeaveThreshold: Config.longLeaveThreshold(), slaDays });
}

function decideApproval(req, res) {
  const { decision, reason } = req.body;
  const request = LeaveRequest.findById(req.params.id);
  if (!request || request.status !== 'PENDING_MANAGER') return res.status(400).json({ error: 'Invalid state.' });
  if (request.employee_id === req.currentUser.user_id) return res.status(403).json({ error: 'Self-approval is prohibited.' });

  // Check if current user is a delegate acting on behalf of the manager
  const delegation = db.prepare(`
    SELECT d.*, m.full_name AS manager_name FROM delegations d
    JOIN users m ON m.user_id = d.manager_id
    WHERE d.delegate_id = ? AND d.manager_id = ? AND d.effective_from <= date('now') AND (d.effective_to IS NULL OR d.effective_to >= date('now'))
  `).get(req.currentUser.user_id, request.manager_id);

  if (decision === 'REJECT') {
    if (request.is_advance_leave) {
      const deadline = dayjs().add(Config.advanceWithdrawalWindowDays(), 'day').toISOString();
      LeaveRequest.updateStatus(request.leave_request_id, 'REJECTED_PENDING_WITHDRAWAL', { withdrawal_deadline: deadline });
      Notification.create(request.employee_id, 'REQUEST_REJECTED', 'Advance leave rejected',
        `${request.request_number} was rejected. You have ${Config.advanceWithdrawalWindowDays()} days to withdraw before Loss of Pay.`, request.leave_request_id);
    } else {
      LeaveRequest.updateStatus(request.leave_request_id, 'REJECTED');
      Notification.create(request.employee_id, 'REQUEST_REJECTED', 'Leave request rejected',
        `${request.request_number} was rejected: ${reason || 'no reason given'}`, request.leave_request_id);
    }
    Audit.log(req.currentUser.user_id, 'leave_requests', request.leave_request_id, 'REJECTED', null,
      { reason, actedAs: delegation ? 'DELEGATE_FOR_' + request.manager_id : 'MANAGER' });
    return res.json({ success: true, status: 'REJECTED' });
  }

  const longLeaveThreshold = Config.longLeaveThreshold();
  if (request.status === 'PENDING_MANAGER' && request.deducted_days > longLeaveThreshold) {
    LeaveRequest.updateStatus(request.leave_request_id, 'PENDING_HR');
    const hrAdmins = User.all().filter(u => u.isHrAdmin);
    for (const hr of hrAdmins) {
      LeaveRequest.createApproval(request.leave_request_id, 'HR', hr.user_id);
      Notification.create(hr.user_id, 'NEW_REQUEST_FOR_APPROVAL', 'Second-stage approval required',
        `${request.request_number} (${request.deducted_days} days) requires HR approval.`, request.leave_request_id);
    }
    Audit.log(req.currentUser.user_id, 'leave_requests', request.leave_request_id, 'MANAGER_APPROVED_ROUTED_TO_HR',
      null, { actedAs: delegation ? 'DELEGATE_FOR_' + request.manager_id : 'MANAGER', managerId: request.manager_id });
    return res.json({ success: true, status: 'PENDING_HR' });
  } else {
    LeaveRequest.updateStatus(request.leave_request_id, 'APPROVED');
    Ledger.post(request.employee_id, request.leave_type_id, dayjs().year(), 'DEBIT', -request.deducted_days, request.request_number);
    Notification.create(request.employee_id, 'REQUEST_APPROVED', 'Leave request approved',
      `${request.request_number} has been approved.`, request.leave_request_id);
    Audit.log(req.currentUser.user_id, 'leave_requests', request.leave_request_id, 'APPROVED',
      null, { actedAs: delegation ? 'DELEGATE_FOR_' + request.manager_id : 'MANAGER', managerId: request.manager_id });
    return res.json({ success: true, status: 'APPROVED' });
  }
}

function decideCancellation(req, res) {
  const { decision } = req.body;
  const request = LeaveRequest.findById(req.params.id);
  if (!request || request.status !== 'CANCELLATION_REQUESTED') return res.status(400).json({ error: 'Invalid state.' });
  if (request.employee_id === req.currentUser.user_id) return res.status(403).json({ error: 'Self-approval is prohibited.' });

  // Check if current user is a delegate acting on behalf of the manager
  const delegation = db.prepare(`
    SELECT d.*, m.full_name AS manager_name FROM delegations d
    JOIN users m ON m.user_id = d.manager_id
    WHERE d.delegate_id = ? AND d.manager_id = ? AND d.effective_from <= date('now') AND (d.effective_to IS NULL OR d.effective_to >= date('now'))
  `).get(req.currentUser.user_id, request.manager_id);

  if (decision === 'APPROVE') {
    const elapsedDays = dayjs().diff(dayjs(request.start_date), 'day');
    const restoredDays = Math.max(0, request.deducted_days - elapsedDays);
    if (restoredDays > 0) {
      Ledger.post(request.employee_id, request.leave_type_id, dayjs().year(), 'CREDIT', restoredDays, `cancellation of ${request.request_number}`);
    }
    LeaveRequest.updateStatus(request.leave_request_id, 'CANCELLED');
    Notification.create(request.employee_id, 'REQUEST_APPROVED', 'Cancellation approved',
      `Your cancellation request for ${request.request_number} has been approved. ${restoredDays > 0 ? restoredDays + ' day(s) restored' : 'No days to restore (already elapsed).'}.`, request.leave_request_id);
    Audit.log(req.currentUser.user_id, 'leave_requests', request.leave_request_id, 'CANCELLATION_APPROVED',
      null, { restoredDays, actedAs: delegation ? 'DELEGATE_FOR_' + request.manager_id : 'MANAGER' });
  } else {
    LeaveRequest.updateStatus(request.leave_request_id, 'APPROVED');
    Notification.create(request.employee_id, 'REQUEST_REJECTED', 'Cancellation rejected',
      `Your cancellation request for ${request.request_number} was rejected. Leave status remains approved.`, request.leave_request_id);
    Audit.log(req.currentUser.user_id, 'leave_requests', request.leave_request_id, 'CANCELLATION_REJECTED',
      null, { actedAs: delegation ? 'DELEGATE_FOR_' + request.manager_id : 'MANAGER' });
  }
  res.json({ success: true });
}

module.exports = { getManagerApprovals, decideApproval, decideCancellation };
