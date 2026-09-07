const dayjs = require('dayjs');
const LeaveRequest = require('../models/leaveRequestModel');
const Ledger = require('../models/ledgerModel');
const Notification = require('../models/notificationModel');
const Audit = require('../models/auditModel');
const routingService = require('../services/approvalRoutingService');
const { Config } = require('../models/configModel');

const CURRENT_LEAVE_YEAR = dayjs().year();

function queue(req, res) {
  const pending = LeaveRequest.pendingForApprover(req.currentUser.user_id);
  const cancellations = LeaveRequest.pendingCancellationsForApprover(req.currentUser.user_id);
  const longLeaveThreshold = Config.longLeaveThreshold();
  const slaDays = Config.slaPeriodDays();
  res.render('manager/approvals', { pending, cancellations, longLeaveThreshold, slaDays });
}

function decide(req, res) {
  const { approvalId, decision, reason } = req.body;
  const request = LeaveRequest.findById(req.params.id);
  if (!request) return res.status(404).send('Not found');

  // Standing rule (Section 3.4): self-approval is prohibited in any capacity.
  if (request.employee_id === req.currentUser.user_id) {
    routingService.recordSelfApprovalBlock(request.leave_request_id, approvalId, request.status === 'PENDING_HR' ? 2 : 1, req.currentUser.user_id, null);
    return res.status(403).render('error', { title: 'Action blocked', message: 'Self-approval is not permitted. This request has been routed to the next level.' });
  }

  LeaveRequest.decideApproval(approvalId, decision === 'approve' ? 'APPROVED' : 'REJECTED', reason);

  if (decision === 'reject') {
    if (request.is_advance_leave) {
      const deadline = dayjs().add(Config.advanceWithdrawalWindowDays(), 'day').toISOString();
      LeaveRequest.updateStatus(request.leave_request_id, 'REJECTED_PENDING_WITHDRAWAL', { withdrawal_deadline: deadline });
      Notification.create(request.employee_id, 'REQUEST_REJECTED', 'Advance leave rejected',
        `${request.request_number} was rejected. You have ${Config.advanceWithdrawalWindowDays()} days to withdraw before it converts to Loss of Pay.`, request.leave_request_id);
    } else {
      LeaveRequest.updateStatus(request.leave_request_id, 'REJECTED');
      Notification.create(request.employee_id, 'REQUEST_REJECTED', 'Leave request rejected',
        `${request.request_number} was rejected: ${reason || 'no reason given'}`, request.leave_request_id);
    }
    Audit.log(req.currentUser.user_id, 'leave_requests', request.leave_request_id, 'REJECTED', null, { reason });
    return res.redirect('/approvals');
  }

  // Approve path.
  const longLeaveThreshold = Config.longLeaveThreshold();
  if (request.status === 'PENDING_MANAGER' && request.deducted_days > longLeaveThreshold) {
    // BR-23: long leave requires sequential second-stage HR approval.
    LeaveRequest.updateStatus(request.leave_request_id, 'PENDING_HR');
    const hrAdmins = require('../models/userModel').all().filter(u => u.isHrAdmin);
    for (const hr of hrAdmins) {
      LeaveRequest.createApproval(request.leave_request_id, 'HR', hr.user_id);
      Notification.create(hr.user_id, 'NEW_REQUEST_FOR_APPROVAL', 'Second-stage approval required',
        `${request.request_number} (${request.deducted_days} days) requires HR approval.`, request.leave_request_id);
    }
    if (req.currentUser.manager_id) {
      Notification.create(req.currentUser.manager_id, 'NEW_REQUEST_FOR_APPROVAL', 'Long leave submitted',
        `A long-leave request from your reporting line entered second-stage approval.`, request.leave_request_id);
    }
    Audit.log(req.currentUser.user_id, 'leave_requests', request.leave_request_id, 'MANAGER_APPROVED_ROUTED_TO_HR');
  } else {
    // Final approval — write the deduction to the ledger (BR-09).
    LeaveRequest.updateStatus(request.leave_request_id, 'APPROVED');
    Ledger.post(request.employee_id, request.leave_type_id, CURRENT_LEAVE_YEAR, 'DEBIT', -request.deducted_days, request.request_number);
    Notification.create(request.employee_id, 'REQUEST_APPROVED', 'Leave request approved',
      `${request.request_number} has been approved.`, request.leave_request_id);
    Audit.log(req.currentUser.user_id, 'leave_requests', request.leave_request_id, 'APPROVED');
  }

  res.redirect('/approvals');
}

function decideCancellation(req, res) {
  const { decision } = req.body;
  const request = LeaveRequest.findById(req.params.id);
  if (!request || request.status !== 'CANCELLATION_REQUESTED') return res.status(400).send('Invalid state.');

  if (request.employee_id === req.currentUser.user_id) {
    return res.status(403).render('error', { title: 'Action blocked', message: 'Self-approval is not permitted.' });
  }

  if (decision === 'approve') {
    // BR-31: restore only the deducted working days not yet elapsed.
    const today = dayjs().format('YYYY-MM-DD');
    const dates = LeaveRequest.requestDates(request.leave_request_id).filter(d => d.leave_date >= today);
    const restoreDays = dates.reduce((sum, d) => sum + d.day_fraction, 0);
    LeaveRequest.updateStatus(request.leave_request_id, 'CANCELLED');
    if (restoreDays > 0) {
      Ledger.post(request.employee_id, request.leave_type_id, CURRENT_LEAVE_YEAR, 'RESTORE', restoreDays, request.request_number);
    }
    Notification.create(request.employee_id, 'REQUEST_APPROVED', 'Cancellation approved',
      `Your cancellation of ${request.request_number} was approved. ${restoreDays} day(s) restored.`, request.leave_request_id);
    Audit.log(req.currentUser.user_id, 'leave_requests', request.leave_request_id, 'CANCELLATION_APPROVED');
  } else {
    LeaveRequest.updateStatus(request.leave_request_id, 'APPROVED');
    Notification.create(request.employee_id, 'REQUEST_REJECTED', 'Cancellation rejected',
      `Your cancellation request for ${request.request_number} was rejected; the leave remains approved.`, request.leave_request_id);
    Audit.log(req.currentUser.user_id, 'leave_requests', request.leave_request_id, 'CANCELLATION_REJECTED');
  }
  res.redirect('/approvals');
}

module.exports = { queue, decide, decideCancellation };
