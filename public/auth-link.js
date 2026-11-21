'use strict';

const token = location.hash.slice(1);
history.replaceState(null, '', location.pathname);
const button = document.getElementById('link-confirm');
const status = document.getElementById('link-status');

if (/^[A-Za-z0-9_-]{43}$/.test(token)) {
  button.disabled = false;
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'Checking your link…';
    try {
      const response = await fetch('/auth/link/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok) {
        status.textContent = data.error || 'We couldn’t sign you in. Request a new link.';
        button.disabled = response.status < 500;
        return;
      }
      location.replace(data.returnTo);
    } catch {
      status.textContent = 'Couldn’t connect to TeamOS. Please try again.';
      button.disabled = false;
    }
  });
} else {
  status.textContent = 'This link is invalid. Request a new link.';
  button.hidden = true;
}
