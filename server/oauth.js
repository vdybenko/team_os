// OAuth 2.1 authorization server for the TeamOS MCP connector (Claude, Codex and other MCP clients).
//
//   Discovery   /.well-known/oauth-protected-resource[/mcp]  (RFC 9728)
//               /.well-known/oauth-authorization-server       (RFC 8414)
//   Clients     POST /oauth/register                          (dynamic client registration, RFC 7591)
//   Consent     GET  /oauth/authorize → /oauth/consent         (authorization code + PKCE S256 only)
//   Tokens      POST /oauth/token, POST /oauth/revoke          (refresh tokens rotate, RFC 7009 revocation)
//   Manage      GET  /oauth/connections                        (the user's connected apps, revoke)
//
// The user signs in with the same TeamOS session (email link or dev login) and picks, per connection,
// an access level (read / write / manage) and which workspaces it can reach (all, or one team).
// A connection is a "grant" record; access tokens are short-lived signed references to it, so
// revoking the grant cuts access immediately.

import crypto from 'node:crypto';
import express from 'express';
import * as store from './store.js';
import { origin, devLoginAllowed, magicLinkConfigured } from './auth.js';
import { langOf, tr } from './i18n.js';

export const RESOURCE = `${origin}/mcp`;
export const SCOPES = ['read', 'write', 'manage'];
const ACCESS_TTL = 3600;                 // seconds
const REFRESH_TTL = 90 * 864e5;          // ms, sliding
const CODE_TTL = 10 * 60_000;
const REQUEST_TTL = 30 * 60_000;
const REUSE_GRACE = 60_000;              // a just-rotated refresh token may be retried once in this window

const digest = (v) => crypto.createHash('sha256').update(v).digest('hex');
const random = (n = 32) => crypto.randomBytes(n).toString('base64url');
const safeEqual = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const hmac = async (purpose, data) => crypto.createHmac('sha256', await store.sessionSecret()).update(`teamos-oauth.${purpose}.${data}`).digest('base64url');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const LOOPBACK = ['localhost', '127.0.0.1', '[::1]'];

/* ---------------- scopes ---------------- */

// "write" includes "read"; "manage" includes both.
export function expandScope(list) {
  const set = new Set(list.filter((s) => SCOPES.includes(s)));
  if (set.has('manage')) set.add('write');
  if (set.has('write')) set.add('read');
  return SCOPES.filter((s) => set.has(s));
}
const parseScope = (v) => (typeof v === 'string' ? v.split(/\s+/).filter(Boolean) : []);

/* ---------------- access tokens ---------------- */

