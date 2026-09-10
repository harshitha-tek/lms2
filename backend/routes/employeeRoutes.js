const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const dashboardController = require('../controllers/dashboardController');
const leaveController = require('../controllers/leaveController');
const calendarController = require('../controllers/calendarController');
const profileController = require('../controllers/profileController');
const notificationController = require('../controllers/notificationController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDirectory = path.join(__dirname, '..', '..', 'frontend', 'public', 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });
const leaveUpload = multer({
	storage: multer.diskStorage({
		destination: uploadDirectory,
		filename: (req, file, callback) => callback(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
	}),
	limits: { fileSize: 5 * 1024 * 1024 },
});
const profileUpload = multer({
	storage: multer.diskStorage({
		destination: uploadDirectory,
		filename: (req, file, callback) => callback(null, `profile-${req.currentUser.user_id}-${Date.now()}.jpg`),
	}),
	limits: { fileSize: 2 * 1024 * 1024 },
	fileFilter: (req, file, callback) => callback(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
});

router.use(ensureAuthenticated);

router.get('/dashboard', dashboardController.dashboard);

router.get('/leave/apply', leaveController.showApplyForm);
router.get('/leave/calculate', leaveController.calculate);
router.post('/leave/apply', leaveUpload.single('attachment'), leaveController.submitApplication);
router.get('/leave/my-requests', leaveController.myRequests);
router.get('/leave/:id', leaveController.requestDetail);
router.post('/leave/:id/withdraw', leaveController.withdraw);
router.post('/leave/:id/request-cancellation', leaveController.requestCancellation);

router.get('/holidays', calendarController.holidayCalendar);
router.get('/team-calendar', calendarController.teamCalendar);
router.get('/profile', profileController.myProfile);
router.post('/profile', profileUpload.single('profile_image'), profileController.updateProfile);

router.get('/notifications', notificationController.centre);
router.post('/notifications/:id/read', notificationController.markRead);

module.exports = router;
