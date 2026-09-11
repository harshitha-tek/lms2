const express = require('express');
const dayjs = require('dayjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ensureAuthenticated } = require('../middleware/auth');
const User = require('../models/userModel');
const LeaveType = require('../models/leaveTypeModel');
const LeaveRequest = require('../models/leaveRequestModel');
const Ledger = require('../models/ledgerModel');
const Notification = require('../models/notificationModel');
const { Holiday, Config } = require('../models/configModel');
const calcService = require('../services/leaveCalculationService');
const routingService = require('../services/approvalRoutingService');
const Watcher = require('../models/watcherModel');
const Audit = require('../models/auditModel');
const db = require('../database/db');
const scheduler = require('../services/schedulerService');

const router = express.Router();
const uploadDirectory = path.join(__dirname, '..', '..', 'frontend', 'public', 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });
const upload = multer({ storage: multer.diskStorage({
  destination: uploadDirectory,
  filename: (req, file, done) => done(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
}), limits: { fileSize: 5 * 1024 * 1024 } });

// Auth endpoints deliberately live outside the protected API router.
router.get('/auth/session', (req, res) => {
  const user = req.session.userId ? User.findById(req.session.userId) : null;
  res.json({ user, authMode: require('../config/env').authMode });
});
router.post('/auth/dev-login', (req, res) => {
  const user = User.findById(Number(req.body.user_id));
  if (!user) return res.status(401).json({ error: 'Invalid user.' });
  req.session.userId = user.user_id;
  Audit.log(user.user_id, 'users', user.user_id, 'SIGN_IN');
  res.json({ user });
});
router.post('/auth/logout', (req, res) => {
  const userId = req.session.userId;
  if (userId) Audit.log(userId, 'users', userId, 'SIGN_OUT');
  req.session.destroy(() => res.status(204).end());
});
router.get('/auth/users', (req, res) => res.json(User.allActive()));

router.use(ensureAuthenticated);

router.get('/dashboard', (req, res) => {
  const year = dayjs().year();
  const today = dayjs().format('YYYY-MM-DD');
  const leaveTypes = LeaveType.selectable();
  const balances = leaveTypes.map(leaveType => ({ leaveType, ...Ledger.effectiveBalance(req.currentUser.user_id, leaveType.leave_type_id, year) }));
  const requests = LeaveRequest.forEmployee(req.currentUser.user_id);
  const upcomingHolidays = Holiday.all()
    .filter(h => h.holiday_date >= today)
    .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date))
    .slice(0, 5);
  res.json({
    balances,
    leaveTypes,
    pending: requests.filter(r => ['PENDING_MANAGER', 'PENDING_HR'].includes(r.status)),
    upcoming: requests.filter(r => r.status === 'APPROVED' && r.start_date >= today),
    upcomingHolidays,
    minimumLeaveDate: today,
  });
});

router.get('/leave/calculate', (req, res) => {
  const { start_date, end_date, is_half_day, leave_type_id } = req.query;
  if (!start_date || !end_date) return res.status(400).json({ error: 'Dates are required.' });
  const result = calcService.calculate(start_date, end_date, is_half_day === 'true');
  const balance = leave_type_id ? Ledger.effectiveBalance(req.currentUser.user_id, Number(leave_type_id), dayjs().year()) : null;
  res.json({ ...result, balance, projectedBalance: balance ? balance.effective - result.deductedDays : null, isAdvanceLeave: balance ? result.deductedDays > balance.effective : false });
});
router.get('/leave/requests', (req, res) => res.json(LeaveRequest.forEmployee(req.currentUser.user_id)));
router.get('/leave/requests/:id', (req, res) => {
  const request = LeaveRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found.' });
  const fullAccess = request.employee_id === req.currentUser.user_id || request.manager_id === req.currentUser.user_id || req.currentUser.isHrAdmin;
  if (fullAccess) {
    return res.json({ request, approvals: LeaveRequest.approvalsFor(request.leave_request_id), dates: LeaveRequest.requestDates(request.leave_request_id), watchers: Watcher.forRequest(request.leave_request_id) });
  }
  // BR-42 / LMS-064: a Watcher gets dates, status and leave type only, masked
  // at the query layer — Sick is rendered as "Unavailable", and reason text
  // and attachments never reach the client, for any leave type.
  if (Watcher.isWatcher(req.currentUser.user_id, request.leave_request_id)) {
    return res.json({
      request: {
        leave_request_id: request.leave_request_id,
        request_number: request.request_number,
        employee_name: request.employee_name,
        start_date: request.start_date,
        end_date: request.end_date,
        status: request.status,
        leave_name: request.is_sick_leave ? 'Unavailable' : request.leave_name,
      },
      isWatcherView: true,
    });
  }
  return res.status(403).json({ error: 'Access denied.' });
});
router.post('/leave/requests', upload.single('attachment'), (req, res) => {
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
    if (approverId) {
      LeaveRequest.createApproval(id, 'MANAGER', approverId);
      const delegation = db.prepare(`
        SELECT delegate_id FROM delegations
        WHERE manager_id = ? AND effective_from <= date('now') AND (effective_to IS NULL OR effective_to >= date('now'))
      `).get(approverId);
      if (delegation) {
        Notification.create(delegation.delegate_id, 'NEW_REQUEST_FOR_APPROVAL', 'New request for approval (delegated)',
          `A request is pending in a manager's queue you're delegated for.`, id);
      }
    }
    Notification.create(req.currentUser.user_id, 'REQUEST_SUBMITTED', 'Leave request submitted', `Your request has been submitted.`, id);
    // LMS-014 / LMS-062: project leads and any active standing watchers on
    // this employee are automatically attached as watchers of this request.
    Watcher.attachAutoWatchers(req.currentUser.user_id, id);
  }
  res.status(201).json({ id, request: LeaveRequest.findById(id) });
});
// Manager: add an ad-hoc watcher to a specific request within their reporting line (LMS-060).
router.post('/leave/requests/:id/watchers', (req, res) => {
  const { watcher_user_id } = req.body;
  const request = LeaveRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found.' });

  const inChain = User.allReportsRecursive(req.currentUser.user_id).some(r => r.user_id === request.employee_id);
  if (!inChain && !req.currentUser.isHrAdmin) return res.status(403).json({ error: 'This request is not within your reporting line.' });

  const candidate = User.findById(Number(watcher_user_id));
  if (!candidate) return res.status(400).json({ error: 'Watcher not found.' });
  // LMS-063: a Watcher must hold the Manager or HR/Admin role.
  if (!candidate.isManager && !candidate.isHrAdmin) return res.status(400).json({ error: 'A Watcher must hold the Manager or HR/Admin role.' });

  Watcher.addRequestWatcher(candidate.user_id, request.leave_request_id, 'REQUEST');
  Audit.log(req.currentUser.user_id, 'watchers', request.leave_request_id, 'WATCHER_ADDED', null, { watcher_user_id: candidate.user_id });
  res.status(201).json({ success: true, watchers: Watcher.forRequest(request.leave_request_id) });
});
router.post('/leave/requests/:id/withdraw', (req, res) => {
  const request = LeaveRequest.findById(req.params.id);
  if (!request || request.employee_id !== req.currentUser.user_id) return res.status(403).json({ error: 'Access denied.' });
  if (!['PENDING_MANAGER', 'PENDING_HR'].includes(request.status)) return res.status(400).json({ error: 'This request cannot be withdrawn.' });
  LeaveRequest.updateStatus(request.leave_request_id, 'WITHDRAWN');
  res.status(204).end();
});

