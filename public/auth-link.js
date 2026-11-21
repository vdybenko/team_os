'use strict';

// The interface language chosen in TeamOS (same origin, so the saved choice is readable here).
const lang = (() => { try { return localStorage.getItem('teamos.lang'); } catch { return null; } })() || (/^uk\b/i.test(navigator.language || '') ? 'uk' : 'en');
const dict = (lang === 'uk' && window.TEAMOS_I18N?.uk) || {};
const t = (s) => dict[s] || s;
document.documentElement.lang = lang;
document.title = t('Sign in to TeamOS');
for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.textContent.trim());

const token = location.hash.slice(1);
history.replaceState(null, '', location.pathname);
const button = document.getElementById('link-confirm');
const status = document.getElementById('link-status');

if (/^[A-Za-z0-9_-]{43}$/.test(token)) {
  button.disabled = false;
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = t('Checking your link…');
    try {
      const response = await fetch('/auth/link/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-TeamOS-Lang': lang },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok) {
        status.textContent = data.error || t('We couldn’t sign you in. Request a new link.');
        button.disabled = response.status < 500;
        return;
      }
      location.replace(data.returnTo);
    } catch {
      status.textContent = t('Couldn’t connect to TeamOS. Please try again.');
      button.disabled = false;
    }
  });
} else {
  status.textContent = t('This link is invalid. Request a new link.');
  button.hidden = true;
}
