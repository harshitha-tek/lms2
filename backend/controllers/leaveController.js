const dayjs = require('dayjs');
const LeaveType = require('../models/leaveTypeModel');
const LeaveRequest = require('../models/leaveRequestModel');
const Ledger = require('../models/ledgerModel');
const Notification = require('../models/notificationModel');
const Watcher = require('../models/watcherModel');
const Audit = require('../models/auditModel');
const User = require('../models/userModel');
const db = require('../database/db');
const calcService = require('../services/leaveCalculationService');
const routingService = require('../services/approvalRoutingService');

function calculateLeave(req, res) {
  const { start_date, end_date, is_half_day, leave_type_id } = req.query;
  if (!start_date || !end_date) return res.status(400).json({ error: 'Dates are required.' });
  const result = calcService.calculate(start_date, end_date, is_half_day === 'true');
  const balance = leave_type_id ? Ledger.effectiveBalance(req.currentUser.user_id, Number(leave_type_id), dayjs().year()) : null;
  res.json({ ...result, balance, projectedBalance: balance ? balance.effective - result.deductedDays : null, isAdvanceLeave: balance ? result.deductedDays > balance.effective : false });
}

function getLeaveRequests(req, res) {
  res.json(LeaveRequest.forEmployee(req.currentUser.user_id));
}

function getLeaveRequest(req, res) {
  const request = LeaveRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found.' });
  const allowed = request.employee_id === req.currentUser.user_id || request.manager_id === req.currentUser.user_id || req.currentUser.isHrAdmin;
  if (!allowed) return res.status(403).json({ error: 'Access denied.' });
  res.json({ request, approvals: LeaveRequest.approvalsFor(request.leave_request_id), dates: LeaveRequest.requestDates(request.leave_request_id), watchers: Watcher.forRequest(request.leave_request_id) });
}

function createLeaveRequest(req, res) {
  const { leave_type_id, start_date, end_date, is_half_day, half_day_part, reason, action } = req.body;
  const leaveType = LeaveType.findById(Number(leave_type_id));
  if (!leaveType || !start_date || !end_date || dayjs(end_date).isBefore(dayjs(start_date), 'day')) return res.status(400).json({ error: 'Choose a leave type and valid dates.' });
  if (dayjs(start_date).isBefore(dayjs(), 'day') || !String(reason || '').trim()) return res.status(400).json({ error: 'A future start date and reason are required.' });
  if (leaveType.is_sick_leave && !req.file) return res.status(400).json({ error: 'An attachment is required for sick leave.' });
  if (LeaveRequest.overlapping(req.currentUser.user_id, start_date, end_date).length && action !== 'draft') return res.status(409).json({ error: 'This overlaps an existing request.' });
  const calculation = calcService.calculate(start_date, end_date, is_half_day === 'true');
  const balance = Ledger.effectiveBalance(req.currentUser.user_id, leaveType.leave_type_id, dayjs().year());
  const status = action === 'draft' ? 'DRAFT' : 'PENDING_MANAGER';
  const id = LeaveRequest.create({ employee_id: req.currentUser.user_id, leave_type_id: leaveType.leave_type_id, start_date, end_date, is_half_day: is_half_day === 'true', half_day_part, deducted_days: calculation.deductedDays, reason: reason.trim(), status, is_advance_leave: calculation.deductedDays > balance.effective });
  if (req.file) LeaveRequest.addAttachment(id, req.file.filename, req.currentUser.user_id);
  LeaveRequest.addRequestDates(id, calculation.days.filter(day => !day.excluded).map(day => ({ date: day.date, fraction: 1 })));
  Audit.log(req.currentUser.user_id, 'leave_requests', id, action === 'draft' ? 'DRAFT_SAVED' : 'SUBMITTED');
  if (status === 'PENDING_MANAGER') {
    const approverId = routingService.resolveApprover(req.currentUser.user_id, 'MANAGER') || req.currentUser.manager_id;
    if (approverId) LeaveRequest.createApproval(id, 'MANAGER', approverId);
    Notification.create(req.currentUser.user_id, 'REQUEST_SUBMITTED', 'Leave request submitted', `Your request has been submitted.`, id);
  }
  res.status(201).json({ success: true, id });
}

function withdrawLeaveRequest(req, res) {
  const { reason } = req.body;
  const request = LeaveRequest.findById(req.params.id);
  if (!request || request.employee_id !== req.currentUser.user_id) return res.status(404).json({ error: 'Request not found.' });
  if (!['PENDING_MANAGER', 'PENDING_HR'].includes(request.status)) return res.status(400).json({ error: 'Only pending requests can be withdrawn.' });
  LeaveRequest.updateStatus(request.leave_request_id, 'WITHDRAWN_BY_EMPLOYEE', { withdrawal_reason: reason });
  Audit.log(req.currentUser.user_id, 'leave_requests', request.leave_request_id, 'WITHDRAWN');
  res.json({ success: true, status: 'WITHDRAWN_BY_EMPLOYEE' });
}

function cancelLeaveRequest(req, res) {
  const { reason } = req.body;
  const request = LeaveRequest.findById(req.params.id);
  if (!request || request.employee_id !== req.currentUser.user_id) return res.status(404).json({ error: 'Request not found.' });
  if (request.status !== 'APPROVED') return res.status(400).json({ error: 'Only approved requests can be cancelled.' });
  if (dayjs(request.start_date).isBefore(dayjs(), 'day')) return res.status(400).json({ error: 'Cannot cancel a leave that has already started.' });
  LeaveRequest.updateStatus(request.leave_request_id, 'CANCELLATION_REQUESTED', { cancellation_reason: reason });
  Audit.log(req.currentUser.user_id, 'leave_requests', request.leave_request_id, 'CANCELLATION_INITIATED');
  const manager = User.findById(request.manager_id);
  if (manager) Notification.create(manager.user_id, 'NEW_REQUEST_FOR_APPROVAL', 'Cancellation request', `${request.request_number} cancellation needs your approval.`, request.leave_request_id);
  res.json({ success: true, status: 'CANCELLATION_REQUESTED' });
}

function getPeerCalendar(req, res) {
  const manager = User.findById(req.currentUser.manager_id);
  if (!manager || !manager.isManager) return res.json({ events: [] });
  const peers = User.peers(req.currentUser.user_id);
  const events = [];
  for (const peer of peers) {
    const approved = LeaveRequest.forEmployee(peer.user_id).filter(r => r.status === 'APPROVED');
    for (const req of approved) {
      events.push({ employee: peer.full_name, start: req.start_date, end: req.end_date, type: req.leave_code });
    }
  }
  res.json({ events });
}

module.exports = { calculateLeave, getLeaveRequests, getLeaveRequest, createLeaveRequest, withdrawLeaveRequest, cancelLeaveRequest, getPeerCalendar };