router.post('/leave/requests/:id/cancel', (req, res) => {
  const request = LeaveRequest.findById(req.params.id);
  if (!request || request.employee_id !== req.currentUser.user_id) return res.status(403).json({ error: 'Access denied.' });
  if (request.status !== 'APPROVED') return res.status(400).json({ error: 'Only approved requests can be cancelled.' });
  LeaveRequest.updateStatus(request.leave_request_id, 'CANCELLATION_REQUESTED');
  Audit.log(req.currentUser.user_id, 'leave_requests', request.leave_request_id, 'CANCELLATION_REQUESTED');
  if (request.manager_id) {
    Notification.create(request.manager_id, 'CANCELLATION_REQUESTED', 'Cancellation requested',
      `${req.currentUser.full_name} requested cancellation of ${request.request_number}.`, request.leave_request_id);
  }
  res.json({ success: true, message: 'Cancellation requested.' });
});

// Team calendar: an Employee sees their peers (BR-41 — name, dates, status
// only, never leave type/reason); a Manager or HR/Admin sees their full
// reporting line at any depth (BR-39). Only APPROVED leave is shown — a
// pending request isn't real team-coverage impact yet.
router.get('/leave/team-calendar', (req, res) => {
  const members = req.currentUser.isHrAdmin
    ? User.allActive().filter(u => u.user_id !== req.currentUser.user_id)
    : req.currentUser.isManager
      ? User.allReportsRecursive(req.currentUser.user_id)
      : User.peers(req.currentUser.user_id);
  const memberIds = members.map(m => m.user_id);
  if (!memberIds.length) return res.json({ events: [], members: [] });
  const placeholders = memberIds.map(() => '?').join(',');
  const leaves = db.prepare(`
    SELECT lr.leave_request_id, lr.employee_id, u.full_name, lr.start_date, lr.end_date, lr.status
    FROM leave_requests lr
    JOIN users u ON u.user_id = lr.employee_id
    WHERE lr.employee_id IN (${placeholders}) AND lr.status = 'APPROVED'
  `).all(...memberIds);
  res.json({
    members: members.map(m => ({ user_id: m.user_id, full_name: m.full_name })),
    events: leaves.map(l => ({
      id: l.leave_request_id,
      employeeId: l.employee_id,
      employeeName: l.full_name,
      start: l.start_date,
      end: l.end_date,
      status: l.status,
    })),
  });
});
// Deprecated alias, kept so any stale cached bundle doesn't hard-break.
router.get('/leave/peer-calendar', (req, res) => {
  const peers = User.peers(req.currentUser.user_id);
  const peerIds = peers.map(p => p.user_id);
  if (!peerIds.length) return res.json({ events: [] });
  const placeholders = peerIds.map(() => '?').join(',');
  const leaves = db.prepare(`
    SELECT lr.leave_request_id, u.full_name, lr.start_date, lr.end_date, lr.status
    FROM leave_requests lr
    JOIN users u ON u.user_id = lr.employee_id
    WHERE lr.employee_id IN (${placeholders}) AND lr.status = 'APPROVED'
  `).all(...peerIds);
  res.json({ events: leaves.map(l => ({ id: l.leave_request_id, employeeName: l.full_name, start: l.start_date, end: l.end_date, status: l.status })) });
});

// Manager: Approvals Queue
router.get('/manager/approvals', (req, res) => {
  if (!req.currentUser.isManager && !req.currentUser.isHrAdmin) return res.status(403).json({ error: 'Manager access required.' });
  const pending = LeaveRequest.pendingForApprover(req.currentUser.user_id);
  const cancellations = LeaveRequest.pendingCancellationsForApprover(req.currentUser.user_id);
  const longLeaveThreshold = Config.longLeaveThreshold();
  const slaDays = Config.slaPeriodDays();
  res.json({ pending, cancellations, longLeaveThreshold, slaDays });
});

