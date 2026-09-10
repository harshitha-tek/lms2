const dayjs = require('dayjs');
const db = require('../database/db');
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
  const allEmployees = User.all();
  const query = (req.query.q || '').trim().toLowerCase();
  const status = req.query.status || 'all';
  const departmentId = req.query.department_id || 'all';
  const employees = allEmployees.filter(employee =>
    (!query || `${employee.full_name} ${employee.employee_code} ${employee.email}`.toLowerCase().includes(query))
    && (status === 'all' || (status === 'active' ? employee.is_active : !employee.is_active))
    && (departmentId === 'all' || String(employee.department_id) === departmentId)
  );
  const departments = db.prepare(`SELECT * FROM departments`).all();
  const grades = db.prepare(`SELECT * FROM grades`).all();
  const managementLevels = db.prepare(`SELECT * FROM management_levels`).all();
  res.render('admin/employees', { employees, allEmployees, departments, grades, managementLevels, filters: { query: req.query.q || '', status, departmentId } });
}

function createEmployee(req, res) {
  const { employee_code, email, full_name, department_id, grade_id, management_level_id, manager_id, joined_date, employee_type } = req.body;
  if (manager_id && User.wouldCreateCycle(0, parseInt(manager_id, 10))) {
    // (defensive check; real cycle check happens against the new row once it has an id)
  }
  const entra_object_id = `dev-${employee_code}-${Date.now()}`;
  const type = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN'].includes(employee_type) ? employee_type : 'EMPLOYEE';
  const id = User.create({ employee_code, entra_object_id, email, full_name, department_id, grade_id, management_level_id, manager_id: manager_id || null, joined_date, employee_type: type });
  Audit.log(req.currentUser.user_id, 'users', id, 'EMPLOYEE_CREATED');
  res.redirect('/admin/employees');
}

// --- Leave types & policy ----------------------------------------------------
function leaveTypes(req, res) {
  const query = (req.query.q || '').trim().toLowerCase();
  const allLeaveTypes = LeaveType.all();
  const leaveTypes = allLeaveTypes.filter(type => !query || `${type.leave_name} ${type.leave_code}`.toLowerCase().includes(query));
  const allowed = new Set(leaveTypes.map(type => type.leave_type_id));
  const policies = LeaveType.allPolicies().filter(policy => allowed.has(policy.leave_type_id));
  res.render('admin/leave-types', { leaveTypes, policies, filterQuery: req.query.q || '' });
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
  const pageSize = 8;
  const filters = {
    query: typeof req.query.q === 'string' ? req.query.q : '',
    year: typeof req.query.year === 'string' ? req.query.year : 'all',
    type: typeof req.query.type === 'string' ? req.query.type : 'all',
  };
  const filteredHolidays = Holiday.filter(filters);
  const requestedPage = parseInt(req.query.page, 10);
  const totalHolidays = filteredHolidays.length;
  const totalPages = Math.max(1, Math.ceil(totalHolidays / pageSize));
  const page = Math.min(Math.max(Number.isNaN(requestedPage) ? 1 : requestedPage, 1), totalPages);
  res.render('admin/holidays', {
    holidays: filteredHolidays.slice((page - 1) * pageSize, page * pageSize),
    page, pageSize, totalHolidays, totalPages, filters, holidayYears: Holiday.years(),
    imported: req.query.imported || null,
    skipped: req.query.skipped || null,
    importError: req.query.error || null,
  });
}

function createHoliday(req, res) {
  const { holiday_date, holiday_name, holiday_type } = req.body;
  const type = ['NATIONAL', 'FESTIVAL', 'OPTIONAL'].includes(holiday_type) ? holiday_type : 'NATIONAL';
  const id = Holiday.create(holiday_date, holiday_name, type);
  Audit.log(req.currentUser.user_id, 'holidays', id, 'HOLIDAY_ADDED', null, { holiday_date, holiday_name, holiday_type: type });
  res.redirect('/admin/holidays');
}

function parseCsvRow(line) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }
  values.push(value.trim());
  return values;
}

