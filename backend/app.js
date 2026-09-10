const path = require('path');
const express = require('express');
const session = require('express-session');
const cron = require('node-cron');

const config = require('./config/env');
require('./database/db'); // ensures schema+seed exist before anything else runs

const authRoutes = require('./routes/authRoutes');
const Notification = require('./models/notificationModel');
const scheduler = require('./services/schedulerService');
const apiRoutes = require('./routes/apiRoutes');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// across instances; MemoryStore intentionally prints its own warning about this.
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 12 }, // LMS-002: session valid until midnight — simplified to 12h rolling for the demo
}));
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));
app.use('/api', apiRoutes);
// Microsoft Entra redirects are server-side OpenID Connect flows, so retain
// these two callback routes while the browser UI itself is React.
app.use('/auth', authRoutes);

// Expose unread notification count + auth mode to every authenticated view.
app.use((req, res, next) => {
  res.locals.authMode = config.authMode;
  res.locals.currentPath = req.path;
  res.locals.notifications = [];
  if (req.session.userId) {
    res.locals.unreadCount = Notification.unreadCount(req.session.userId);
    res.locals.notifications = Notification.forUser(req.session.userId).slice(0, 5);
  }
  next();
});

const clientBuild = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(clientBuild));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(clientBuild, 'index.html'), err => {
    if (err) next();
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith('/api/')) return res.status(500).json({ error: err.message });
  res.status(500).json({ error: err.message });
});

cron.schedule('0 2 * * *', () => {
  try { scheduler.runAll(); } catch (e) { console.error('[scheduler] failed:', e.message); }
});

app.listen(config.port, () => {
  console.log(`LMS 2.0 running at ${config.appBaseUrl} (AUTH_MODE=${config.authMode})`);
});
