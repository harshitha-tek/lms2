const express = require('express');
const router = express.Router();
const { ensureAuthenticated, requireHrAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

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
router.post('/admin/holidays/:id/delete', adminController.deleteHoliday);

router.get('/admin/adjustments', adminController.showAdjustment);
router.get('/admin/adjustments/:userId', adminController.viewLedgerFor);
router.post('/admin/adjustments', adminController.postAdjustment);

router.get('/admin/reports', adminController.reports);
router.get('/admin/audit-log', adminController.auditLog);

module.exports = router;
