import crypto from 'node:crypto';
import * as store from './store.js';
import { configured, normalizeEmail, reserveSend, sendLink, redeemLink } from './magic-link.js';

const origin = new URL(process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).origin;
const SESSION_DAYS = 30;
const SECURE = origin.startsWith('https://');
const production = process.env.NODE_ENV === 'production';

export const magicLinkConfigured = () => configured && (!production || SECURE);
export function devLoginAllowed(req) {
  if (process.env.DEV_LOGIN === '0' || production) return false;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(req.hostname)) return false;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip)) return false;
  return process.env.DEV_LOGIN === '1' || !magicLinkConfigured();
}

/* ---------- cookies ---------- */

function parseCookies(req) {
  const out = Object.create(null);
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('='); if (i < 0) continue;
    try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
    catch { /* Skip malformed cookies. */ }
  }
  return out;
}
function setCookie(res, name, value, { maxAge, httpOnly = true } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];
  if (httpOnly) parts.push('HttpOnly');
  if (SECURE) parts.push('Secure');
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(Array.isArray(prev) ? prev : prev ? [prev] : []), parts.join('; ')]);
}
const sign = (data) => crypto.createHmac('sha256', store.sessionSecret()).update(data).digest('base64url');
function makeToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data)}`;
}
function readToken(token) {
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token || '')) return null;
  const [data, sig] = token.split('.');
  const expected = sign(data);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(data, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

/* ---------- session middleware ---------- */

export function sessionMiddleware(req, _res, next) {
  const p = readToken(parseCookies(req).sid);
  req.user = p ? store.getUser(p.uid) : null;
  next();
}
export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' });
  next();
}
function startSession(res, uid) {
  setCookie(res, 'sid', makeToken({ uid, exp: Date.now() + SESSION_DAYS * 864e5 }), { maxAge: SESSION_DAYS * 86400 });
}
const safeReturn = (r) => (typeof r === 'string' && /^\/#join-[A-Za-z0-9_-]{1,80}$/.test(r) ? r : '/');

/* ---------- user upsert ---------- */

function upsertUser({ id, email, name, provider }) {
  let u = store.getUser(id) || store.listUsers().find((user) => normalizeEmail(user.email) === email);
  if (!u) {
    u = { id, email, emails: [email], name: name || email.split('@')[0], picture: null, aliases: [], provider, createdAt: store.now() };
  } else {
    u.name ||= name || email.split('@')[0];
    u.emails ||= [u.email];
    if (!u.emails.includes(email)) u.emails.push(email);
  }
  store.saveUser(u);
  ensurePersonalTeam(u);
  return u;
}
export function ensurePersonalTeam(u) {
  const tid = `personal-${u.id}`.slice(0, 80);
  if (!store.getTeam(tid)) {
    store.saveTeam({ id: tid, kind: 'personal', name: 'Особистий', members: [{ userId: u.id, role: 'owner', joinedAt: store.now() }], invites: [], settings: { urgentDays: 2 }, createdAt: store.now() });
  }
}

/* ---------- routes ---------- */

export function mountAuthRoutes(app) {
  app.use('/auth', (_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    next();
  });
  app.get('/auth/config', (req, res) => res.json({ emailLink: magicLinkConfigured(), dev: devLoginAllowed(req) }));

  function emailLinkPost(req, res, next) {
    if (!magicLinkConfigured()) return res.status(503).json({ error: 'Email sign-in is temporarily unavailable.' });
    if (!req.is('application/json') || (req.get('Origin') && req.get('Origin') !== origin)) {
      return res.status(403).json({ error: 'Open TeamOS and try again.' });
    }
    next();
  }

  app.post('/auth/link/request', emailLinkPost, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: 'Enter a valid email address.' });
    const wait = reserveSend(req.ip, email);
    if (wait) return res.set('Retry-After', String(wait)).status(429).json({ error: 'Too many requests. Please try again later.' });
    try {
      await sendLink(email, origin, safeReturn(req.body?.returnTo));
      res.status(202).json({ ok: true });
    } catch (error) {
      console.error('[auth] Could not send a sign-in link:', /^SendGrid HTTP \d+$/.test(error.message) ? error.message : (error.code || error.name));
      res.status(503).json({ error: 'We couldn’t send the email. Please try again later.' });
    }
  });

  // Scanners can open the GET page without using the one-time token.
  app.get('/auth/link', (_req, res) => {
    res.set({
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      'X-Content-Type-Options': 'nosniff',
    }).type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in to TeamOS</title><link rel="stylesheet" href="/app.css"><script src="/auth-link.js" defer></script></head>
<body><main class="ob"><div class="login-brand"><span class="logo">T</span>TeamOS</div>
<h1>Confirm your sign-in</h1><p id="link-status" class="hint" role="status">Continue to TeamOS in this browser.</p>
<div class="login-actions"><button id="link-confirm" class="btn pri" type="button" disabled>Sign in to TeamOS</button>
<a class="btn ghost" href="/#login">Request a new link</a></div></main></body></html>`);
  });

  app.post('/auth/link/redeem', emailLinkPost, (req, res) => {
    try {
      const link = redeemLink(req.body?.token, normalizeEmail(req.user?.email));
      if (!link) return res.status(400).json({ error: 'This link has expired or has already been used. Request a new link.' });
      if (link.differentAccount) return res.status(409).json({ error: 'A different TeamOS account is signed in to this browser. Sign out and open this link again.' });
      const id = `m${crypto.createHash('sha256').update(link.email).digest('hex').slice(0, 32)}`;
      const u = upsertUser({ id, email: link.email, provider: 'email' });
      startSession(res, u.id);
      res.json({ returnTo: safeReturn(link.returnTo) });
    } catch (error) {
      console.error('[auth] Could not complete email sign-in:', error.code || error.name);
      res.status(500).json({ error: 'We couldn’t complete sign-in. Request a new link.' });
    }
  });

  app.post('/auth/dev', (req, res) => {
    if (!devLoginAllowed(req)) return res.status(403).json({ error: 'Dev login is disabled' });
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: 'Enter a valid email address.' });
    const id = `d${crypto.createHash('sha256').update(email).digest('hex').slice(0, 16)}`;
    const u = upsertUser({ id, email, name: String(req.body?.name || '').trim() || undefined, provider: 'dev' });
    startSession(res, u.id);
    res.json({ ok: true });
  });

  app.post('/auth/logout', (_req, res) => { setCookie(res, 'sid', '', { maxAge: 0 }); res.json({ ok: true }); });
}
