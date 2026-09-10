const express = require('express');
const router = express.Router();
const { ensureAuthenticated, requireHrAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

router.use(ensureAuthenticated, requireHrAdmin);

router.get('/admin/employees', adminController.listEmployees);
router.post('/admin/employees', adminController.createEmployee);

router.get('/admin/leave-types', adminController.leaveTypes);
router.post('/admin/leave-types', adminController.createLeaveType);

router.get('/admin/configuration', adminController.configuration);
router.post('/admin/configuration', adminController.updateConfiguration);
router.post('/admin/configuration/run-scheduler', adminController.runScheduler);

router.get('/admin/holidays', adminController.holidaysAdmin);
router.post('/admin/holidays', adminController.createHoliday);
router.post('/admin/holidays/import', upload.single('holiday_csv'), adminController.importHolidays);
router.post('/admin/holidays/:id/delete', adminController.deleteHoliday);

// Working Patterns
router.get('/admin/working-patterns', adminController.listWorkingPatterns);
router.post('/admin/working-patterns', adminController.createWorkingPattern);
router.put('/admin/working-patterns/:id', adminController.updateWorkingPattern);
router.delete('/admin/working-patterns/:id', adminController.deleteWorkingPattern);

// Notification Templates
router.get('/admin/notification-templates', adminController.listNotificationTemplates);
router.post('/admin/notification-templates', adminController.createNotificationTemplate);
router.put('/admin/notification-templates/:id', adminController.updateNotificationTemplate);
router.delete('/admin/notification-templates/:id', adminController.deleteNotificationTemplate);

// Delegations
router.get('/admin/delegations', adminController.listDelegations);
router.post('/admin/delegations', adminController.createDelegation);
router.delete('/admin/delegations/:id', adminController.deleteDelegation);
router.get('/admin/departments', adminController.getDepartments);
router.post('/admin/departments', adminController.createDepartment);
router.delete('/admin/departments/:id', adminController.deleteDepartment);

// Self-Approval Settings
router.get('/admin/self-approval', adminController.getSelfApprovalSettings);
router.put('/admin/self-approval/:role', adminController.updateSelfApprovalSetting);

router.get('/admin/adjustments', adminController.showAdjustment);
router.get('/admin/adjustments/:userId', adminController.viewLedgerFor);
router.post('/admin/adjustments', adminController.postAdjustment);

router.get('/admin/reports', adminController.reports);
router.get('/admin/audit-log', adminController.auditLog);

module.exports = router;
