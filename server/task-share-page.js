import { tr } from './i18n.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

function taskCard(task, lang) {
  const t = (key) => tr(lang, key);
  const deadlineFormat = new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeZone: 'UTC' });
  const activityFormat = new Intl.DateTimeFormat(lang, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
  });
  const time = (value, format) => {
    const date = Date.parse(value);
    return Number.isNaN(date) ? escapeHtml(value) : `<time datetime="${escapeHtml(value)}">${format.format(date)}</time>`;
  };
  const metadata = (label, value) => `<dt>${t(label)}</dt><dd>${value || '—'}</dd>`;
  const person = (name) => name !== '—'
    ? `<span class="task-share-person"><span class="av ext" aria-hidden="true">${escapeHtml(Array.from(name)[0]?.toUpperCase())}</span>${escapeHtml(name)}</span>`
    : name;
  const priority = [task.important ? `<span class="chip">${t('Important')}</span>` : '', task.urgent ? `<span class="chip red">${t('Urgent')}</span>` : ''].filter(Boolean).join(' ');
  const source = task.source;
  return `<article class="card task-share-card">
    <div class="dwh"><span class="chip">${t('Read only')}</span></div>
    <h1>${escapeHtml(task.title)}</h1>
    <dl class="kv task-share-fields">
      ${metadata('Owner', person(task.owner))}
      ${metadata('Requester', person(task.requester))}
      ${metadata('Deadline', task.due ? time(task.due, deadlineFormat) : t('No deadline'))}
      ${metadata('Priority', priority || t('Normal'))}
      ${metadata('Project', escapeHtml(task.project))}
      ${metadata('Hypothesis', escapeHtml(task.hypothesis))}
    </dl>
    <section class="box"><h2>${t('Description')}</h2><div class="task-share-text">${escapeHtml(task.description) || '—'}</div></section>
    ${source ? `<section class="box"><h2>${t('Source')}</h2>
      ${source.quote ? `<blockquote class="quote task-share-text">${escapeHtml(source.quote)}</blockquote>` : ''}
      <div class="hint">${[source.title, source.timestamp].filter(Boolean).map(escapeHtml).join(' · ')}</div>
    </section>` : ''}
    <section class="box task-share-comments"><h2>${t('Comments')} · ${task.comments.length}</h2>
      ${task.comments.length ? `<ul>${task.comments.map((comment) => `<li><b>${escapeHtml(comment.author)}</b> <span class="hint">${time(comment.at, activityFormat)}</span><div class="task-share-text">${escapeHtml(comment.text)}</div></li>`).join('')}</ul>` : ''}
    </section>
    <section class="box task-share-history"><h2>${t('History')}</h2>
      ${task.history.length ? `<ul class="hist">${task.history.slice().reverse().map((entry) => `<li><b>${time(entry.at, activityFormat)}</b> · ${escapeHtml(entry.author)}: ${escapeHtml(entry.text)}${entry.source ? ` (${escapeHtml(entry.source)})` : ''}</li>`).join('')}</ul>` : `<div class="hint">${t('No history entries')}</div>`}
    </section>
  </article>`;
}

export function taskSharePage(lang, task, unavailable) {
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${tr(lang, 'Shared task')} · TeamOS</title><link rel="stylesheet" href="/app.css"></head>
<body><main class="ob task-share-page"><header class="login-brand"><span class="logo" aria-hidden="true">T</span>TeamOS</header>
${task ? taskCard(task, lang) : `<article class="card task-share-card"><h1>${escapeHtml(unavailable)}</h1></article>`}
</main></body></html>`;
}
