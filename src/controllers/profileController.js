const User = require('../models/userModel');
const db = require('../../database/db');

function myProfile(req, res) {
  const u = req.currentUser;
  const department = u.department_id ? db.prepare(`SELECT department_name FROM departments WHERE department_id=?`).get(u.department_id) : null;
  const grade = u.grade_id ? db.prepare(`SELECT grade_name FROM grades WHERE grade_id=?`).get(u.grade_id) : null;
  const manager = u.manager_id ? User.findById(u.manager_id) : null;
  const projects = db.prepare(`
    SELECT p.project_name, pa.assigned_from, pa.assigned_to FROM project_assignments pa
    JOIN projects p ON p.project_id = pa.project_id WHERE pa.user_id = ?
  `).all(u.user_id);
  res.render('employee/profile', { department, grade, manager, projects });
}

module.exports = { myProfile };
