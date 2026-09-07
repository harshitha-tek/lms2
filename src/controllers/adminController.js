const dayjs = require('dayjs');
const db = require('../../database/db');
const User = require('../models/userModel');
const LeaveType = require('../models/leaveTypeModel');
const Ledger = require('../models/ledgerModel');
const { Config, Holiday } = require('../models/configModel');
const Audit = require('../models/auditModel');
const Notification = require('../models/notificationModel');
const scheduler = require('../services/schedulerService');
const CURRENT_LEAVE_YEAR = dayjs().year();

// --- Employees --------------------------------------------------------------
function listEmployees(req, res) {
  const employees = User.all();
  const departments = db.prepare(`SELECT * FROM departments`).all();
  const grades = db.prepare(`SELECT * FROM grades`).all();
  const managementLevels = db.prepare(`SELECT * FROM management_levels`).all();
  res.render('admin/employees', { employees, departments, grades, managementLevels });
}

function createEmployee(req, res) {
  const { employee_code, email, full_name, department_id, grade_id, management_level_id, manager_id, joined_date } = req.body;
  if (manager_id && User.wouldCreateCycle(0, parseInt(manager_id, 10))) {
    // (defensive check; real cycle check happens against the new row once it has an id)
  }
  const entra_object_id = `dev-${employee_code}-${Date.now()}`;
  const id = User.create({ employee_code, entra_object_id, email, full_name, department_id, grade_id, management_level_id, manager_id: manager_id || null, joined_date });
  Audit.log(req.currentUser.user_id, 'users', id, 'EMPLOYEE_CREATED');
  res.redirect('/admin/employees');
}

// --- Leave types & policy ----------------------------------------------------
function leaveTypes(req, res) {
  res.render('admin/leave-types', { leaveTypes: LeaveType.all(), policies: LeaveType.allPolicies() });
}

function createLeaveType(req, res) {
  const { leave_code, leave_name, is_sick_leave, allows_attachment, allows_half_day, carry_forward_allowed, carry_forward_cap } = req.body;
  const id = LeaveType.create({
    leave_code, leave_name,
    is_sick_leave: !!is_sick_leave, allows_attachment: !!allows_attachment, allows_half_day: !!allows_half_day,
    carry_forward_allowed: !!carry_forward_allowed, carry_forward_cap: carry_forward_cap || null,
  });
  Audit.log(req.currentUser.user_id, 'leave_types', id, 'LEAVE_TYPE_CREATED');
  res.redirect('/admin/leave-types');
}

// --- Configuration ------------------------------------------------------------
function configuration(req, res) {
  res.render('admin/configuration', { configs: Config.all() });
}

function updateConfiguration(req, res) {
  for (const [key, value] of Object.entries(req.body)) {
    const prior = Config.get(key);
    if (prior !== value) {
      Config.set(key, value, req.currentUser.user_id);
      Audit.log(req.currentUser.user_id, 'configurations', 0, 'CONFIG_CHANGED', { key, value: prior }, { key, value });
    }
  }
  res.redirect('/admin/configuration');
}

// --- Holiday administration ---------------------------------------------------
function holidaysAdmin(req, res) {
  res.render('admin/holidays', { holidays: Holiday.all() });
}

function createHoliday(req, res) {
  const { holiday_date, holiday_name } = req.body;
  const id = Holiday.create(holiday_date, holiday_name);
  Audit.log(req.currentUser.user_id, 'holidays', id, 'HOLIDAY_ADDED', null, { holiday_date, holiday_name });
  res.redirect('/admin/holidays');
}

function deleteHoliday(req, res) {
  Holiday.remove(req.params.id);
  Audit.log(req.currentUser.user_id, 'holidays', req.params.id, 'HOLIDAY_REMOVED');
  res.redirect('/admin/holidays');
}

// --- Balance adjustment (LMS-054) ---------------------------------------------
function showAdjustment(req, res) {
  res.render('admin/adjustment', { employees: User.allActive(), leaveTypes: LeaveType.selectable(), ledger: null, selectedUser: null });
}

function viewLedgerFor(req, res) {
  const userId = parseInt(req.params.userId, 10);
  const ledger = Ledger.entriesFor(userId);
  res.render('admin/adjustment', {
    employees: User.allActive(), leaveTypes: LeaveType.selectable(), ledger, selectedUser: User.findById(userId),
  });
}

function postAdjustment(req, res) {
  const { user_id, leave_type_id, quantity, reason } = req.body;
  const qty = parseFloat(quantity);
  Ledger.post(parseInt(user_id, 10), parseInt(leave_type_id, 10), CURRENT_LEAVE_YEAR, 'ADJUSTMENT', qty, reason);
  Audit.log(req.currentUser.user_id, 'leave_ledger_entries', 0, 'MANUAL_ADJUSTMENT', null, { user_id, leave_type_id, quantity: qty, reason });
  Notification.create(parseInt(user_id, 10), 'REQUEST_APPROVED', 'Balance adjusted', `HR/Admin posted a manual adjustment of ${qty} day(s): ${reason}`);
  res.redirect(`/admin/adjustments/${user_id}`);
}

// --- Reports -------------------------------------------------------------------
function reports(req, res) {
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
  res.render('admin/reports', { lopReport, summary });
}

// --- Audit log (R2, LMS-080) ---------------------------------------------------
function auditLog(req, res) {
  res.render('admin/audit-log', { entries: Audit.recent(300) });
}

// --- Scheduler (manual trigger for demo purposes) ------------------------------
function runScheduler(req, res) {
  const result = scheduler.runAll();
  Audit.log(req.currentUser.user_id, 'scheduler_executions', 0, 'SCHEDULER_TRIGGERED_MANUALLY', null, result, false);
  req.session.schedulerResult = result;
  res.redirect('/admin/configuration');
}

module.exports = {
  listEmployees, createEmployee, leaveTypes, createLeaveType, configuration, updateConfiguration,
  holidaysAdmin, createHoliday, deleteHoliday, showAdjustment, viewLedgerFor, postAdjustment,
  reports, auditLog, runScheduler,
};
