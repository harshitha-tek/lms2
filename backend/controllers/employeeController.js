const User = require('../models/userModel');
const Ledger = require('../models/ledgerModel');
const Notification = require('../models/notificationModel');
const Audit = require('../models/auditModel');
const db = require('../database/db');

function listEmployees(req, res) {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const allEmployees = User.all();
  const departments = db.prepare(`SELECT * FROM departments`).all();
  const grades = db.prepare(`SELECT * FROM grades`).all();
  const managementLevels = db.prepare(`SELECT * FROM management_levels`).all();
  res.json({ employees: allEmployees, departments, grades, managementLevels });
}

function createEmployee(req, res) {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { employee_code, email, full_name, department_id, grade_id, management_level_id, manager_id, joined_date, employee_type } = req.body;
  const entra_object_id = `dev-${employee_code}-${Date.now()}`;
  const type = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN'].includes(employee_type) ? employee_type : 'EMPLOYEE';
  const id = User.create({ employee_code, entra_object_id, email, full_name, department_id, grade_id, management_level_id, manager_id: manager_id || null, joined_date, employee_type: type });
  Audit.log(req.currentUser.user_id, 'users', id, 'EMPLOYEE_CREATED');
  res.status(201).json({ success: true, id });
}

function updateEmployee(req, res) {
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
}

function viewLedger(req, res) {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const userId = parseInt(req.params.userId, 10);
  const ledger = Ledger.entriesFor(userId);
  const user = User.findById(userId);
  res.json({ ledger, user });
}

function adjustBalance(req, res) {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const { user_id, leave_type_id, quantity, reason } = req.body;
  const qty = parseFloat(quantity);
  const CURRENT_LEAVE_YEAR = new Date().getFullYear();
  if (!Number.isFinite(qty) || qty === 0 || !reason?.trim()) return res.status(400).json({ error: 'Quantity and reason are required.' });
  const direction = qty > 0 ? 'CREDIT' : 'DEBIT';
  Ledger.post(user_id, leave_type_id, CURRENT_LEAVE_YEAR, direction, Math.abs(qty), reason.trim());
  Audit.log(req.currentUser.user_id, 'leave_types', leave_type_id, 'BALANCE_ADJUSTED', null, { user_id, qty, reason });
  res.json({ success: true });
}

module.exports = { listEmployees, createEmployee, updateEmployee, viewLedger, adjustBalance };
