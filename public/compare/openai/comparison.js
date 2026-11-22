(() => {
  const requested = new URLSearchParams(location.search).get('lang');
  const supported = (lang) => lang === 'en' || lang === 'uk';
  let saved;
  try { saved = localStorage.getItem('teamos.lang'); } catch { /* storage may be unavailable */ }
  const lang = supported(requested) ? requested : supported(saved) ? saved : /^uk\b/i.test(navigator.language) ? 'uk' : 'en';
  if (supported(requested)) {
    try { localStorage.setItem('teamos.lang', lang); } catch { /* the URL keeps the selection */ }
  }
  document.documentElement.lang = lang;
  if (lang === 'en') {
    for (const el of document.querySelectorAll('[data-en]')) el.textContent = el.dataset.en;
    document.querySelector('meta[name="description"]').content = 'Compare TeamOS with ChatGPT and Codex. Keep meeting decisions in one workspace and use them from Claude, Codex or your own MCP client.';
  }
  for (const link of document.querySelectorAll('.language a')) {
    if (link.lang === lang) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
    link.hash = location.hash;
  }

  fetch('/.well-known/oauth-authorization-server', { credentials: 'omit' })
    .then((response) => { if (response.status === 404) document.getElementById('mcp-availability').hidden = false; })
    .catch(() => {});

  const views = document.querySelector('.views');
  const buttons = views.querySelectorAll('button');
  views.hidden = false;
  views.addEventListener('click', (event) => {
    const selected = event.target.closest('button');
    if (!selected) return;
    for (const button of buttons) {
      const active = button === selected;
      button.setAttribute('aria-pressed', String(active));
      document.getElementById(button.dataset.view).hidden = !active;
    }
  });
})();
