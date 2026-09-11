const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ensureAuthenticated } = require('../middleware/auth');
const User = require('../models/userModel');

// Import all controllers
const dashboardController = require('../controllers/dashboardController');
const leaveController = require('../controllers/leaveController');
const approvalController = require('../controllers/approvalController');
const managerController = require('../controllers/managerController');
const employeeController = require('../controllers/employeeController');
const departmentController = require('../controllers/departmentController');
const leaveTypeController = require('../controllers/leaveTypeController');

const router = express.Router();
const uploadDirectory = path.join(__dirname, '..', '..', 'frontend', 'public', 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });
const upload = multer({ storage: multer.diskStorage({
  destination: uploadDirectory,
  filename: (req, file, done) => done(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
}), limits: { fileSize: 5 * 1024 * 1024 } });

// ============= AUTH ENDPOINTS (unprotected) =============
router.get('/auth/session', (req, res) => {
  const user = req.session.userId ? User.findById(req.session.userId) : null;
  res.json({ user, authMode: require('../config/env').authMode });
});

router.post('/auth/dev-login', (req, res) => {
  const user = User.findById(Number(req.body.user_id));
  if (!user) return res.status(401).json({ error: 'Invalid user.' });
  req.session.userId = user.user_id;
  const Audit = require('../models/auditModel');
  Audit.log(user.user_id, 'users', user.user_id, 'SIGN_IN');
  res.json({ user });
});

router.post('/auth/logout', (req, res) => {
  const userId = req.session.userId;
  if (userId) {
    const Audit = require('../models/auditModel');
    Audit.log(userId, 'users', userId, 'SIGN_OUT');
  }
  req.session.destroy(() => res.status(204).end());
});

router.get('/auth/users', (req, res) => res.json(User.allActive()));

// ============= PROTECTED ENDPOINTS (require authentication) =============
router.use(ensureAuthenticated);

// Dashboard
router.get('/dashboard', dashboardController.getDashboard);

// Leave Management
router.get('/leave/calculate', leaveController.calculateLeave);
router.get('/leave/requests', leaveController.getLeaveRequests);
router.get('/leave/requests/:id', leaveController.getLeaveRequest);
router.post('/leave/requests', upload.single('attachment'), leaveController.createLeaveRequest);
router.post('/leave/requests/:id/withdraw', leaveController.withdrawLeaveRequest);
router.post('/leave/requests/:id/cancel', leaveController.cancelLeaveRequest);
router.get('/leave/peer-calendar', leaveController.getPeerCalendar);

// Manager Approvals
router.get('/manager/approvals', approvalController.getManagerApprovals);
router.post('/manager/approvals/:id/decide', approvalController.decideApproval);
router.post('/manager/approvals/:id/decide-cancellation', approvalController.decideCancellation);

// Manager Team & Delegation
router.get('/manager/team', managerController.getMyTeam);
router.get('/manager/delegations', managerController.getMyDelegations);
router.post('/manager/delegations', managerController.createDelegation);
router.delete('/manager/delegations/:id', managerController.deleteDelegation);

// Admin: Employees
router.get('/admin/employees', employeeController.listEmployees);
router.post('/admin/employees', employeeController.createEmployee);
router.put('/admin/employees/:id', employeeController.updateEmployee);

// Admin: Departments
router.get('/admin/departments', departmentController.getDepartments);
router.post('/admin/departments', departmentController.createDepartment);
router.delete('/admin/departments/:id', departmentController.deleteDepartment);

// Admin: Leave Types
router.get('/admin/leave-types', leaveTypeController.getLeaveTypes);
router.post('/admin/leave-types', leaveTypeController.createLeaveType);

// Admin: Balance Adjustments
router.get('/admin/adjustments/:userId', employeeController.viewLedger);
router.post('/admin/adjustments', employeeController.adjustBalance);

// NOTE: Additional admin controllers (configuration, holidays, working patterns, reports) should follow same pattern

// Profile (protected)
const Ledger = require('../models/ledgerModel');
const Audit = require('../models/auditModel');
const db = require('../database/db');

router.get('/profile', (req, res) => {
  const profile = db.prepare(`
    SELECT u.*, d.department_name, d.department_code, g.grade_name, g.grade_code,
           m.full_name AS manager_name, m.email AS manager_email, ml.level_name
    FROM users u
    LEFT JOIN departments d ON d.department_id = u.department_id
    LEFT JOIN grades g ON g.grade_id = u.grade_id
    LEFT JOIN users m ON m.user_id = u.manager_id
    LEFT JOIN management_levels ml ON ml.level_id = u.management_level_id
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