router.post('/manager/approvals/:id/decide', (req, res) => {
  const { approvalId, decision, reason } = req.body;
  const request = LeaveRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found.' });
  if (request.employee_id === req.currentUser.user_id) {
    return res.status(403).json({ error: 'Self-approval is prohibited.' });
  }
  const approval = LeaveRequest.findApproval(approvalId);
  if (!approval || approval.leave_request_id !== request.leave_request_id || approval.is_current !== 1) {
    return res.status(400).json({ error: 'This approval is no longer active.' });
  }
  const isDirectApprover = approval.approver_id === req.currentUser.user_id;
  const isDelegate = !isDirectApprover && routingService.isActiveDelegateFor(req.currentUser.user_id, approval.approver_id);
  if (!isDirectApprover && !isDelegate) {
    return res.status(403).json({ error: 'You are not authorized to decide this approval.' });
  }
  const CURRENT_LEAVE_YEAR = dayjs().year();
  LeaveRequest.decideApproval(approvalId, decision === 'approve' ? 'APPROVED' : 'REJECTED', reason);
  if (decision === 'reject') {
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
    Audit.log(req.currentUser.user_id, 'leave_requests', request.leave_request_id, 'REJECTED', null, { reason });
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
    Audit.log(req.currentUser.user_id, 'leave_requests', request.leave_request_id, 'MANAGER_APPROVED_ROUTED_TO_HR');
    return res.json({ success: true, status: 'PENDING_HR' });
  } else {
    LeaveRequest.updateStatus(request.leave_request_id, 'APPROVED');
    Ledger.post(request.employee_id, request.leave_type_id, CURRENT_LEAVE_YEAR, 'DEBIT', -request.deducted_days, request.request_number);
    Notification.create(request.employee_id, 'REQUEST_APPROVED', 'Leave request approved',
      `${request.request_number} has been approved.`, request.leave_request_id);
    Audit.log(req.currentUser.user_id, 'leave_requests', request.leave_request_id, 'APPROVED');
    return res.json({ success: true, status: 'APPROVED' });
  }
});

router.post('/manager/approvals/:id/decide-cancellation', (req, res) => {
  const { decision } = req.body;
  const request = LeaveRequest.findById(req.params.id);
  if (!request || request.status !== 'CANCELLATION_REQUESTED') return res.status(400).json({ error: 'Invalid state.' });
  if (request.employee_id === req.currentUser.user_id) return res.status(403).json({ error: 'Self-approval is prohibited.' });
  const CURRENT_LEAVE_YEAR = dayjs().year();
  if (decision === 'approve') {
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
    return res.json({ success: true, status: 'CANCELLED' });
  } else {
    LeaveRequest.updateStatus(request.leave_request_id, 'APPROVED');
    Notification.create(request.employee_id, 'REQUEST_REJECTED', 'Cancellation rejected',
      `Your cancellation of ${request.request_number} was rejected; the leave remains approved.`, request.leave_request_id);
    Audit.log(req.currentUser.user_id, 'leave_requests', request.leave_request_id, 'CANCELLATION_REJECTED');
    return res.json({ success: true, status: 'APPROVED' });
  }
});

// Manager: Team balances
router.get('/manager/team', (req, res) => {
  if (!req.currentUser.isManager && !req.currentUser.isHrAdmin) return res.status(403).json({ error: 'Manager access required.' });
  const scope = req.query.scope === 'direct' ? 'direct' : 'all';
  const people = scope === 'direct'
    ? User.directReports(req.currentUser.user_id)
    : User.allReportsRecursive(req.currentUser.user_id);
  const leaveTypes = LeaveType.selectable();
  const CURRENT_LEAVE_YEAR = dayjs().year();
  const rows = people.map(p => {
    const balances = leaveTypes.map(lt => ({ leaveType: lt, ...Ledger.effectiveBalance(p.user_id, lt.leave_type_id, CURRENT_LEAVE_YEAR) }));
    const takenThisYear = db.prepare(`
      SELECT COALESCE(SUM(-quantity),0) AS taken FROM leave_ledger_entries
      WHERE user_id=? AND leave_year=? AND transaction_type='DEBIT'
    `).get(p.user_id, CURRENT_LEAVE_YEAR).taken;
    const pendingDays = db.prepare(`
      SELECT COALESCE(SUM(deducted_days),0) AS d FROM leave_requests
      WHERE employee_id=? AND status IN ('PENDING_MANAGER','PENDING_HR')
    `).get(p.user_id).d;
    return { person: p, balances, takenThisYear, pendingDays };
  });
  res.json({ rows, scope });
});

// Manager: a team member's request history, for drill-through and for picking
// a specific request to add an ad-hoc Watcher to (LMS-060, screen 7.3.11).
router.get('/manager/employees/:id/requests', (req, res) => {
  const employeeId = Number(req.params.id);
  const inChain = User.allReportsRecursive(req.currentUser.user_id).some(r => r.user_id === employeeId);
  if (!inChain && !req.currentUser.isHrAdmin) return res.status(403).json({ error: 'This employee is not within your reporting line.' });
  res.json(LeaveRequest.forEmployee(employeeId));
});

// Manager / HR-Admin: Standing Watchers (LMS-061, LMS-062).
// A Manager may set one on any of their own direct or indirect reports; HR/Admin may set one on any employee.
router.get('/manager/standing-watchers', (req, res) => {
  if (!req.currentUser.isManager && !req.currentUser.isHrAdmin) return res.status(403).json({ error: 'Manager access required.' });
  const watchableEmployees = req.currentUser.isHrAdmin ? User.allActive() : User.allReportsRecursive(req.currentUser.user_id);
  const current = req.currentUser.isHrAdmin
    ? Watcher.allStandingWatchers()
    : Watcher.standingWatchersOn(watchableEmployees.map(e => e.user_id));
  const eligibleWatchers = User.allActive().filter(u => u.isManager || u.isHrAdmin);
  res.json({ current, watchableEmployees, eligibleWatchers });
});
router.post('/manager/standing-watchers', (req, res) => {
  if (!req.currentUser.isManager && !req.currentUser.isHrAdmin) return res.status(403).json({ error: 'Manager access required.' });
  const { watcher_user_id, watched_employee_id, effective_from, effective_to } = req.body;
  const watchedId = Number(watched_employee_id);

  const inChain = User.allReportsRecursive(req.currentUser.user_id).some(r => r.user_id === watchedId);
  if (!inChain && !req.currentUser.isHrAdmin) return res.status(403).json({ error: 'That employee is not within your reporting line.' });

  const candidate = User.findById(Number(watcher_user_id));
  if (!candidate) return res.status(400).json({ error: 'Watcher not found.' });
  // LMS-063: a Watcher must hold the Manager or HR/Admin role.
  if (!candidate.isManager && !candidate.isHrAdmin) return res.status(400).json({ error: 'A Watcher must hold the Manager or HR/Admin role.' });
  if (!effective_from) return res.status(400).json({ error: 'An effective-from date is required.' });

  const id = Watcher.createStandingWatcher(candidate.user_id, watchedId, effective_from, effective_to || null);
  Audit.log(req.currentUser.user_id, 'watchers', id, 'STANDING_WATCHER_CREATED', null, { watcher_user_id: candidate.user_id, watched_employee_id: watchedId, effective_from, effective_to });
  res.status(201).json({ success: true, id });
});
router.delete('/manager/standing-watchers/:id', (req, res) => {
  if (!req.currentUser.isManager && !req.currentUser.isHrAdmin) return res.status(403).json({ error: 'Manager access required.' });
  const watcher = Watcher.findStandingWatcher(req.params.id);
  if (!watcher) return res.status(404).json({ error: 'Standing watcher not found.' });

  const inChain = User.allReportsRecursive(req.currentUser.user_id).some(r => r.user_id === watcher.watched_employee_id);
  if (!inChain && !req.currentUser.isHrAdmin) return res.status(403).json({ error: 'That employee is not within your reporting line.' });

  Watcher.revokeStandingWatcher(req.params.id);
  Audit.log(req.currentUser.user_id, 'watchers', req.params.id, 'STANDING_WATCHER_REVOKED');
  res.json({ success: true });
});