async function issueAccessToken(grant) {
  const data = Buffer.from(JSON.stringify({ g: grant.id, u: grant.uid, exp: Date.now() + ACCESS_TTL * 1000 })).toString('base64url');
  return `tos_${data}.${await hmac('access', data)}`;
}
async function readAccessToken(token) {
  const m = /^tos_([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(token || '');
  if (!m || !safeEqual(m[2], await hmac('access', m[1]))) return null;
  try {
    const p = JSON.parse(Buffer.from(m[1], 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

// Resolves a Bearer token to { user, grant } or null.
export async function authenticate(req) {
  const m = /^Bearer\s+(\S+)$/i.exec(req.get('Authorization') || '');
  const p = m && await readAccessToken(m[1]);
  if (!p) return null;
  const grant = await store.oauthGrants.get(p.g);
  if (!grant || grant.uid !== p.u) return null;
  const user = await store.getUser(grant.uid);
  if (!user) return null;
  if (!grant.lastUsedAt || Date.now() - Date.parse(grant.lastUsedAt) > 10 * 60_000) {
    grant.lastUsedAt = store.now();
    store.oauthGrants.save(grant).catch(() => { /* usage time is best effort */ });
  }
  return { user, grant };
}

export function challenge(res, error) {
  res.set('WWW-Authenticate', `Bearer realm="TeamOS", resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"${error ? `, error="${error}"` : ''}`);
}

/* ---------------- clients ---------------- */

function validRedirect(uri) {
  if (typeof uri !== 'string' || uri.length > 2000) return false;
  let u; try { u = new URL(uri); } catch { return false; }
  if (u.hash) return false;
  if (u.protocol === 'https:') return true;
  if (u.protocol === 'http:') return LOOPBACK.includes(u.hostname);
  // Native apps may use a private-use scheme (RFC 8252 §7.1), e.g. cursor://…
  return /^[a-z][a-z0-9+.-]*:$/.test(u.protocol) && !['javascript:', 'data:', 'file:', 'vbscript:', 'blob:', 'about:'].includes(u.protocol);
}
// Loopback redirects may use any port (RFC 8252 §7.3).
function redirectMatches(registered, uri) {
  if (registered === uri) return true;
  try {
    const a = new URL(registered), b = new URL(uri);
    return a.protocol === 'http:' && LOOPBACK.includes(a.hostname) && a.hostname === b.hostname && a.pathname === b.pathname && a.search === b.search;
  } catch { return false; }
}

const registrations = new Map();
function registrationAllowed(ip, now = Date.now()) {
  for (const [k, w] of registrations) if (w.until <= now) registrations.delete(k);
  const w = registrations.get(ip) || { n: 0, until: now + 3600_000 };
  if (w.n >= 30) return false;
  w.n++; registrations.set(ip, w);
  return true;
}

async function authenticateClient(req, body) {
  let id = body.client_id, secret = body.client_secret;
  const basic = /^Basic\s+(\S+)$/i.exec(req.get('Authorization') || '');
  if (basic) {
    const [u, p] = Buffer.from(basic[1], 'base64').toString().split(':');
    try { id = decodeURIComponent(u); secret = decodeURIComponent(p ?? ''); } catch { return null; }
  }
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) return null;
  const client = await store.oauthClients.get(id);
  if (!client) return null;
  if (client.authMethod !== 'none' && !(typeof secret === 'string' && safeEqual(digest(secret), client.secretDigest))) return null;
  return client;
}

/* ---------------- housekeeping ---------------- */

let nextCleanup = 0;
async function cleanup() {
  const now = Date.now();
  if (nextCleanup > now) return;
  nextCleanup = now + 5 * 60_000;
  for (const col of [store.oauthCodes, store.oauthRequests]) {
    for (const r of await col.list()) if (r.expires <= now) await col.remove(r);
  }
}

/* ---------------- pages ---------------- */

// Pages before sign-in follow the browser language; after sign-in, the profile language.
const pageLang = (req) => (req.user || req.get('X-TeamOS-Lang') ? langOf(req) : /^uk\b/i.test(req.get('Accept-Language') || '') ? 'uk' : 'en');

function page(res, lang, title, body, status = 200) {
  res.status(status).set({
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
  }).type('html').send(`<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><link rel="stylesheet" href="/app.css"><link rel="stylesheet" href="/oauth.css"><script src="/oauth.js" defer></script></head>
<body><main class="ob oauth"><div class="login-brand"><span class="logo">T</span>TeamOS</div>${body}</main></body></html>`);
}
const errorPage = (req, res, text, status = 400) => {
  const lang = pageLang(req);
  page(res, lang, tr(lang, 'Connection failed'), `<h1>${esc(tr(lang, 'Connection failed'))}</h1><p class="hint">${esc(tr(lang, text))}</p>`, status);
};
const hostOf = (uri) => { try { const u = new URL(uri); return u.protocol.startsWith('http') ? u.host : u.protocol.slice(0, -1); } catch { return uri; } };

function redirectWith(res, uri, params) {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
  res.redirect(302, u.href);
}

/* ---------------- routes ---------------- */

export function mountOAuth(app) {
  const form = express.urlencoded({ extended: false, limit: '64kb' });
  const cors = (req, res, next) => {
    res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id' });
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };
  const oauthError = (res, status, error, description) => res.status(status).set('Cache-Control', 'no-store').json({ error, ...(description ? { error_description: description } : {}) });

  /* ---- discovery ---- */
  const resourceMeta = (_req, res) => res.json({
    resource: RESOURCE, authorization_servers: [origin], scopes_supported: SCOPES,
    bearer_methods_supported: ['header'], resource_name: 'TeamOS', resource_documentation: `${origin}/oauth/connections`,
  });
  app.use('/.well-known', cors);
  app.get(['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'], resourceMeta);
  const asMeta = (_req, res) => res.json({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    revocation_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    scopes_supported: SCOPES,
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${origin}/oauth/connections`,
  });
  app.get(['/.well-known/oauth-authorization-server', '/.well-known/oauth-authorization-server/mcp', '/.well-known/openid-configuration'], asMeta);

  /* ---- dynamic client registration ---- */
  app.options('/oauth/register', cors);
  app.post('/oauth/register', cors, async (req, res) => {
    try {
      if (!registrationAllowed(req.ip)) return oauthError(res, 429, 'invalid_request', 'Too many registrations. Try again later.');
      const b = req.body || {};
      const uris = Array.isArray(b.redirect_uris) ? b.redirect_uris : [];
      if (!uris.length || uris.length > 10 || !uris.every(validRedirect)) return oauthError(res, 400, 'invalid_redirect_uri', 'redirect_uris must be HTTPS, loopback HTTP or a private-use scheme.');
      const authMethod = ['client_secret_post', 'client_secret_basic'].includes(b.token_endpoint_auth_method) ? b.token_endpoint_auth_method : 'none';
      const grantTypes = (Array.isArray(b.grant_types) ? b.grant_types : ['authorization_code', 'refresh_token']).filter((g) => ['authorization_code', 'refresh_token'].includes(g));
      if (!grantTypes.includes('authorization_code')) return oauthError(res, 400, 'invalid_client_metadata', 'authorization_code grant is required.');
      const secret = authMethod === 'none' ? null : random(32);
      const client = {
        id: `c_${random(18)}`, name: String(b.client_name || hostOf(uris[0])).slice(0, 100), clientUri: typeof b.client_uri === 'string' && /^https:\/\//.test(b.client_uri) ? b.client_uri.slice(0, 300) : null,
        redirectUris: uris, authMethod, grantTypes, secretDigest: secret ? digest(secret) : null, createdAt: store.now(),
      };
      await store.oauthClients.save(client);
      res.status(201).set('Cache-Control', 'no-store').json({
        client_id: client.id, ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
        client_id_issued_at: Math.floor(Date.now() / 1000), client_name: client.name, redirect_uris: uris,
        token_endpoint_auth_method: authMethod, grant_types: grantTypes, response_types: ['code'], scope: SCOPES.join(' '),
      });
    } catch (e) { console.error('[oauth] register', e); oauthError(res, 500, 'server_error'); }
  });

  /* ---- authorization request ---- */
  app.get('/oauth/authorize', async (req, res) => {
    try {
      cleanup().catch((e) => console.error('[oauth] cleanup', e.name));
      const q = req.query;
      const client = typeof q.client_id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(q.client_id) ? await store.oauthClients.get(q.client_id) : null;
      if (!client) return errorPage(req, res, 'This app is not registered with TeamOS. Add the connector again.');
      const redirectUri = typeof q.redirect_uri === 'string' ? q.redirect_uri : client.redirectUris.length === 1 ? client.redirectUris[0] : null;
      if (!redirectUri || !client.redirectUris.some((r) => redirectMatches(r, redirectUri))) return errorPage(req, res, 'The app’s return address doesn’t match its registration.');
      const back = (error, description) => redirectWith(res, redirectUri, { error, error_description: description, state: q.state, iss: origin });
      if (q.response_type !== 'code') return back('unsupported_response_type');
      if (typeof q.code_challenge !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(q.code_challenge) || q.code_challenge_method !== 'S256') return back('invalid_request', 'PKCE with S256 is required.');
      if (q.resource !== undefined && ![RESOURCE, origin, `${origin}/`].includes(q.resource)) return back('invalid_target', 'Unknown resource.');
      const requested = parseScope(q.scope);
      if (requested.some((s) => !SCOPES.includes(s))) return back('invalid_scope', `Supported scopes: ${SCOPES.join(' ')}`);
      const request = {
        id: random(24), clientId: client.id, redirectUri, state: typeof q.state === 'string' ? q.state.slice(0, 2000) : null,
        codeChallenge: q.code_challenge, scope: requested, resource: RESOURCE, expires: Date.now() + REQUEST_TTL, createdAt: store.now(),
      };
      await store.oauthRequests.save(request);
      res.redirect(302, `/oauth/consent?rid=${request.id}`);
    } catch (e) { console.error('[oauth] authorize', e); errorPage(req, res, 'Something went wrong. Try connecting again.', 500); }
  });

  async function pendingRequest(rid) {
    if (typeof rid !== 'string' || !/^[A-Za-z0-9_-]{20,80}$/.test(rid)) return null;
    const r = await store.oauthRequests.get(rid);
    return r && r.expires > Date.now() ? r : null;
  }

  /* ---- consent ---- */
  app.get('/oauth/consent', async (req, res) => {
    try {
      const lang = pageLang(req);
      const t = (k, v) => esc(tr(lang, k, v));
      const r = await pendingRequest(req.query.rid);
      if (!r) return errorPage(req, res, 'This connection request has expired. Start connecting again from the app.');
      const client = await store.oauthClients.get(r.clientId);
      if (!client) return errorPage(req, res, 'This app is not registered with TeamOS. Add the connector again.');
      const appLine = `<p class="hint">${t('{app} wants to connect to your TeamOS.', { app: client.name })} <span class="oauth-host">${t('It will return to {host}.', { host: hostOf(r.redirectUri) })}</span></p>`;

      if (!req.user) {
        const returnTo = `/oauth/consent?rid=${r.id}`;
        return page(res, lang, tr(lang, 'Sign in to connect'), `<h1>${t('Sign in to connect {app}', { app: client.name })}</h1>${appLine}
<form id="oauth-signin" class="oauth-card" data-return="${esc(returnTo)}" data-email="${magicLinkConfigured() ? '1' : ''}" data-dev="${devLoginAllowed(req) ? '1' : ''}">
<label class="oauth-field"><span>${t('Email')}</span><input name="email" type="email" autocomplete="email" required></label>
${devLoginAllowed(req) ? `<label class="oauth-field"><span>${t('Name (dev login)')}</span><input name="name" autocomplete="name"></label>` : ''}
<div class="login-actions">${magicLinkConfigured() ? `<button class="btn pri" data-mode="email">${t('Email me a sign-in link')}</button>` : ''}${devLoginAllowed(req) ? `<button class="btn ${magicLinkConfigured() ? '' : 'pri'}" data-mode="dev">${t('Dev sign-in')}</button>` : ''}</div>
<p class="hint" id="oauth-status" role="status">${magicLinkConfigured() || devLoginAllowed(req) ? '' : t('Email sign-in is temporarily unavailable.')}</p></form>`);
      }

      const teams = (await store.teamsOfUser(req.user.id)).sort((a, b) => (a.kind === 'personal' ? -1 : b.kind === 'personal' ? 1 : a.name.localeCompare(b.name)));
      const wanted = expandScope(r.scope.length ? r.scope : ['read', 'write']);
      const level = wanted.includes('manage') ? 'manage' : wanted.includes('write') ? 'write' : 'read';
      const csrf = await hmac('consent', `${r.id}.${req.user.id}`);
      const levels = [
        ['read', 'Read only', 'Search and read tasks, knowledge, projects, goals, hypotheses and your inbox.'],
        ['write', 'Read and write', 'Also create and change tasks, knowledge, projects, goals and hypotheses, and add items to your inbox.'],
        ['manage', 'Full, including team management', 'Also create teams, invite and remove members and change their roles (only where you are Owner or Admin).'],
      ];
      const teamName = (tm) => (tm.kind === 'personal' ? tr(lang, 'Personal') : tm.name);
      return page(res, lang, tr(lang, 'Connect {app}', { app: client.name }), `<h1>${t('Connect {app} to TeamOS', { app: client.name })}</h1>${appLine}
<p class="hint">${t('Signed in as {email}.', { email: req.user.email })} ${t('The app sees and does only what you can in TeamOS.')}</p>
<form method="post" action="/oauth/consent" class="oauth-card">
<input type="hidden" name="rid" value="${esc(r.id)}"><input type="hidden" name="csrf" value="${esc(csrf)}">
<fieldset><legend>${t('Access')}</legend>${levels.map(([v, label, hint]) => `<label class="oauth-choice"><input type="radio" name="level" value="${v}"${v === level ? ' checked' : ''}><span><b>${t(label)}</b><small>${t(hint)}</small></span></label>`).join('')}</fieldset>
<fieldset><legend>${t('Workspaces')}</legend><select name="team"><option value="*">${t('All my workspaces, including ones I join later')}</option>${teams.map((tm) => `<option value="${esc(tm.id)}">${t('Only: {name}', { name: teamName(tm) })}</option>`).join('')}</select></fieldset>
<div class="login-actions"><button class="btn pri" name="decision" value="allow">${t('Allow access')}</button><button class="btn ghost" name="decision" value="deny">${t('Cancel')}</button></div>
<p class="hint">${t('You can disconnect the app at any time.')} <a href="/oauth/connections">${t('Connected apps')}</a></p></form>`);
    } catch (e) { console.error('[oauth] consent', e); errorPage(req, res, 'Something went wrong. Try connecting again.', 500); }
  });

  app.post('/oauth/consent', form, async (req, res) => {
    try {
      if (req.get('Origin') && req.get('Origin') !== origin) return errorPage(req, res, 'Open TeamOS and try again.', 403);
      const r = await pendingRequest(req.body.rid);
      if (!r) return errorPage(req, res, 'This connection request has expired. Start connecting again from the app.');
      if (!req.user) return res.redirect(303, `/oauth/consent?rid=${r.id}`);
      if (!safeEqual(String(req.body.csrf || ''), await hmac('consent', `${r.id}.${req.user.id}`))) return errorPage(req, res, 'Open TeamOS and try again.', 403);
      if (!await store.oauthRequests.remove(r)) return errorPage(req, res, 'This connection request has expired. Start connecting again from the app.');
      const back = (params) => redirectWith(res, r.redirectUri, { ...params, state: r.state, iss: origin });
      if (req.body.decision !== 'allow') return back({ error: 'access_denied', error_description: 'The user declined access.' });
      const scope = expandScope([SCOPES.includes(req.body.level) ? req.body.level : 'read']);
      let teams = null;
      if (req.body.team && req.body.team !== '*') {
        const team = await store.getTeam(store.assertId(String(req.body.team), 'team id'));
        if (!team || !team.members.some((m) => m.userId === req.user.id)) return errorPage(req, res, 'You are not a member of this team', 403);
        teams = [team.id];
      }
      const code = random(32);
      await store.oauthCodes.save({ id: digest(code), clientId: r.clientId, redirectUri: r.redirectUri, codeChallenge: r.codeChallenge, uid: req.user.id, scope, teams, resource: r.resource, expires: Date.now() + CODE_TTL, createdAt: store.now() });
      back({ code });
    } catch (e) { console.error('[oauth] consent', e); errorPage(req, res, 'Something went wrong. Try connecting again.', 500); }
  });

  /* ---- token endpoint ---- */
  app.options('/oauth/token', cors);
  app.post('/oauth/token', cors, form, async (req, res) => {
    res.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' });
    try {
      const b = req.body || {};
      const client = await authenticateClient(req, b);
      if (!client) return oauthError(res, 401, 'invalid_client');
      const tokens = async (grant) => ({
        access_token: await issueAccessToken(grant), token_type: 'Bearer', expires_in: ACCESS_TTL,
        refresh_token: grant.$refresh, scope: grant.scope.join(' '),
      });

      if (b.grant_type === 'authorization_code') {
        if (typeof b.code !== 'string' || typeof b.code_verifier !== 'string') return oauthError(res, 400, 'invalid_request');
        const record = await store.oauthCodes.get(digest(b.code));
        if (!record || !await store.oauthCodes.remove(record)) return oauthError(res, 400, 'invalid_grant', 'The code is invalid or has been used.');
        if (record.expires <= Date.now() || record.clientId !== client.id) return oauthError(res, 400, 'invalid_grant');
        if (b.redirect_uri !== undefined && b.redirect_uri !== record.redirectUri) return oauthError(res, 400, 'invalid_grant', 'redirect_uri mismatch.');
        if (!safeEqual(crypto.createHash('sha256').update(b.code_verifier).digest('base64url'), record.codeChallenge)) return oauthError(res, 400, 'invalid_grant', 'PKCE verification failed.');
        if (b.resource !== undefined && ![RESOURCE, origin, `${origin}/`].includes(b.resource)) return oauthError(res, 400, 'invalid_target');
        const refresh = random(32);
        const grant = {
          id: `g_${random(18)}`, clientId: client.id, clientName: client.name, uid: record.uid, scope: record.scope, teams: record.teams,
          refreshDigest: digest(refresh), refreshExpires: Date.now() + REFRESH_TTL, createdAt: store.now(), lastUsedAt: store.now(),
        };
        await store.oauthGrants.save(grant);
        return res.json(await tokens({ ...grant, $refresh: `${grant.id}.${refresh}` }));
      }

      if (b.grant_type === 'refresh_token') {
        const m = /^(g_[A-Za-z0-9_-]{1,60})\.([A-Za-z0-9_-]{20,100})$/.exec(String(b.refresh_token || ''));
        const grant = m && await store.oauthGrants.get(m[1]);
        if (!grant || grant.clientId !== client.id) return oauthError(res, 400, 'invalid_grant');
        const presented = digest(m[2]);
        const current = safeEqual(presented, grant.refreshDigest);
        const retried = !current && grant.prevRefreshDigest && safeEqual(presented, grant.prevRefreshDigest) && Date.now() - grant.rotatedAt < REUSE_GRACE;
        if (!current && !retried) {
          // An old refresh token came back: treat the connection as compromised.
          if (grant.prevRefreshDigest && safeEqual(presented, grant.prevRefreshDigest)) await store.oauthGrants.remove(grant);
          return oauthError(res, 400, 'invalid_grant');
        }
        if (grant.refreshExpires <= Date.now()) { await store.oauthGrants.remove(grant); return oauthError(res, 400, 'invalid_grant', 'The connection has expired. Connect again.'); }
        if (b.scope) {
          const narrowed = expandScope(parseScope(b.scope)).filter((s) => grant.scope.includes(s));
          if (!narrowed.length) return oauthError(res, 400, 'invalid_scope');
          grant.scope = narrowed;
        }
        const refresh = random(32);
        Object.assign(grant, { prevRefreshDigest: current ? grant.refreshDigest : grant.prevRefreshDigest, refreshDigest: digest(refresh), rotatedAt: Date.now(), refreshExpires: Date.now() + REFRESH_TTL, lastUsedAt: store.now() });
        await store.oauthGrants.save(grant);
        return res.json(await tokens({ ...grant, $refresh: `${grant.id}.${refresh}` }));
      }

      return oauthError(res, 400, 'unsupported_grant_type');
    } catch (e) {
      if (e.status === 409) return oauthError(res, 400, 'invalid_grant', 'The token was used concurrently. Try again.');
      console.error('[oauth] token', e); oauthError(res, 500, 'server_error');
    }
  });

  /* ---- revocation ---- */
  app.options('/oauth/revoke', cors);
  app.post('/oauth/revoke', cors, form, async (req, res) => {
    try {
      const b = req.body || {};
      const client = await authenticateClient(req, b);
      if (!client) return oauthError(res, 401, 'invalid_client');
      const token = String(b.token || '');
      const access = await readAccessToken(token);
      const gid = access?.g || /^(g_[A-Za-z0-9_-]{1,60})\./.exec(token)?.[1];
      const grant = gid && await store.oauthGrants.get(gid);
      if (grant && grant.clientId === client.id && (access || safeEqual(digest(token.split('.')[1] || ''), grant.refreshDigest))) await store.oauthGrants.remove(grant);
      res.sendStatus(200);
    } catch (e) { console.error('[oauth] revoke', e); res.sendStatus(200); }
  });

  /* ---- connected apps ---- */
  app.get('/oauth/connections', async (req, res) => {
    const lang = pageLang(req);
    const t = (k, v) => esc(tr(lang, k, v));
    if (!req.user) return page(res, lang, tr(lang, 'Connected apps'), `<h1>${t('Connected apps')}</h1><p class="hint">${t('Sign in to TeamOS first.')}</p><div class="login-actions"><a class="btn pri" href="/#login">${t('Sign in to TeamOS')}</a></div>`);
    const grants = (await store.oauthGrants.list()).filter((g) => g.uid === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const teamNames = new Map((await store.teamsOfUser(req.user.id)).map((tm) => [tm.id, tm.kind === 'personal' ? tr(lang, 'Personal') : tm.name]));
    const csrf = await hmac('connections', req.user.id);
    const levelName = (g) => tr(lang, g.scope.includes('manage') ? 'Full, including team management' : g.scope.includes('write') ? 'Read and write' : 'Read only');
    const date = (iso) => (iso ? new Date(iso).toLocaleString(lang === 'uk' ? 'uk-UA' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
    const rows = grants.map((g) => `<li class="oauth-card oauth-grant"><div><b>${esc(g.clientName)}</b>
<small>${esc(levelName(g))} · ${g.teams ? esc(g.teams.map((id) => teamNames.get(id) || id).join(', ')) : t('All my workspaces')}</small>
<small>${t('Connected {date}', { date: date(g.createdAt) })} · ${t('Last used {date}', { date: date(g.lastUsedAt) })}</small></div>
<form method="post" action="/oauth/connections/revoke"><input type="hidden" name="csrf" value="${esc(csrf)}"><input type="hidden" name="gid" value="${esc(g.id)}"><button class="btn sm">${t('Disconnect')}</button></form></li>`).join('');
    page(res, lang, tr(lang, 'Connected apps'), `<h1>${t('Connected apps')}</h1>
<p class="hint">${t('Apps such as Claude or Codex that can reach your TeamOS through MCP.')}</p>
<div class="oauth-card"><p class="hint">${t('MCP server address')}</p><code class="oauth-url">${esc(RESOURCE)}</code></div>
${rows ? `<ul class="oauth-list">${rows}</ul>` : `<p class="hint">${t('No apps are connected yet.')}</p>`}
<div class="login-actions"><a class="btn ghost" href="/">${t('Back to TeamOS')}</a></div>`);
  });
  app.post('/oauth/connections/revoke', form, async (req, res) => {
    if (!req.user) return res.redirect(303, '/oauth/connections');
    if ((req.get('Origin') && req.get('Origin') !== origin) || !safeEqual(String(req.body.csrf || ''), await hmac('connections', req.user.id))) return errorPage(req, res, 'Open TeamOS and try again.', 403);
    const gid = String(req.body.gid || '');
    const grant = /^g_[A-Za-z0-9_-]{1,60}$/.test(gid) ? await store.oauthGrants.get(gid) : null;
    if (grant && grant.uid === req.user.id) await store.oauthGrants.remove(grant);
    res.redirect(303, '/oauth/connections');
  });
}