function importHolidays(req, res) {
  if (!req.file) return res.redirect('/admin/holidays?error=Choose%20a%20CSV%20file.');

  const lines = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return res.redirect('/admin/holidays?error=The%20CSV%20file%20is%20empty.');

  const firstRow = parseCsvRow(lines[0]).map(value => value.toLowerCase());
  const hasHeader = firstRow.includes('holiday_date') || firstRow.includes('date');
  const dateIndex = hasHeader ? firstRow.findIndex(value => value === 'holiday_date' || value === 'date') : 0;
  const nameIndex = hasHeader ? firstRow.findIndex(value => value === 'holiday_name' || value === 'name') : 1;
  const typeIndex = hasHeader ? firstRow.findIndex(value => value === 'holiday_type' || value === 'type') : 2;
  const rows = hasHeader ? lines.slice(1) : lines;
  const existingDates = new Set(Holiday.all().map(holiday => holiday.holiday_date));
  const valid = [];
  const errors = [];

  rows.forEach((line, index) => {
    const rowNumber = hasHeader ? index + 2 : index + 1;
    const values = parseCsvRow(line);
    const date = values[dateIndex];
    const name = values[nameIndex];
    const type = (values[typeIndex] || 'NATIONAL').toUpperCase();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !dayjs(date).isValid()) {
      errors.push(`row ${rowNumber}: invalid date`);
    } else if (!name) {
      errors.push(`row ${rowNumber}: holiday name is required`);
    } else if (!['NATIONAL', 'FESTIVAL', 'OPTIONAL'].includes(type)) {
      errors.push(`row ${rowNumber}: type must be NATIONAL, FESTIVAL or OPTIONAL`);
    } else if (existingDates.has(date) || valid.some(holiday => holiday.date === date)) {
      errors.push(`row ${rowNumber}: date already exists`);
    } else {
      valid.push({ date, name, type });
    }
  });

  if (valid.length) {
    Holiday.createMany(valid);
    Audit.log(req.currentUser.user_id, 'holidays', 0, 'HOLIDAYS_IMPORTED', null, { imported: valid.length, skipped: errors.length });
  }

  const query = new URLSearchParams({ imported: String(valid.length), skipped: String(errors.length) });
  if (errors.length) query.set('error', errors.slice(0, 3).join('; '));
  res.redirect(`/admin/holidays?${query.toString()}`);
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

// --- Working Patterns ----------------------------------------------------------
function listWorkingPatterns(req, res) {
  const patterns = db.prepare('SELECT * FROM working_patterns').all();
  res.json({ patterns });
}

function createWorkingPattern(req, res) {
  const { pattern_code, pattern_name } = req.body;
  const stmt = db.prepare('INSERT INTO working_patterns (pattern_code, pattern_name) VALUES (?, ?)');
  const info = stmt.run(pattern_code, pattern_name);
  Audit.log(req.currentUser.user_id, 'working_patterns', info.lastInsertRowid, 'WORKING_PATTERN_CREATED');
  res.json({ success: true, id: info.lastInsertRowid });
}

function updateWorkingPattern(req, res) {
  const { id } = req.params;
  const { pattern_code, pattern_name } = req.body;
  const stmt = db.prepare('UPDATE working_patterns SET pattern_code = ?, pattern_name = ? WHERE working_pattern_id = ?');
  stmt.run(pattern_code, pattern_name, id);
  Audit.log(req.currentUser.user_id, 'working_patterns', id, 'WORKING_PATTERN_UPDATED');
  res.json({ success: true });
}

function deleteWorkingPattern(req, res) {
  const { id } = req.params;
  const stmt = db.prepare('DELETE FROM working_patterns WHERE working_pattern_id = ?');
  stmt.run(id);
  Audit.log(req.currentUser.user_id, 'working_patterns', id, 'WORKING_PATTERN_DELETED');
  res.json({ success: true });
}

// --- Notification Templates ----------------------------------------------------
function listNotificationTemplates(req, res) {
  const templates = db.prepare('SELECT * FROM notification_templates').all();
  res.json({ templates });
}

function createNotificationTemplate(req, res) {
  const { notification_type, channel, subject_template, body_template } = req.body;
  const stmt = db.prepare(`INSERT INTO notification_templates (notification_type, channel, subject_template, body_template) VALUES (?,?,?,?)`);
  const info = stmt.run(notification_type, channel, subject_template, body_template);
  Audit.log(req.currentUser.user_id, 'notification_templates', info.lastInsertRowid, 'NOTIF_TEMPLATE_CREATED');
  res.json({ success: true, id: info.lastInsertRowid });
}