// Manager: Delegation (LMS-041)
// The Delegate must be a peer Manager reporting to the same supervisor as the
// nominating Manager (a "peer" who merely shares a supervisor is not enough —
// they must themselves hold the Manager or HR/Admin role). Where no such peer
// manager exists, the delegation defaults to the nominating Manager's own
// supervisor. See "Detail on LMS-041": authority must never move sideways
// into an unrelated part of the organisation.
function eligibleDelegatesFor(userId) {
  const currentUser = User.findById(userId);
  const peerManagers = User.peers(userId)
    .map(p => User.findById(p.user_id))
    .filter(p => p.isManager || p.isHrAdmin);
  if (peerManagers.length) return peerManagers;
  return currentUser.manager_id ? [User.findById(currentUser.manager_id)] : [];
}

router.get('/manager/delegations', (req, res) => {
  const current = db.prepare(`
    SELECT d.*, u.full_name AS delegate_name FROM delegations d JOIN users u ON u.user_id=d.delegate_id
    WHERE d.manager_id=? ORDER BY d.effective_from DESC
  `).all(req.currentUser.user_id);
  res.json({ current, eligibleDelegates: eligibleDelegatesFor(req.currentUser.user_id) });
});
router.post('/manager/delegations', (req, res) => {
  const { delegate_id, effective_from, effective_to } = req.body;
  const delegateId = Number(delegate_id);
  if (delegateId === req.currentUser.user_id) return res.status(400).json({ error: 'You cannot delegate to yourself.' });
  const eligible = eligibleDelegatesFor(req.currentUser.user_id);
  if (!eligible.some(u => u.user_id === delegateId)) {
    return res.status(400).json({ error: 'The delegate must be a peer Manager reporting to the same supervisor, or your own supervisor where no peer manager exists.' });
  }
  db.prepare(`INSERT INTO delegations (manager_id, delegate_id, effective_from, effective_to) VALUES (?,?,?,?)`)
    .run(req.currentUser.user_id, delegateId, effective_from, effective_to || null);
  Audit.log(req.currentUser.user_id, 'delegations', 0, 'DELEGATION_CREATED', null, { delegate_id: delegateId, effective_from, effective_to });
  Notification.create(delegateId, 'NEW_REQUEST_FOR_APPROVAL', 'Nominated as delegate',
    `${req.currentUser.full_name} nominated you as delegate from ${effective_from}.`);
  res.status(201).json({ success: true });
});
router.delete('/manager/delegations/:id', (req, res) => {
  db.prepare(`DELETE FROM delegations WHERE delegation_id = ? AND manager_id = ?`).run(req.params.id, req.currentUser.user_id);
  Audit.log(req.currentUser.user_id, 'delegations', req.params.id, 'DELEGATION_REVOKED');
  res.json({ success: true });
});

// Admin: Employees (LMS-010 to LMS-019)
router.get('/admin/employees', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const allEmployees = User.all();
  const departments = db.prepare(`SELECT * FROM departments`).all();
  const grades = db.prepare(`SELECT * FROM grades`).all();
  const managementLevels = db.prepare(`SELECT * FROM management_levels`).all();
  res.json({ employees: allEmployees, departments, grades, managementLevels });
});
router.post('/admin/employees', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { employee_code, email, full_name, department_id, grade_id, management_level_id, manager_id, joined_date, employee_type } = req.body;
  const entra_object_id = `dev-${employee_code}-${Date.now()}`;
  const type = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'INTERN'].includes(employee_type) ? employee_type : 'EMPLOYEE';
  const id = User.create({ employee_code, entra_object_id, email, full_name, department_id, grade_id, management_level_id, manager_id: manager_id || null, joined_date, employee_type: type });
  Audit.log(req.currentUser.user_id, 'users', id, 'EMPLOYEE_CREATED');
  res.status(201).json({ success: true, id });
});

router.put('/admin/employees/:id', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const userId = parseInt(req.params.id, 10);
  const { full_name, email, department_id, grade_id, management_level_id, manager_id } = req.body;
  if (!full_name || !email) return res.status(400).json({ error: 'Full name and email are required.' });
  db.prepare(`
    UPDATE users
    SET full_name = ?, email = ?, department_id = ?, grade_id = ?, management_level_id = ?, manager_id = ?
    WHERE user_id = ?
  `).run(full_name, email, department_id, grade_id, management_level_id, manager_id || null, userId);
  const updated = User.findById(userId);
  Audit.log(req.currentUser.user_id, 'users', userId, 'EMPLOYEE_UPDATED', null, { full_name, email, department_id, grade_id, management_level_id, manager_id });
  res.json({ success: true, employee: updated });
});

