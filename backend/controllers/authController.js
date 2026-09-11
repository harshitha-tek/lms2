const config = require('../config/env');
const User = require('../models/userModel');
const Audit = require('../models/auditModel');
const entraAuth = require('../services/entraAuthService');

// The browser UI is a React SPA served from frontend/dist. The only reason any
// auth route is still server-side is the Microsoft Entra OpenID Connect redirect
// flow, which has to happen outside the SPA. Everything else the SPA needs
// (dev sign-in, session lookup, logout) lives under /api/auth/*.

async function showLogin(req, res) {
  if (config.authMode === 'entra') {
    try {
      const url = await entraAuth.buildAuthorizationUrl(req.session);
      return res.redirect(url);
    } catch (err) {
      return res.redirect(`/?authError=${encodeURIComponent(err.message)}`);
    }
  }
  // Dev mode: the SPA sign-in screen handles persona selection itself.
  res.redirect('/');
}

async function entraCallback(req, res) {
  try {
    const profile = await entraAuth.handleCallback(req);
    const user = User.findByEntraObjectId(profile.entra_object_id);
    if (!user) {
      // LMS-003: authenticated against Entra but no employee record -> refuse, log, direct to HR.
      Audit.log(null, 'users', 0, 'SIGN_IN_REFUSED_NO_EMPLOYEE_RECORD', null, { entra_object_id: profile.entra_object_id }, false);
      return res.redirect('/?authError=' + encodeURIComponent('No employee record exists for your account. Please contact HR.'));
    }
    req.session.userId = user.user_id;
    Audit.log(user.user_id, 'users', user.user_id, 'SIGN_IN');
    res.redirect('/');
  } catch (err) {
    res.redirect(`/?authError=${encodeURIComponent(err.message)}`);
  }
}

module.exports = { showLogin, entraCallback };
