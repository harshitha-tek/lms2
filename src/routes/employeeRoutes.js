const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const dashboardController = require('../controllers/dashboardController');
const leaveController = require('../controllers/leaveController');
const calendarController = require('../controllers/calendarController');
const profileController = require('../controllers/profileController');
const notificationController = require('../controllers/notificationController');

router.use(ensureAuthenticated);

router.get('/dashboard', dashboardController.dashboard);

router.get('/leave/apply', leaveController.showApplyForm);
router.get('/leave/calculate', leaveController.calculate);
router.post('/leave/apply', leaveController.submitApplication);
router.get('/leave/my-requests', leaveController.myRequests);
router.get('/leave/:id', leaveController.requestDetail);
router.post('/leave/:id/withdraw', leaveController.withdraw);
router.post('/leave/:id/request-cancellation', leaveController.requestCancellation);

router.get('/holidays', calendarController.holidayCalendar);
router.get('/team-calendar', calendarController.teamCalendar);
router.get('/profile', profileController.myProfile);

router.get('/notifications', notificationController.centre);
router.post('/notifications/:id/read', notificationController.markRead);

module.exports = router;
