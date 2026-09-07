const config = require('../config/env');
const User = require('../models/userModel');
const Audit = require('../models/auditModel');
const entraAuth = require('../services/entraAuthService');

async function showLogin(req, res) {
  if (config.authMode === 'entra') {
    try {
      const url = await entraAuth.buildAuthorizationUrl(req.session);
      return res.redirect(url);
    } catch (err) {
      return res.render('auth/login', { authMode: 'entra', entraError: err.message, users: [] });
    }
  }
  const users = User.allActive();
  res.render('auth/login', { authMode: 'dev', entraError: null, users });
}

function devLogin(req, res) {
  const userId = parseInt(req.body.user_id, 10);
  const user = User.findById(userId);
  if (!user) return res.redirect('/auth/login');
  req.session.userId = user.user_id;
  Audit.log(user.user_id, 'users', user.user_id, 'SIGN_IN');
  res.redirect('/dashboard');
}

async function entraCallback(req, res) {
  try {
    const profile = await entraAuth.handleCallback(req);
    let user = User.findByEntraObjectId(profile.entra_object_id);
    if (!user) {
      // LMS-003: authenticated against Entra but no employee record -> refuse, log, direct to HR.
      Audit.log(null, 'users', 0, 'SIGN_IN_REFUSED_NO_EMPLOYEE_RECORD', null, { entra_object_id: profile.entra_object_id }, false);
      return res.status(403).render('error', {
        title: 'No employee record found',
        message: 'You authenticated successfully, but no employee record exists for your account. Please contact HR.',
      });
    }
    req.session.userId = user.user_id;
    Audit.log(user.user_id, 'users', user.user_id, 'SIGN_IN');
    res.redirect('/dashboard');
  } catch (err) {
    res.status(500).render('error', { title: 'Sign-in failed', message: err.message });
  }
}

function logout(req, res) {
  const userId = req.session.userId;
  if (userId) Audit.log(userId, 'users', userId, 'SIGN_OUT');
  req.session.destroy(() => res.redirect('/auth/login'));
}

module.exports = { showLogin, devLogin, entraCallback, logout };
