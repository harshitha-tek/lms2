const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Microsoft Entra sign-in is a server-side OpenID Connect redirect flow, so
// these two routes stay server-rendered even though the rest of the UI is React.
// Dev sign-in, session lookup and logout for the SPA all live under /api/auth/*.
router.get('/login', authController.showLogin);
router.get('/callback', authController.entraCallback);

module.exports = router;
