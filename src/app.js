const path = require('path');
const express = require('express');
const session = require('express-session');
const cron = require('node-cron');

const config = require('./config/env');
require('../database/db'); // ensures schema+seed exist before anything else runs

const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const managerRoutes = require('./routes/managerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const Notification = require('./models/notificationModel');
const scheduler = require('./services/schedulerService');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory session store — fine for this single-process demo. If you deploy
// behind multiple instances/processes, swap in a shared store (Redis, a
// database-backed store, etc.) so sessions survive a restart or load-balancing
// across instances; MemoryStore intentionally prints its own warning about this.
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 12 }, // LMS-002: session valid until midnight — simplified to 12h rolling for the demo
}));

// Expose unread notification count + auth mode to every authenticated view.
app.use((req, res, next) => {
  res.locals.authMode = config.authMode;
  res.locals.currentPath = req.path;
  if (req.session.userId) {
    res.locals.unreadCount = Notification.unreadCount(req.session.userId);
  }
  next();
});

app.get('/', (req, res) => res.redirect(req.session.userId ? '/dashboard' : '/auth/login'));

app.use('/auth', authRoutes);
app.use('/', employeeRoutes);
app.use('/', managerRoutes);
app.use('/', adminRoutes);

app.use((req, res) => res.status(404).render('error', { title: 'Not found', message: 'That page does not exist.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Something went wrong', message: err.message });
});

// Subsystem 15 — background jobs also run on a real schedule, not only via
// the admin "Run now" button. Runs are idempotent (scheduler_executions),
// so a restart never double-posts.
cron.schedule('0 2 * * *', () => {
  try { scheduler.runAll(); } catch (e) { console.error('[scheduler] failed:', e.message); }
});

app.listen(config.port, () => {
  console.log(`LMS 2.0 running at ${config.appBaseUrl} (AUTH_MODE=${config.authMode})`);
});
