const db = require('../database/db');
const Audit = require('../models/auditModel');

function getDepartments(req, res) {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  res.json(db.prepare(`SELECT * FROM departments ORDER BY department_code`).all());
}

function createDepartment(req, res) {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const department_code = String(req.body.department_code || '').trim();
  const department_name = String(req.body.department_name || '').trim();
  if (!department_code || !department_name) return res.status(400).json({ error: 'Code and name are required.' });
  const clash = db.prepare(`SELECT 1 FROM departments WHERE department_code = ? OR department_name = ?`).get(department_code, department_name);
  if (clash) return res.status(409).json({ error: 'A department with that code or name already exists.' });
  const info = db.prepare(`INSERT INTO departments (department_code, department_name) VALUES (?, ?)`).run(department_code, department_name);
  Audit.log(req.currentUser.user_id, 'departments', info.lastInsertRowid, 'DEPARTMENT_CREATED');
  res.status(201).json({ success: true, department_id: info.lastInsertRowid });
}

function deleteDepartment(req, res) {
  if (!req.currentUser.isHrAdmin) return res.status(403).json({ error: 'HR/Admin required.' });
  const inUse = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE department_id = ?`).get(req.params.id);
  if (inUse && inUse.n > 0) return res.status(409).json({ error: `Cannot delete: ${inUse.n} employee(s) still assigned to this department.` });
  db.prepare(`DELETE FROM departments WHERE department_id = ?`).run(req.params.id);
  Audit.log(req.currentUser.user_id, 'departments', req.params.id, 'DEPARTMENT_DELETED');
  res.json({ success: true });
}

module.exports = { getDepartments, createDepartment, deleteDepartment };
