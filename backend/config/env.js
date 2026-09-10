require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  authMode: process.env.AUTH_MODE || 'dev',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  entra: {
    tenantId: process.env.ENTRA_TENANT_ID || '',
    clientId: process.env.ENTRA_CLIENT_ID || '',
    clientSecret: process.env.ENTRA_CLIENT_SECRET || '',
  },
};

// LMS-006: the dev/test auth mode "must be impossible to enable in a deployed
// environment... must be off by default" — refuse to boot rather than silently
// allow it in a production profile.
if (config.nodeEnv === 'production' && config.authMode === 'dev') {
  console.error('FATAL: AUTH_MODE=dev is not permitted when NODE_ENV=production. Set AUTH_MODE=entra and configure ENTRA_* variables.');
  process.exit(1);
}

module.exports = config;
