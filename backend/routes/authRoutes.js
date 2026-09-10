const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/login', authController.showLogin);
router.post('/dev-login', authController.devLogin);
router.get('/callback', authController.entraCallback);
router.get('/logout', authController.logout);

module.exports = router;
