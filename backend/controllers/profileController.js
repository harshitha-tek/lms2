const User = require('../models/userModel');
const db = require('../database/db');

function myProfile(req, res) {
  const u = req.currentUser;
  const department = u.department_id ? db.prepare(`SELECT department_name FROM departments WHERE department_id=?`).get(u.department_id) : null;
  const grade = u.grade_id ? db.prepare(`SELECT grade_name FROM grades WHERE grade_id=?`).get(u.grade_id) : null;
  const manager = u.manager_id ? User.findById(u.manager_id) : null;
  const projects = db.prepare(`
    SELECT p.project_name, pa.assigned_from, pa.assigned_to FROM project_assignments pa
    JOIN projects p ON p.project_id = pa.project_id WHERE pa.user_id = ?
  `).all(u.user_id);
  res.render('employee/profile', { department, grade, manager, projects, profileError: req.query.error || null });
}

function updateProfile(req, res) {
  const fullName = (req.body.full_name || '').trim();
  if (!fullName) {
    return res.redirect('/profile?error=Name%20is%20required.');
  }
  User.updateProfile(req.currentUser.user_id, {
    full_name: fullName,
    phone_number: (req.body.phone_number || '').trim(),
    personal_email: (req.body.personal_email || '').trim(),
    profile_image: req.file ? req.file.filename : null,
    remove_profile_image: req.body.remove_profile_image === 'true',
  });
  res.redirect('/profile');
}

module.exports = { myProfile, updateProfile };
