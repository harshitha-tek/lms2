// Subsystem 1 — server-side authorisation on every request (LMS-005, LMS-008).
// Client-side role checks (hiding a nav item) are presentation only and are
// never the sole control — every controller re-checks here.
const User = require('../models/userModel');

function ensureAuthenticated(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }
  req.currentUser = User.findById(req.session.userId);
  if (!req.currentUser || !req.currentUser.is_active) {
    req.session.destroy(() => {});
    return res.redirect('/auth/login');
  }
  res.locals.currentUser = req.currentUser;
  next();
}

function requireManager(req, res, next) {
  if (!req.currentUser.isManager) {
    return res.status(403).render('error', { title: 'Access denied', message: 'Manager access is required for this page.' });
  }
  next();
}

function requireHrAdmin(req, res, next) {
  if (!req.currentUser.isHrAdmin) {
    return res.status(403).render('error', { title: 'Access denied', message: 'HR/Admin access is required for this page.' });
  }
  next();
}

module.exports = { ensureAuthenticated, requireManager, requireHrAdmin };