// Admin: Departments
router.get('/admin/departments', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  res.json(db.prepare(`SELECT * FROM departments ORDER BY department_code`).all());
});
router.post('/admin/departments', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const department_code = String(req.body.department_code || '').trim();
  const department_name = String(req.body.department_name || '').trim();
  if (!department_code || !department_name) return res.status(400).json({ error: 'Code and name are required.' });
  const clash = db.prepare(`SELECT 1 FROM departments WHERE department_code = ? OR department_name = ?`).get(department_code, department_name);
  if (clash) return res.status(409).json({ error: 'A department with that code or name already exists.' });
  const info = db.prepare(`INSERT INTO departments (department_code, department_name) VALUES (?, ?)`).run(department_code, department_name);
  Audit.log(req.currentUser.user_id, 'departments', info.lastInsertRowid, 'DEPARTMENT_CREATED');
  res.status(201).json({ success: true, department_id: info.lastInsertRowid });
});
router.delete('/admin/departments/:id', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const inUse = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE department_id = ?`).get(req.params.id);
  if (inUse && inUse.n > 0) return res.status(409).json({ error: `Cannot delete: ${inUse.n} employee(s) still assigned to this department.` });
  db.prepare(`DELETE FROM departments WHERE department_id = ?`).run(req.params.id);
  Audit.log(req.currentUser.user_id, 'departments', req.params.id, 'DEPARTMENT_DELETED');
  res.json({ success: true });
});

// Admin: Leave Types & Policies (LMS-024 to LMS-027)
router.get('/admin/leave-types', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  res.json({ leaveTypes: LeaveType.all(), policies: LeaveType.allPolicies() });
});
router.post('/admin/leave-types', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { leave_code, leave_name, is_sick_leave, allows_attachment, allows_half_day, carry_forward_allowed, carry_forward_cap } = req.body;
  const id = LeaveType.create({
    leave_code, leave_name,
    is_sick_leave: !!is_sick_leave, allows_attachment: !!allows_attachment, allows_half_day: !!allows_half_day,
    carry_forward_allowed: !!carry_forward_allowed, carry_forward_cap: carry_forward_cap || null,
  });
  Audit.log(req.currentUser.user_id, 'leave_types', id, 'LEAVE_TYPE_CREATED');
  res.status(201).json({ success: true, id });
});
router.put('/admin/leave-types/:id/toggle', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { enabled } = req.body;
  const before = LeaveType.findById(req.params.id);
  if (!before) return res.status(404).json({ error: 'Leave type not found.' });
  try {
    LeaveType.setSelectable(req.params.id, !!enabled);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  Audit.log(req.currentUser.user_id, 'leave_types', req.params.id, 'LEAVE_TYPE_TOGGLED',
    { is_employee_selectable: before.is_employee_selectable }, { is_employee_selectable: enabled ? 1 : 0 });
  res.json({ success: true });
});

// Admin: Configuration (LMS-020 to LMS-032)
router.get('/admin/configuration', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  res.json({ configs: Config.all() });
});
router.post('/admin/configuration', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  for (const [key, value] of Object.entries(req.body)) {
    const prior = Config.get(key);
    if (prior !== value) {
      Config.set(key, value, req.currentUser.user_id);
      Audit.log(req.currentUser.user_id, 'configurations', 0, 'CONFIG_CHANGED', { key, value: prior }, { key, value });
    }
  }
  res.json({ success: true });
});
router.post('/admin/configuration/run-scheduler', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const result = scheduler.runAll();
  Audit.log(req.currentUser.user_id, 'scheduler_executions', 0, 'SCHEDULER_TRIGGERED_MANUALLY', null, result, false);
  res.json({ success: true, result });
});

// Admin: Holiday Admin
router.post('/admin/holidays', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { holiday_date, holiday_name, holiday_type } = req.body;
  const type = ['NATIONAL', 'FESTIVAL', 'OPTIONAL'].includes(holiday_type) ? holiday_type : 'NATIONAL';
  const id = Holiday.create(holiday_date, holiday_name, type);
  Audit.log(req.currentUser.user_id, 'holidays', id, 'HOLIDAY_ADDED', null, { holiday_date, holiday_name, holiday_type: type });
  res.status(201).json({ success: true, id });
});
router.post('/admin/holidays/import', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No data rows provided.' });

  // MySQL DATE columns round-trip through mysql2 as timezone-shifted Date
  // objects, so dedupe with a direct column comparison (MySQL coerces the
  // 'YYYY-MM-DD' string) rather than a Set built from the model.
  const dateExists = db.prepare(`SELECT 1 AS hit FROM holidays WHERE holiday_date = ?`);
  const nameExists = db.prepare(`SELECT 1 AS hit FROM holidays WHERE LOWER(holiday_name) = LOWER(?)`);
  const seenDates = new Set();
  const seenNames = new Set();
  const valid = [];
  const errors = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const date = String(row.holiday_date || row.date || '').trim();
    const name = String(row.holiday_name || row.name || '').trim();
    const type = String(row.holiday_type || row.type || 'NATIONAL').trim().toUpperCase();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !dayjs(date).isValid()) {
      errors.push(`row ${rowNumber}: invalid date (expected YYYY-MM-DD)`);
    } else if (!name) {
      errors.push(`row ${rowNumber}: holiday name is required`);
    } else if (!['NATIONAL', 'FESTIVAL', 'OPTIONAL'].includes(type)) {
      errors.push(`row ${rowNumber}: type must be NATIONAL, FESTIVAL or OPTIONAL`);
    } else if (seenDates.has(date) || dateExists.get(date)) {
      errors.push(`row ${rowNumber}: a holiday on ${date} already exists`);
    } else if (seenNames.has(name.toLowerCase()) || nameExists.get(name)) {
      errors.push(`row ${rowNumber}: a holiday named "${name}" already exists`);
    } else {
      seenDates.add(date);
      seenNames.add(name.toLowerCase());
      valid.push({ date, name, type });
    }
  });

  let imported = 0;
  valid.forEach(({ date, name, type }) => {
    try {
      Holiday.create(date, name, type);
      imported += 1;
    } catch (err) {
      errors.push(`${date}: could not be saved (${/duplicate/i.test(err.message) ? 'already exists' : 'database error'})`);
    }
  });
  if (imported) {
    Audit.log(req.currentUser.user_id, 'holidays', 0, 'HOLIDAYS_IMPORTED', null, { imported, skipped: errors.length });
  }

  res.status(imported ? 201 : 400).json({ imported, skipped: errors.length, errors });
});
router.delete('/admin/holidays/:id', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  Holiday.remove(req.params.id);
  Audit.log(req.currentUser.user_id, 'holidays', req.params.id, 'HOLIDAY_REMOVED');
  res.json({ success: true });
});

// Admin: Balance Adjustment (LMS-054)
router.get('/admin/adjustments/:userId', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const userId = parseInt(req.params.userId, 10);
  const ledger = Ledger.entriesFor(userId);
  const user = User.findById(userId);
  res.json({ ledger, user });
});
router.post('/admin/adjustments', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { user_id, leave_type_id, quantity, reason } = req.body;
  const qty = parseFloat(quantity);
  const CURRENT_LEAVE_YEAR = dayjs().year();
  Ledger.post(parseInt(user_id, 10), parseInt(leave_type_id, 10), CURRENT_LEAVE_YEAR, 'ADJUSTMENT', qty, reason);
  Audit.log(req.currentUser.user_id, 'leave_ledger_entries', 0, 'MANUAL_ADJUSTMENT', null, { user_id, leave_type_id, quantity: qty, reason });
  Notification.create(parseInt(user_id, 10), 'REQUEST_APPROVED', 'Balance adjusted', `HR/Admin posted a manual adjustment of ${qty} day(s): ${reason}`);
  res.json({ success: true });
});

// Admin: Reports (LMS-078)
router.get('/admin/reports', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const lopReport = db.prepare(`
    SELECT lr.request_number, u.full_name, lr.start_date, lr.end_date, lr.deducted_days
    FROM leave_requests lr JOIN users u ON u.user_id = lr.employee_id
    WHERE lr.status = 'LOP_APPLIED' ORDER BY lr.start_date DESC
  `).all();
  const summary = db.prepare(`
    SELECT lt.leave_name, COUNT(*) AS request_count, COALESCE(SUM(lr.deducted_days),0) AS total_days
    FROM leave_requests lr JOIN leave_types lt ON lt.leave_type_id = lr.leave_type_id
    WHERE lr.status IN ('APPROVED','LOP_APPLIED') GROUP BY lt.leave_name
  `).all();
  res.json({ lopReport, summary });
});

// Admin: Audit Log (LMS-079/080)
router.get('/admin/audit-log', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  res.json({ entries: Audit.recent(300) });
});

// --- Admin: Working Patterns (LMS-015, BR-06) ---
router.get('/admin/working-patterns', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const patterns = db.prepare(`
    SELECT wp.*, 
      (SELECT COUNT(*) FROM working_pattern_assignments WHERE working_pattern_id = wp.working_pattern_id) AS assignment_count 
    FROM working_patterns wp 
    ORDER BY wp.working_pattern_id
  `).all();

  const allDays = db.prepare('SELECT * FROM working_pattern_days ORDER BY working_pattern_id, day_of_week').all();
  patterns.forEach(p => {
    p.days = allDays.filter(d => Number(d.working_pattern_id) === Number(p.working_pattern_id));
  });

  const assignments = db.prepare(`
    SELECT wpa.*, u.full_name, u.employee_code, u.email, wp.pattern_name, wp.pattern_code
    FROM working_pattern_assignments wpa
    JOIN users u ON u.user_id = wpa.user_id
    JOIN working_patterns wp ON wp.working_pattern_id = wpa.working_pattern_id
    ORDER BY wpa.effective_from DESC
  `).all();

  res.json({ patterns, assignments, users: User.allActive() });
});

router.post('/admin/working-patterns', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { pattern_code, pattern_name, days } = req.body;
  if (!pattern_code || !pattern_name) return res.status(400).json({ error: 'Pattern code and name are required.' });

  try {
    const info = db.prepare('INSERT INTO working_patterns (pattern_code, pattern_name) VALUES (?, ?)').run(pattern_code.trim().toUpperCase(), pattern_name.trim());
    const patternId = info.lastInsertRowid;

    if (Array.isArray(days) && days.length > 0) {
      for (const d of days) {
        db.prepare('INSERT INTO working_pattern_days (working_pattern_id, day_of_week, working_hours) VALUES (?, ?, ?)')
          .run(patternId, d.day_of_week, parseFloat(d.working_hours || 0));
      }
    } else {
      for (let i = 0; i <= 6; i++) {
        const h = (i >= 1 && i <= 5) ? 8.0 : 0.0;
        db.prepare('INSERT INTO working_pattern_days (working_pattern_id, day_of_week, working_hours) VALUES (?, ?, ?)')
          .run(patternId, i, h);
      }
    }

    Audit.log(req.currentUser.user_id, 'working_patterns', patternId, 'WORKING_PATTERN_CREATED', null, { pattern_code, pattern_name });
    res.status(201).json({ success: true, id: patternId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/admin/working-patterns/:id', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { id } = req.params;
  const { pattern_name, days } = req.body;

  db.prepare('UPDATE working_patterns SET pattern_name = ? WHERE working_pattern_id = ?').run(pattern_name, id);

  if (Array.isArray(days)) {
    db.prepare('DELETE FROM working_pattern_days WHERE working_pattern_id = ?').run(id);
    for (const d of days) {
      db.prepare('INSERT INTO working_pattern_days (working_pattern_id, day_of_week, working_hours) VALUES (?, ?, ?)')
        .run(id, d.day_of_week, parseFloat(d.working_hours || 0));
    }
  }

  Audit.log(req.currentUser.user_id, 'working_patterns', id, 'WORKING_PATTERN_UPDATED', null, { pattern_name });
  res.json({ success: true });
});

router.delete('/admin/working-patterns/:id', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { id } = req.params;
  db.prepare('DELETE FROM working_pattern_days WHERE working_pattern_id = ?').run(id);
  db.prepare('DELETE FROM working_pattern_assignments WHERE working_pattern_id = ?').run(id);
  db.prepare('DELETE FROM working_patterns WHERE working_pattern_id = ?').run(id);
  Audit.log(req.currentUser.user_id, 'working_patterns', id, 'WORKING_PATTERN_DELETED');
  res.json({ success: true });
});

router.post('/admin/working-patterns/assign', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { user_id, working_pattern_id, effective_from, effective_to } = req.body;
  if (!user_id || !working_pattern_id || !effective_from) {
    return res.status(400).json({ error: 'Employee, pattern, and effective start date are required.' });
  }

  const toDate = effective_to || '9999-12-31';
  const existing = db.prepare(`
    SELECT assignment_id, effective_from, effective_to 
    FROM working_pattern_assignments 
    WHERE user_id = ? 
      AND effective_from <= ? 
      AND (effective_to IS NULL OR effective_to >= ?)
  `).all(user_id, toDate, effective_from);

  if (existing.length > 0) {
    return res.status(409).json({ 
      error: `Overlapping working pattern assignment detected for this employee (${existing[0].effective_from} to ${existing[0].effective_to || 'indefinite'}). Per LMS-015 / BR-06, an employee may have exactly one active pattern per date.` 
    });
  }

  const info = db.prepare(`
    INSERT INTO working_pattern_assignments (user_id, working_pattern_id, effective_from, effective_to) 
    VALUES (?, ?, ?, ?)
  `).run(user_id, working_pattern_id, effective_from, effective_to || null);

  Audit.log(req.currentUser.user_id, 'working_pattern_assignments', info.lastInsertRowid, 'WORKING_PATTERN_ASSIGNED', null, { user_id, working_pattern_id, effective_from, effective_to });
  res.status(201).json({ success: true, id: info.lastInsertRowid });
});

router.delete('/admin/working-patterns/assignments/:id', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { id } = req.params;
  db.prepare('DELETE FROM working_pattern_assignments WHERE assignment_id = ?').run(id);
  Audit.log(req.currentUser.user_id, 'working_pattern_assignments', id, 'ASSIGNMENT_REMOVED');
  res.json({ success: true });
});

router.post('/admin/working-patterns/import', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No data rows provided.' });

  let imported = 0;
  for (const row of rows) {
    if (!row.pattern_code || !row.pattern_name) continue;
    try {
      const code = String(row.pattern_code).trim().toUpperCase();
      const name = String(row.pattern_name).trim();
      const existing = db.prepare('SELECT working_pattern_id FROM working_patterns WHERE pattern_code = ?').get(code);
      let patternId = existing ? existing.working_pattern_id : null;
      if (!patternId) {
        const info = db.prepare('INSERT INTO working_patterns (pattern_code, pattern_name) VALUES (?, ?)').run(code, name);
        patternId = info.lastInsertRowid;
      }
      db.prepare('DELETE FROM working_pattern_days WHERE working_pattern_id = ?').run(patternId);
      const schedule = [row.sun, row.mon, row.tue, row.wed, row.thu, row.fri, row.sat];
      for (let d = 0; d <= 6; d++) {
        const hours = parseFloat(schedule[d] !== undefined ? schedule[d] : (d >= 1 && d <= 5 ? 8 : 0));
        db.prepare('INSERT INTO working_pattern_days (working_pattern_id, day_of_week, working_hours) VALUES (?, ?, ?)').run(patternId, d, hours);
      }
      imported++;
    } catch (e) {
      console.error('CSV import row error:', e);
    }
  }
  Audit.log(req.currentUser.user_id, 'working_patterns', 0, 'WORKING_PATTERNS_IMPORTED', null, { imported });
  res.json({ success: true, count: imported });
});

// --- Admin: Notification Templates (strictly EMAIL per user request) ---
router.get('/admin/notification-templates', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const templates = db.prepare("SELECT * FROM notification_templates WHERE channel = 'EMAIL' ORDER BY notification_type").all();
  res.json({ templates });
});

router.post('/admin/notification-templates', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { notification_type, subject_template, body_template } = req.body;
  if (!notification_type || !subject_template || !body_template) {
    return res.status(400).json({ error: 'Notification type, subject, and body are required.' });
  }
  try {
    const info = db.prepare("INSERT INTO notification_templates (notification_type, channel, subject_template, body_template, updated_by) VALUES (?, 'EMAIL', ?, ?, ?)")
      .run(notification_type.trim().toUpperCase(), subject_template.trim(), body_template.trim(), req.currentUser.user_id);
    Audit.log(req.currentUser.user_id, 'notification_templates', info.lastInsertRowid, 'TEMPLATE_CREATED', null, { notification_type });
    res.status(201).json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/admin/notification-templates/:id', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { id } = req.params;
  const { subject_template, body_template } = req.body;
  db.prepare("UPDATE notification_templates SET channel = 'EMAIL', subject_template = ?, body_template = ?, updated_by = ? WHERE notification_template_id = ?")
    .run(subject_template, body_template, req.currentUser.user_id, id);
  Audit.log(req.currentUser.user_id, 'notification_templates', id, 'TEMPLATE_UPDATED');
  res.json({ success: true });
});

router.delete('/admin/notification-templates/:id', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { id } = req.params;
  db.prepare('DELETE FROM notification_templates WHERE notification_template_id = ?').run(id);
  Audit.log(req.currentUser.user_id, 'notification_templates', id, 'TEMPLATE_DELETED');
  res.json({ success: true });
});

// --- Admin: Delegations (LMS-041, LMS-042) ---
router.get('/admin/delegations', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const delegations = db.prepare(`
    SELECT d.*,
      m.full_name AS manager_name, m.email AS manager_email, m.employee_code AS manager_code,
      del.full_name AS delegate_name, del.email AS delegate_email, del.employee_code AS delegate_code
    FROM delegations d
    JOIN users m ON m.user_id = d.manager_id
    JOIN users del ON del.user_id = d.delegate_id
    ORDER BY d.effective_from DESC
  `).all();

  // Only an actual Manager (or HR/Admin) has an approval queue to delegate in the first place.
  const managers = User.allActive().filter(u => u.isManager || u.isHrAdmin);

  res.json({ delegations, managers });
});

// Eligible delegates for a specific manager: peer Managers reporting to the
// same supervisor, or — where no peer manager exists — that manager's own
// supervisor (LMS-041). Fetched dynamically as HR/Admin picks the nominating
// manager, since the eligible set differs per manager.
router.get('/admin/delegations/eligible-delegates', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const managerId = Number(req.query.manager_id);
  if (!managerId || !User.findById(managerId)) return res.status(400).json({ error: 'A valid manager_id is required.' });
  res.json({ eligibleDelegates: eligibleDelegatesFor(managerId) });
});

router.post('/admin/delegations', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { manager_id, delegate_id, effective_from, effective_to } = req.body;
  if (!manager_id || !delegate_id || !effective_from) {
    return res.status(400).json({ error: 'Manager, delegate, and start date are required.' });
  }
  const managerId = Number(manager_id);
  const delegateId = Number(delegate_id);
  if (managerId === delegateId) {
    return res.status(400).json({ error: 'Manager cannot delegate approval rights to themselves (self-approval prohibited).' });
  }
  const eligible = eligibleDelegatesFor(managerId);
  if (!eligible.some(u => u.user_id === delegateId)) {
    return res.status(400).json({ error: "The delegate must be a peer Manager reporting to the same supervisor, or the manager's own supervisor where no peer manager exists." });
  }

  const info = db.prepare('INSERT INTO delegations (manager_id, delegate_id, effective_from, effective_to) VALUES (?, ?, ?, ?)')
    .run(managerId, delegateId, effective_from, effective_to || null);

  Audit.log(req.currentUser.user_id, 'delegations', info.lastInsertRowid, 'DELEGATION_CREATED_BY_ADMIN', null, { manager_id: managerId, delegate_id: delegateId, effective_from, effective_to });
  res.status(201).json({ success: true, id: info.lastInsertRowid });
});

router.delete('/admin/delegations/:id', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { id } = req.params;
  db.prepare('DELETE FROM delegations WHERE delegation_id = ?').run(id);
  Audit.log(req.currentUser.user_id, 'delegations', id, 'DELEGATION_REVOKED_BY_ADMIN');
  res.json({ success: true });
});

// --- Admin: Self-Approval Settings & Audit (Configurable levels) ---
router.get('/admin/self-approval', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  
  const settings = {
    self_approval_manager_enabled: Config.get('self_approval_manager_enabled', 'false') === 'true',
    self_approval_hr_enabled: Config.get('self_approval_hr_enabled', 'false') === 'true',
    self_approval_max_days: parseInt(Config.get('self_approval_max_days', '2'), 10),
    self_approval_notify_supervisor: Config.get('self_approval_notify_supervisor', 'true') === 'true',
    self_approval_allow_sick_leave: Config.get('self_approval_allow_sick_leave', 'false') === 'true',
    self_approval_policy_notes: Config.get('self_approval_policy_notes', 'Strict policy: Manager and HR self-approvals are prohibited by default.')
  };

  let violations = [];
  try {
    violations = db.prepare(`
      SELECT sa.*, 
        u.full_name AS attempted_by_name, u.email AS attempted_by_email, u.employee_code,
        r.full_name AS routed_to_name,
        lr.request_number
      FROM self_approvals sa
      JOIN users u ON u.user_id = sa.attempted_by_user_id
      LEFT JOIN users r ON r.user_id = sa.routed_to_user_id
      LEFT JOIN leave_requests lr ON lr.leave_request_id = sa.leave_request_id
      ORDER BY sa.attempted_at DESC
      LIMIT 100
    `).all();
  } catch (e) {
    console.error('Self approval table query:', e.message);
  }

  res.json({ settings, violations });
});

router.post('/admin/self-approval', (req, res) => {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { settings } = req.body;
  if (!settings) return res.status(400).json({ error: 'Settings object required.' });

  const keys = [
    'self_approval_manager_enabled',
    'self_approval_hr_enabled',
    'self_approval_max_days',
    'self_approval_notify_supervisor',
    'self_approval_allow_sick_leave',
    'self_approval_policy_notes'
  ];

  for (const k of keys) {
    if (settings[k] !== undefined) {
      const val = String(settings[k]);
      db.prepare(`
        INSERT INTO configurations (configuration_key, configuration_value, updated_by)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE configuration_value = VALUES(configuration_value), updated_by = VALUES(updated_by), updated_at = NOW()
      `).run(k, val, req.currentUser.user_id);
    }
  }

  Audit.log(req.currentUser.user_id, 'configurations', 0, 'SELF_APPROVAL_SETTINGS_UPDATED', null, settings);
  res.json({ success: true });
});

router.get('/holidays', (req, res) => res.json({ holidays: Holiday.filter({ query: req.query.q, year: req.query.year, type: req.query.type }), years: Holiday.years() }));
router.get('/notifications', (req, res) => res.json(Notification.forUser(req.currentUser.user_id)));
router.post('/notifications/:id/read', (req, res) => { Notification.markRead(req.params.id, req.currentUser.user_id); res.status(204).end(); });
router.get('/profile', (req, res) => {
  const profile = db.prepare(`
    SELECT u.*, 
      d.department_name, d.department_code,
      g.grade_name, g.grade_code,
      m.full_name AS manager_name, m.email AS manager_email,
      ml.level_name AS management_level_name
    FROM users u
    LEFT JOIN departments d ON d.department_id = u.department_id
    LEFT JOIN grades g ON g.grade_id = u.grade_id
    LEFT JOIN management_levels ml ON ml.management_level_id = u.management_level_id
    LEFT JOIN users m ON m.user_id = u.manager_id
    WHERE u.user_id = ?
  `).get(req.currentUser.user_id);

  res.json({ user: profile || req.currentUser });
});

router.put('/profile', upload.single('avatar'), (req, res) => {
  const { phone_number, personal_email, remove_photo } = req.body;
  let profile_image = req.currentUser.profile_image;
  
  if (req.file) {
    profile_image = `/uploads/${req.file.filename}`;
  } else if (remove_photo === 'true' || remove_photo === true) {
    profile_image = null;
  }

  db.prepare(`
    UPDATE users 
    SET phone_number = ?, personal_email = ?, profile_image = ? 
    WHERE user_id = ?
  `).run(phone_number || null, personal_email || null, profile_image, req.currentUser.user_id);

  const updated = User.findById(req.currentUser.user_id);
  Audit.log(req.currentUser.user_id, 'users', req.currentUser.user_id, 'PROFILE_UPDATED', null, { phone_number, personal_email, profile_image });
  res.json({ success: true, user: updated });
});

module.exports = router;
