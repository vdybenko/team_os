import crypto from 'node:crypto';
import { cleanupSigninLinks, consumeSigninLink, createSigninLink, getSigninLink } from './store.js';

const ttl = 15 * 60_000;
const apiKey = process.env.SENDGRID_API_KEY?.trim();
const fromEmail = process.env.SENDGRID_FROM_EMAIL?.trim();
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
const tokenDigest = (token) => crypto.createHash('sha256').update(token).digest('hex');

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

export async function sendLink(email, origin, returnTo) {
  const now = Date.now();
  if (nextCleanup <= now) {
    nextCleanup = now + 60_000;
    await cleanupSigninLinks(now);
  }
  const token = crypto.randomBytes(32).toString('base64url');
  const digest = tokenDigest(token);
  const record = { email, returnTo, expires: now + ttl };
  await createSigninLink(digest, record);
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
    await consumeSigninLink(digest, record);
    throw error;
  }
}

export async function redeemLink(token, currentEmail) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const digest = tokenDigest(token);
  const record = await getSigninLink(digest);
  if (!record) return null;
  if (record.expires <= Date.now()) { await consumeSigninLink(digest, record); return null; }
  // Preserve the existing session if a link for another account is opened.
  if (currentEmail && currentEmail !== record.email) return { differentAccount: true };
  return await consumeSigninLink(digest, record) ? record : null;
}
