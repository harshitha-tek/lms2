// Subsystem 1 — server-side authorisation on every request (LMS-005, LMS-008).
// Client-side role checks (hiding a nav item) are presentation only and are
// never the sole control — every controller re-checks here.
const User = require('../models/userModel');

function ensureAuthenticated(req, res, next) {
  if (!req.session.userId) {
    if (req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Authentication required.' });
    return res.redirect('/auth/login');
  }
  req.currentUser = User.findById(req.session.userId);
  if (!req.currentUser || !req.currentUser.is_active) {
    req.session.destroy(() => {});
    if (req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Authentication required.' });
    return res.redirect('/auth/login');
  }
  res.locals.currentUser = req.currentUser;
  next();
}

module.exports = { ensureAuthenticated };
