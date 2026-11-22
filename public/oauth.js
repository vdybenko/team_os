'use strict';

// Sign-in form on the MCP connector consent page (/oauth/consent). After sign-in the page reloads
// and shows the consent form; the email link returns to the same consent request.
const form = document.getElementById('oauth-signin');
if (form) {
  const lang = document.documentElement.lang || 'en';
  const status = document.getElementById('oauth-status');
  const dict = { uk: {
    'Sending…': 'Надсилаю…', 'Check your email and open the sign-in link in this browser.': 'Перевір пошту й відкрий посилання для входу в цьому браузері.',
    'Couldn’t connect to TeamOS. Please try again.': 'Не вдалося з’єднатися з TeamOS. Спробуй ще раз.',
  } }[lang] || {};
  const t = (s) => dict[s] || s;
  form.addEventListener('submit', (e) => e.preventDefault());
  for (const button of form.querySelectorAll('button[data-mode]')) {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = form.elements.email.value.trim();
      if (!form.reportValidity()) return;
      const dev = button.dataset.mode === 'dev';
      for (const b of form.querySelectorAll('button')) b.disabled = true;
      status.textContent = t('Sending…');
      try {
        const res = await fetch(dev ? '/auth/dev' : '/auth/link/request', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-TeamOS-Lang': lang },
          body: JSON.stringify(dev ? { email, name: form.elements.name?.value || '' } : { email, returnTo: form.dataset.return }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || t('Couldn’t connect to TeamOS. Please try again.'));
        if (dev) return location.reload();
        status.textContent = t('Check your email and open the sign-in link in this browser.');
      } catch (error) {
        status.textContent = error.message || t('Couldn’t connect to TeamOS. Please try again.');
        for (const b of form.querySelectorAll('button')) b.disabled = false;
      }
    });
  }
}
