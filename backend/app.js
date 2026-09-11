const path = require('path');
const express = require('express');
const session = require('express-session');
const cron = require('node-cron');

const config = require('./config/env');
require('./database/db'); // ensures schema+seed exist before anything else runs

const authRoutes = require('./routes/authRoutes');
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
// Microsoft Entra sign-in is a server-side OpenID Connect redirect flow, so
// /auth/login and /auth/callback stay server-side even though the UI is React.
app.use('/auth', authRoutes);

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
  res.status(500).json({ error: err.message });
});

cron.schedule('0 2 * * *', () => {
  try { scheduler.runAll(); } catch (e) { console.error('[scheduler] failed:', e.message); }
});

app.listen(config.port, () => {
  console.log(`LMS 2.0 running at ${config.appBaseUrl} (AUTH_MODE=${config.authMode})`);
});
