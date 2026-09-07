const dayjs = require('dayjs');
const LeaveType = require('../models/leaveTypeModel');
const LeaveRequest = require('../models/leaveRequestModel');
const Ledger = require('../models/ledgerModel');
const Watcher = require('../models/watcherModel');
const Notification = require('../models/notificationModel');
const Audit = require('../models/auditModel');
const calcService = require('../services/leaveCalculationService');
const routingService = require('../services/approvalRoutingService');
const { Config } = require('../models/configModel');

const CURRENT_LEAVE_YEAR = dayjs().year();

function showApplyForm(req, res) {
  const leaveTypes = LeaveType.selectable();
  res.render('employee/apply', { leaveTypes, error: null, form: {} });
}

// Live calculation endpoint used by the apply form's JS (LMS-036 / NFR-02).
function calculate(req, res) {
  const { start_date, end_date, is_half_day, leave_type_id } = req.query;
  if (!start_date || !end_date) return res.json({ error: 'dates required' });

  const result = calcService.calculate(start_date, end_date, is_half_day === 'true');
  const userId = req.currentUser.user_id;
  const balance = leave_type_id ? Ledger.effectiveBalance(userId, parseInt(leave_type_id, 10), CURRENT_LEAVE_YEAR) : null;

  res.json({
    ...result,
    balance,
    projectedBalance: balance ? balance.effective - result.deductedDays : null,
    isAdvanceLeave: balance ? (result.deductedDays > balance.effective) : false,
    backdatingAllowed: calcService.isBackdatingAllowed(start_date),
  });
}

function submitApplication(req, res) {
  const userId = req.currentUser.user_id;
  const { leave_type_id, start_date, end_date, is_half_day, half_day_part, reason, action } = req.body;
  const leaveTypeId = parseInt(leave_type_id, 10);

  const calcResult = calcService.calculate(start_date, end_date, is_half_day === 'on');

  // LMS-037: refuse overlap with the employee's own existing request.
  const overlaps = LeaveRequest.overlapping(userId, start_date, end_date);
  if (overlaps.length && action !== 'draft') {
    return res.render('employee/apply', {
      leaveTypes: LeaveType.selectable(),
      error: `This overlaps an existing request (${overlaps[0].request_number}, ${overlaps[0].status}).`,
      form: req.body,
    });
  }

  // LMS-039: backdating is permitted only within the configured window.
  if (action !== 'draft' && !calcService.isBackdatingAllowed(start_date)) {
    return res.render('employee/apply', {
      leaveTypes: LeaveType.selectable(),
      error: `That start date is outside the permitted backdating window.`,
      form: req.body,
    });
  }

  const balance = Ledger.effectiveBalance(userId, leaveTypeId, CURRENT_LEAVE_YEAR);
  const isAdvanceLeave = calcResult.deductedDays > balance.effective;

  const status = action === 'draft' ? 'DRAFT' : 'PENDING_MANAGER';
  const leaveRequestId = LeaveRequest.create({
    employee_id: userId,
    leave_type_id: leaveTypeId,
    start_date, end_date,
    is_half_day: is_half_day === 'on',
    half_day_part: half_day_part || null,
    deducted_days: calcResult.deductedDays,
    reason,
    status,
    is_advance_leave: isAdvanceLeave,
  });

  LeaveRequest.addRequestDates(leaveRequestId, calcResult.days.filter(d => !d.excluded).map(d => ({ date: d.date, fraction: 1.0 })));
  Audit.log(userId, 'leave_requests', leaveRequestId, action === 'draft' ? 'DRAFT_SAVED' : 'SUBMITTED');

  if (status === 'PENDING_MANAGER') {
    const approverId = routingService.resolveApprover(userId, 'MANAGER') || req.currentUser.manager_id;
    if (approverId) {
      LeaveRequest.createApproval(leaveRequestId, 'MANAGER', approverId);
      Notification.create(approverId, 'NEW_REQUEST_FOR_APPROVAL',
        `New request from ${req.currentUser.full_name}`,
        `${req.currentUser.full_name} submitted a ${calcResult.deductedDays}-day request awaiting your decision.`, leaveRequestId);
    }

    // Auto-watchers: project leads (LMS-014) + any standing watcher (LMS-062).
    const req_ = LeaveRequest.findById(leaveRequestId);
    const projectLeads = Watcher.projectLeadsFor(userId);
    const standing = Watcher.standingWatchersFor(userId);
    for (const w of [...new Set([...projectLeads, ...standing])]) {
      Watcher.addRequestWatcher(w, leaveRequestId, projectLeads.includes(w) ? 'PROJECT_LEAD' : 'STANDING');
    }

    Notification.create(userId, 'REQUEST_SUBMITTED', 'Leave request submitted',
      `Your request ${req_.request_number} for ${calcResult.deductedDays} day(s) has been submitted.`, leaveRequestId);
  }

  res.redirect(`/leave/${leaveRequestId}`);
}

function myRequests(req, res) {
  const requests = LeaveRequest.forEmployee(req.currentUser.user_id);
  res.render('employee/my-requests', { requests });
}

function requestDetail(req, res) {
  const request = LeaveRequest.findById(req.params.id);
  if (!request) return res.status(404).render('error', { title: 'Not found', message: 'Request not found.' });

  const isOwner = request.employee_id === req.currentUser.user_id;
  const isManagerOf = request.manager_id === req.currentUser.user_id;
  if (!isOwner && !isManagerOf && !req.currentUser.isHrAdmin) {
    return res.status(403).render('error', { title: 'Access denied', message: 'You cannot view this request.' });
  }

  const approvals = LeaveRequest.approvalsFor(request.leave_request_id);
  const watchers = Watcher.forRequest(request.leave_request_id);
  const dates = LeaveRequest.requestDates(request.leave_request_id);
  res.render('employee/request-detail', { request, approvals, watchers, dates, isOwner, isManagerOf });
}

function withdraw(req, res) {
  const request = LeaveRequest.findById(req.params.id);
  if (!request || request.employee_id !== req.currentUser.user_id) return res.status(403).send('Forbidden');
  if (!['PENDING_MANAGER', 'PENDING_HR'].includes(request.status)) return res.status(400).send('Cannot withdraw from this state.');

  LeaveRequest.updateStatus(request.leave_request_id, 'WITHDRAWN');
  Audit.log(req.currentUser.user_id, 'leave_requests', request.leave_request_id, 'WITHDRAWN', { status: request.status }, { status: 'WITHDRAWN' });
  res.redirect('/leave/my-requests');
}

function requestCancellation(req, res) {
  const request = LeaveRequest.findById(req.params.id);
  if (!request || request.employee_id !== req.currentUser.user_id) return res.status(403).send('Forbidden');
  if (request.status !== 'APPROVED') return res.status(400).send('Only an approved request can be cancelled.');

  LeaveRequest.updateStatus(request.leave_request_id, 'CANCELLATION_REQUESTED');
  Audit.log(req.currentUser.user_id, 'leave_requests', request.leave_request_id, 'CANCELLATION_REQUESTED');
  Notification.create(request.manager_id, 'CANCELLATION_REQUESTED', 'Cancellation requested',
    `${req.currentUser.full_name} requested cancellation of ${request.request_number}.`, request.leave_request_id);
  res.redirect(`/leave/${request.leave_request_id}`);
}

module.exports = { showApplyForm, calculate, submitApplication, myRequests, requestDetail, withdraw, requestCancellation };
