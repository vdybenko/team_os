import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './store.js';

const ttl = 15 * 60_000;
const apiKey = process.env.SENDGRID_API_KEY?.trim();
const fromEmail = process.env.SENDGRID_FROM_EMAIL?.trim();
const directory = path.join(DATA_DIR, '.signin-links');
const limits = new Map();
let nextCleanup = 0;

export function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  const [local, domain, ...rest] = email.split('@');
  if (email.length > 254 || !local || local.length > 64 || rest.length) return null;
  if (!/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/.test(local)) return null;
  if (!domain || !domain.includes('.') || !domain.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  return email;
}

export const configured = Boolean(apiKey && normalizeEmail(fromEmail));
const tokenFile = (token) => path.join(directory, crypto.createHash('sha256').update(token).digest('hex') + '.json');

export function reserveSend(ip, email, now = Date.now()) {
  for (const [key, window] of limits) if (window.until <= now) limits.delete(key);
  const buckets = [
    ['global', 120, 10 * 60_000],
    [`ip:${ip}`, 10, 10 * 60_000],
    [`email:${email}`, 1, 60_000],
  ];
  for (const [key, max] of buckets) {
    const window = limits.get(key);
    if (window?.count >= max) return Math.ceil((window.until - now) / 1000);
  }
  for (const [key, , duration] of buckets) {
    const window = limits.get(key) || { count: 0, until: now + duration };
    window.count++;
    limits.set(key, window);
  }
  return 0;
}

function remove(file) {
  try { fs.unlinkSync(file); return true; }
  catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function sendLink(email, origin, returnTo) {
  const now = Date.now();
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (nextCleanup <= now) {
    for (const file of fs.readdirSync(directory)) {
      if (!/^[a-f0-9]{64}\.json$/.test(file)) continue;
      const absolute = path.join(directory, file);
      const stat = fs.statSync(absolute, { throwIfNoEntry: false });
      if (stat && stat.mtimeMs + ttl <= now) remove(absolute);
    }
    nextCleanup = now + 60_000;
  }
  const token = crypto.randomBytes(32).toString('base64url');
  const file = tokenFile(token);
  fs.writeFileSync(file, JSON.stringify({ email, returnTo, expires: now + ttl }), { flag: 'wx', mode: 0o600 });
  const url = new URL('/auth/link', origin);
  url.hash = token;
  try {
    const result = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: fromEmail, name: 'TeamOS' },
        subject: 'Your TeamOS sign-in link',
        content: [{ type: 'text/plain', value: `Open this link to sign in to TeamOS.\n\n${url.href}\n\nYou can use this link once within 15 minutes. If you didn’t request it, you can ignore this email.` }],
        tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false }, subscription_tracking: { enable: false } },
      }),
    });
    await result.body?.cancel();
    if (result.status !== 202) throw new Error(`SendGrid HTTP ${result.status}`);
  } catch (error) {
    remove(file);
    throw error;
  }
}

export function redeemLink(token, currentEmail) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const file = tokenFile(token);
  let record;
  try { record = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  if (record.expires <= Date.now()) { remove(file); return null; }
  // Preserve the existing session if a link for another account is opened.
  if (currentEmail && currentEmail !== record.email) return { differentAccount: true };
  return remove(file) ? record : null;
}