function updateNotificationTemplate(req, res) {
  const { id } = req.params;
  const { channel, subject_template, body_template } = req.body;
  const stmt = db.prepare(`UPDATE notification_templates SET channel = ?, subject_template = ?, body_template = ? WHERE notification_template_id = ?`);
  stmt.run(channel, subject_template, body_template, id);
  Audit.log(req.currentUser.user_id, 'notification_templates', id, 'NOTIF_TEMPLATE_UPDATED');
  res.json({ success: true });
}

function deleteNotificationTemplate(req, res) {
  const { id } = req.params;
  const stmt = db.prepare('DELETE FROM notification_templates WHERE notification_template_id = ?');
  stmt.run(id);
  Audit.log(req.currentUser.user_id, 'notification_templates', id, 'NOTIF_TEMPLATE_DELETED');
  res.json({ success: true });
}

// --- Delegations --------------------------------------------------------------
function listDelegations(req, res) {
  const delegations = db.prepare('SELECT * FROM delegations').all();
  res.json({ delegations });
}

function createDelegation(req, res) {
  const { manager_id, delegate_id, effective_from, effective_to } = req.body;
  const stmt = db.prepare('INSERT INTO delegations (manager_id, delegate_id, effective_from, effective_to) VALUES (?,?,?,?)');
  const info = stmt.run(manager_id, delegate_id, effective_from, effective_to || null);
  Audit.log(req.currentUser.user_id, 'delegations', info.lastInsertRowid, 'DELEGATION_CREATED');
  res.json({ success: true, id: info.lastInsertRowid });
}

function deleteDelegation(req, res) {
  const { id } = req.params;
  const stmt = db.prepare('DELETE FROM delegations WHERE delegation_id = ?');
  stmt.run(id);
  Audit.log(req.currentUser.user_id, 'delegations', id, 'DELEGATION_DELETED');
  res.json({ success: true });
}

// --- Departments --------------------------------------------------------------
function getDepartments(req, res) {
  const departments = db.prepare('SELECT * FROM departments').all();
  res.json({ departments });
}

function createDepartment(req, res) {
  const { department_code, department_name } = req.body;
  const stmt = db.prepare('INSERT INTO departments (department_code, department_name) VALUES (?, ?)');
  const info = stmt.run(department_code, department_name);
  Audit.log(req.currentUser.user_id, 'departments', info.lastInsertRowid, 'DEPARTMENT_CREATED');
  res.json({ success: true, id: info.lastInsertRowid });
}

function deleteDepartment(req, res) {
  const { id } = req.params;
  const stmt = db.prepare('DELETE FROM departments WHERE department_id = ?');
  stmt.run(id);
  Audit.log(req.currentUser.user_id, 'departments', id, 'DEPARTMENT_DELETED');
  res.json({ success: true });
}

// --- Self‑Approval Settings ---------------------------------------------------
function getSelfApprovalSettings(req, res) {
  // Store settings in configurations table with key pattern SELF_APPROVAL_<ROLE>
  const rows = db.prepare(`SELECT configuration_key, configuration_value FROM configurations WHERE configuration_key LIKE 'SELF_APPROVAL_%'`).all();
  const settings = {};
  rows.forEach(r => {
    const role = r.configuration_key.replace('SELF_APPROVAL_', '');
    settings[role] = r.configuration_value === 'true';
  });
  res.json({ settings });
}

function updateSelfApprovalSetting(req, res) {
  const { role } = req.params; // e.g., MANAGER, HR_ADMIN
  const { enabled } = req.body; // expect boolean or 'true'/'false'
  const key = `SELF_APPROVAL_${role.toUpperCase()}`;
  const value = enabled === true || enabled === 'true' ? 'true' : 'false';
  Config.set(key, value, req.currentUser.user_id);
  Audit.log(req.currentUser.user_id, 'configurations', 0, 'SELF_APPROVAL_UPDATED', { role, previous: null }, { role, enabled: value });
  res.json({ success: true, role, enabled: value });
}

module.exports = {
  listEmployees, createEmployee, leaveTypes, createLeaveType, configuration, updateConfiguration,
  holidaysAdmin, createHoliday, importHolidays, deleteHoliday, showAdjustment, viewLedgerFor, postAdjustment,
  reports, auditLog, runScheduler,
  listWorkingPatterns, createWorkingPattern, updateWorkingPattern, deleteWorkingPattern,
  listNotificationTemplates, createNotificationTemplate, updateNotificationTemplate, deleteNotificationTemplate,
  listDelegations, createDelegation, deleteDelegation,
  getSelfApprovalSettings, updateSelfApprovalSetting,
  getDepartments, createDepartment, deleteDepartment
};
