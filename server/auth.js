// Google OAuth 2.0 (authorization code flow) + signed session cookie.
import crypto from 'node:crypto';
import * as store from './store.js';

const BASE_URL = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = `${BASE_URL}/auth/google/callback`;
const SESSION_DAYS = 30;
const SECURE = BASE_URL.startsWith('https://');

export const googleConfigured = () => Boolean(CLIENT_ID && CLIENT_SECRET);
const isLocal = (req) => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(req.hostname);
export function devLoginAllowed(req) {
  if (process.env.DEV_LOGIN === '0') return false;
  if (process.env.NODE_ENV === 'production') return false;
  if (!isLocal(req)) return false;
  return process.env.DEV_LOGIN === '1' || !googleConfigured();
}

/* ---------- cookies ---------- */

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('='); if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
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
  if (!token || !token.includes('.')) return null;
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
const safeReturn = (r) => (typeof r === 'string' && /^\/(?!\/)[\w\-/#?=&.]*$/.test(r) ? r : '/');

/* ---------- user upsert ---------- */

function upsertUser({ id, email, name, picture, provider }) {
  let u = store.getUser(id) || store.findUserByEmail(email);
  if (!u) {
    u = { id, email, emails: [email], name: name || email.split('@')[0], picture: picture || null, aliases: [], provider, createdAt: store.now() };
  } else {
    u.name = u.name || name; u.picture = picture || u.picture;
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
  app.get('/auth/config', (req, res) => res.json({ google: googleConfigured(), dev: devLoginAllowed(req) }));

  app.get('/auth/google', (req, res) => {
    if (!googleConfigured()) return res.status(503).send('Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
    const state = crypto.randomBytes(16).toString('base64url');
    setCookie(res, 'oauth_state', makeToken({ state, ret: safeReturn(req.query.return), exp: Date.now() + 10 * 60e3 }), { maxAge: 600 });
    const q = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
  });

  app.get('/auth/google/callback', async (req, res) => {
    try {
      const st = readToken(parseCookies(req).oauth_state);
      setCookie(res, 'oauth_state', '', { maxAge: 0 });
      if (!st || st.state !== req.query.state) return res.status(400).send('Invalid OAuth state. Try signing in again.');
      if (req.query.error) return res.redirect('/#login');
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code: String(req.query.code || ''), client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' }),
      });
      const tok = await r.json();
      if (!r.ok || !tok.id_token) throw new Error(`Token exchange failed: ${tok.error || r.status}`);
      // The ID token came straight from Google's token endpoint over TLS, so its claims can be read directly.
      const claims = JSON.parse(Buffer.from(tok.id_token.split('.')[1], 'base64url').toString());
      if (claims.aud !== CLIENT_ID || !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss)) throw new Error('Unexpected ID token');
      if (!claims.email || claims.email_verified === false) throw new Error('Google account email is not verified');
      const u = upsertUser({ id: `g${claims.sub}`, email: claims.email.toLowerCase(), name: claims.name, picture: claims.picture, provider: 'google' });
      startSession(res, u.id);
      res.redirect(st.ret || '/');
    } catch (e) {
      console.error('[auth]', e.message);
      res.status(500).send('Sign-in failed. Check the server log.');
    }
  });

  app.post('/auth/dev', (req, res) => {
    if (!devLoginAllowed(req)) return res.status(403).json({ error: 'Dev login is disabled' });
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Вкажи email' });
    const id = `d${crypto.createHash('sha256').update(email).digest('hex').slice(0, 16)}`;
    const u = upsertUser({ id, email, name: String(req.body?.name || '').trim() || undefined, provider: 'dev' });
    startSession(res, u.id);
    res.json({ ok: true });
  });

  app.post('/auth/logout', (_req, res) => { setCookie(res, 'sid', '', { maxAge: 0 }); res.json({ ok: true }); });
}
