// Subsystem 1 — Identity & Access. Real Microsoft Entra ID sign-in via OpenID
// Connect (LMS-001). Only exercised when AUTH_MODE=entra and ENTRA_* env vars
// are set — see .env.example for how to register the app in Entra ID.
const { Issuer, generators } = require('openid-client');
const config = require('../config/env');

let client = null;

async function getClient() {
  if (client) return client;
  const issuer = await Issuer.discover(`https://login.microsoftonline.com/${config.entra.tenantId}/v2.0`);
  client = new issuer.Client({
    client_id: config.entra.clientId,
    client_secret: config.entra.clientSecret,
    redirect_uris: [`${config.appBaseUrl}/auth/callback`],
    response_types: ['code'],
  });
  return client;
}

async function buildAuthorizationUrl(session) {
  const c = await getClient();
  const state = generators.state();
  const nonce = generators.nonce();
  session.oidcState = state;
  session.oidcNonce = nonce;
  return c.authorizationUrl({ scope: 'openid profile email', state, nonce });
}

async function handleCallback(req) {
  const c = await getClient();
  const params = c.callbackParams(req);
  const tokenSet = await c.callback(`${config.appBaseUrl}/auth/callback`, params, {
    state: req.session.oidcState,
    nonce: req.session.oidcNonce,
  });
  const claims = tokenSet.claims();
  // Reads identity claims ONLY — reporting hierarchy, department, grade, and
  // project assignment stay in the LMS database (LMS-004). Entra is not the
  // source of organisational structure.
  return {
    entra_object_id: claims.oid || claims.sub,
    email: claims.email || claims.preferred_username,
    full_name: claims.name || claims.email,
  };
}

module.exports = { buildAuthorizationUrl, handleCallback };
