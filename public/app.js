/* TeamOS v0.1 — client. Vanilla JS, re-renders from state on every change (same approach as the prototype). */
(() => {
'use strict';

/* ---------- i18n ---------- */
// English is the source language: $t('Tasks') returns the Ukrainian translation from public/i18n.js when LANG is 'uk'.
const I18N = window.TEAMOS_I18N || { uk: {}, plurals: {} };
const LANGS = ['en', 'uk'];
let LANG = (() => {
  try { const saved = localStorage.getItem('teamos.lang'); if (LANGS.includes(saved)) return saved; } catch { /* storage blocked */ }
  return /^uk\b/i.test(navigator.language || '') ? 'uk' : 'en';
})();
const fill = (s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s);
const $t = (s, v) => fill((LANG === 'en' ? s : I18N[LANG]?.[s]) ?? s, v);
const $p = (n, key) => {
  const forms = I18N.plurals[key]?.[LANG] || I18N.plurals[key]?.en || [key];
  const cat = new Intl.PluralRules(LANG).select(n);
  const i = LANG === 'uk' ? { one: 0, few: 1, many: 2 }[cat] ?? 1 : cat === 'one' ? 0 : 1;
  return `${n} ${forms[Math.min(i, forms.length - 1)]}`;
};
const translated = (o) => new Proxy(o, { get: (x, k) => (typeof x[k] === 'string' ? $t(x[k]) : x[k]) });
const langSwitch = (cls = 'seg sm') => `<span class="${cls}" role="group" aria-label="${$t('Language')}">${LANGS.map((l) => `<button type="button" class="${LANG === l ? 'on' : ''}" data-a="lang" data-v="${l}" aria-pressed="${LANG === l}" lang="${l}" title="${l === 'en' ? 'English' : 'Українська'}">${l === 'en' ? 'EN' : 'UK'}</button>`).join('')}</span>`;
const comparisonLink = () => `<a class="comparison-link" href="/compare/openai/?lang=${LANG}">${$t('Compare with OpenAI')}</a>`;

/* ---------- helpers ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = () => isoDay(new Date());
const D = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const diff = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const dtf = (o) => new Intl.DateTimeFormat(LANG === 'uk' ? 'uk-UA' : 'en-GB', o);
const fd = (s) => (s ? dtf({ weekday: 'short', day: 'numeric', month: 'short' }).format(D(s)) : '—');
const fds = (s) => (s ? dtf({ day: 'numeric', month: 'short' }).format(D(String(s).slice(0, 10))) : '—');
const fdt = (iso) => (iso ? dtf({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)) : '');
const fdl = (d) => { const s = dtf({ weekday: 'long', day: 'numeric', month: 'long' }).format(d); return s[0].toUpperCase() + s.slice(1); };
const I = { dash: 'M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z', inbox: 'M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z', tasks: 'M4 4h16v16H4zM8 12l3 3 5-6', kn: 'M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4zM5 16a4 4 0 0 1 4-4h10', vision: 'M12 3l9 9-9 9-9-9z', users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 20a5 5 0 0 0-4-5', gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12h3M2 12h3M12 2v3M12 19v3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2', search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5', plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18', menu: 'M4 6h16M4 12h16M4 18h16', lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4', file: 'M6 3h9l4 4v14H6zM14 3v5h5', chat: 'M4 5h16v11H9l-5 4z', warn: 'M12 3l10 18H2zM12 10v5M12 18v.5', mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3', note: 'M5 3h14v18H5zM9 8h6M9 12h6M9 16h3', arrow: 'M5 12h14M13 6l6 6-6 6', back: 'M19 12H5M11 6l-6 6 6 6', chev: 'M6 9l6 6 6-6', cmt: 'M4 5h16v11H9l-5 4z', route: 'M5 12h14M13 6l6 6-6 6', spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6', mail: 'M3 6h18v12H3zM3 6l9 7 9-7', drive: 'M8 3h8l6 11-4 7H6l-4-7z', out: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0', link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1' };
const ico = (n, s = 16) => `<svg class="i" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${I[n]}"/></svg>`;
const PALETTE = ['#1f4fd8', '#0b8a5f', '#b4441c', '#7a3fb0', '#a8326e', '#2f7f8f', '#8a6d00'];
const colorFor = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; };

const STL = translated({ open: 'Open', progress: 'In progress', waiting: 'Waiting', done: 'Done', cancelled: 'Cancelled' });
const HST = translated({ draft: 'Draft', testing: 'Testing', validated: 'Validated', invalidated: 'Invalidated' });
const PST = translated({ active: 'Active', paused: 'Paused', done: 'Completed', archived: 'Archived' });
const KT = translated({ decision: 'Decision', agreement: 'Agreement', fact: 'Fact', process: 'Process', context: 'Context' });
const TASK_SECTION_NAMES = translated({ mine: 'My tasks', delegated: 'Delegated' });
const ROLE = { owner: 'Owner', admin: 'Admin', member: 'Member' };
const ITYPE = translated({ transcript: 'Transcript', email: 'Email', chat: 'Chat', doc: 'Document', note: 'Note', routed: 'Proposal' });
const SRCKIND = translated({ pdf: 'PDF', transcript: 'Transcript', doc: 'Document', voice: 'Voice note' });
const srcIco = (k) => (k === 'pdf' ? 'file' : k === 'transcript' || k === 'voice' ? 'mic' : 'drive');
const keepsSource = (i) => i.type !== 'routed' && Boolean(i.file || i.audio || ['transcript', 'doc'].includes(i.type));
const mmss = (sec) => { const s = Math.max(0, Math.round(sec || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// The original recording of a dictated item or source; `base` is '/inbox/<id>' or '/sources/<id>'.
const audioPlayer = (base, a) => `<div class="voice-play">${ico('mic', 15)}<audio controls preload="metadata" src="${T(base)}/audio"></audio><span class="hint">${a.duration ? mmss(a.duration) + ' · ' : ''}${fsize(a.size)} · ${a.transcript === 'server' ? $t('transcribed on the server') : a.transcript === 'pending' ? $t('transcribing…') : $t('transcribed in the browser')}</span></div>`;
const srcOf = (id) => (id && S.d?.sources ? S.d.sources.find((s) => s.id === id) : null);
const fsize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const fileUrl = (base, download) => `${T(base)}/file${download ? '?download=1' : ''}`;
const typeIco = (t) => ({ transcript: 'mic', email: 'mail', doc: 'drive', chat: 'chat', note: 'note', routed: 'route' })[t] || 'file';
const teamName = (team) => (team?.kind === 'personal' ? $t('Personal') : team?.name || '');
const teamLogo = (team) => (team.kind === 'personal' ? $t('Me') : team.name.slice(0, 2).toUpperCase());

/* ---------- API ---------- */
async function api(method, url, body) {
  const headers = { 'X-TeamOS-Lang': LANG, ...(body ? { 'Content-Type': 'application/json' } : {}) };
  const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.startsWith('/auth')) { S.me = null; S.assistant.clear(); location.hash = 'login'; render(); throw new Error($t('Please sign in')); }
  if (!r.ok) throw new Error(data.error || (url.startsWith('/auth') ? $t('Request failed ({status}). Please try again.', { status: r.status }) : $t('Error {status}', { status: r.status })));
  return data;
}
const T = (p) => `/api/teams/${encodeURIComponent(S.tid)}${p}`;

/* ---------- state ---------- */
const S = {
  me: null, teams: [], tid: null, d: null, ai: false, cfg: { emailLink: false, dev: false }, loginEmail: '', loginSent: false, loginBusy: false, loginError: '',
  tmenu: false, tab: 'matrix', dir: 'all', person: '', proj: '', fst: 'open', grp: 'person', dash: 'all', itab: 'review',
  knt: 'all', kscope: 'all', kproj: '', klog: false, ptab: 'overview', vEdit: false,
  review: null, applied: null, drawer: null, modal: null, pendingJoin: null, busy: false,
  assistant: new Map(),
};
const role = () => S.d?.role;
const isAdmin = () => ['owner', 'admin'].includes(role());
const personal = () => S.d?.team.kind === 'personal';
const M = () => Object.fromEntries((S.d?.members || []).map((m) => [m.id, m]));
const isExt = (w) => typeof w === 'string' && w.startsWith('ext:');
const pn = (w) => (!w ? '—' : isExt(w) ? w.slice(4) : M()[w]?.name || $t('Former member'));
const pnx = (w) => (isExt(w) ? `${w.slice(4)} (${$t('ext.')})` : pn(w));
const av = (w, s = 24) => {
  if (!w) return '';
  if (isExt(w)) return `<span class="av ext" style="--s:${s}px" title="${esc(pnx(w))}">${esc((w.slice(4)[0] || '?').toUpperCase())}</span>`;
  const m = M()[w]; const name = m?.name || '?';
  if (m?.picture) return `<img class="avimg" src="${esc(m.picture)}" width="${s}" height="${s}" alt="" title="${esc(name)}" referrerpolicy="no-referrer">`;
  return `<span class="av" style="--c:${colorFor(w)};--s:${s}px" title="${esc(name)}">${esc(name[0].toUpperCase())}</span>`;
};
const prj = (id) => S.d?.projects.find((p) => p.id === id);
const hyp = (id) => S.d?.hypotheses.find((h) => h.id === id);
const hcode = (id) => { const h = hyp(id); if (!h) return ''; const same = S.d.hypotheses.filter((x) => x.project === h.project).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)); return 'H' + (same.indexOf(h) + 1); };
const tag = (id) => { const p = prj(id); return p ? `<span class="tag" style="--c:${p.color}">${esc(p.name)}</span>` : ''; };
const isOpen = (t) => !['done', 'cancelled'].includes(t.status);
const urgentDays = () => S.d?.team.settings?.urgentDays ?? 2;
const urgent = (t) => (t.urgent != null ? t.urgent : !!(t.due && diff(TODAY(), t.due) <= urgentDays()));
const tasks = () => S.d?.tasks || [];
const uid = () => S.me?.id;
const knSource = (s) => (!s || s === 'Added manually' || s === 'Додано вручну' ? $t('Added manually') : s);

/* ---------- components ---------- */
const dueChip = (t) => {
  if (!t.due) return `<span class="chip">${$t('No deadline')}</span>`;
  if (!isOpen(t)) return `<span class="chip">${fd(t.due)}</span>`;
  const n = diff(TODAY(), t.due); const c = n < 0 ? 'red' : n <= 1 ? 'amber' : '';
  const l = n < 0 ? `${$t('Overdue')} · ${fds(t.due)}` : n === 0 ? $t('Today') : n === 1 ? $t('Tomorrow') : fd(t.due);
  return `<span class="chip ${c}">${l}</span>`;
};
const cmt = (t) => (t.comments.length ? `<span class="cmt ${t.unread ? 'new' : ''}">${ico('cmt', 13)}${t.comments.length}</span>` : '');
const who = (t) => t.owner === uid() && t.requester === uid() ? `<span>${$t('to myself')}</span>`
  : t.owner === uid() ? `<span>${$t('me')} → ${esc(pnx(t.requester))}</span>`
  : `${av(t.owner, 18)}<span>${esc(pnx(t.owner))}${t.requester !== uid() ? ' ← ' + esc(pnx(t.requester)) : ''}</span>`;
const trow = (t) => `<button class="trow" data-a="open" data-id="${t.id}"><span class="st ${t.status}" title="${STL[t.status]}"></span><span class="tt"><b>${esc(t.title)}</b><span class="mt">${who(t)}${dueChip(t)}${tag(t.project)}${t.hypothesis ? `<span class="chip">${hcode(t.hypothesis)}</span>` : ''}${cmt(t)}${t.canEdit ? '' : ico('lock', 12)}</span></span></button>`;
const kcard = (t) => `<div class="kc" draggable="${t.canEdit}" data-drag="${t.id}" data-a="open" data-id="${t.id}"><b>${esc(t.title)}</b><div class="mt">${av(t.owner, 18)}${dueChip(t)}${tag(t.project)}${cmt(t)}${t.canEdit ? '' : ico('lock', 12)}</div></div>`;
const memberOpts = (val) => (S.d?.members || []).map((m) => `<option value="${m.id}" ${m.id === val ? 'selected' : ''}>${esc(m.name)}${m.id === uid() ? ` (${$t('me')})` : ''}</option>`).join('');
const selWho = (attrs, val, ext = true) => `<select ${attrs}>${memberOpts(val)}${ext && isExt(val) ? `<option value="${esc(val)}" selected>${esc(val.slice(4))} (${$t('ext.')})</option>` : ''}${ext ? `<option value="__ext">${$t('+ External contact…')}</option>` : ''}</select>`;
const selProj = (attrs, val) => `<select ${attrs}><option value="">${$t('No project')}</option>${(S.d?.projects || []).filter((p) => p.status !== 'archived' || p.id === val).map((p) => `<option value="${p.id}" ${p.id === val ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`;
const selHyp = (attrs, val, proj) => `<select ${attrs}><option value="">${$t('No hypothesis')}</option>${(S.d?.hypotheses || []).filter((h) => !proj || h.project === proj).map((h) => `<option value="${h.id}" ${h.id === val ? 'selected' : ''}>${hcode(h.id)} · ${esc((h.then || '').slice(0, 36))}…</option>`).join('')}</select>`;
const stmtHtml = (h) => `<em>${$t('If')}</em> ${esc(h.if)}, <em>${$t('then')}</em> ${esc(h.then)}${h.because ? `, <em>${$t('because')}</em> ${esc(h.because)}` : ''}.`;
const stmt = (h) => `<span class="stmt">${stmtHtml(h)}</span>`;
const hypChip = (h) => `<span class="chip ${h.status === 'testing' ? 'amber' : h.status === 'validated' ? 'green' : h.status === 'invalidated' ? 'red' : ''}">${HST[h.status]}</span>`;
const prjChip = (p) => `<span class="chip ${p.status === 'active' ? 'green' : p.status === 'paused' ? 'amber' : ''}">${PST[p.status]}</span>`;
function md(src) { // tiny Markdown renderer (headings, lists, bold, italics, paragraphs)
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<i>$2</i>')
    .replace(/(^|\W)_(.+?)_(?=\W|$)/g, '$1<i>$2</i>');
  const out = []; let depth = 0;
  const setDepth = (d) => { while (depth < d) { out.push('<ul>'); depth++; } while (depth > d) { out.push('</ul>'); depth--; } };
  for (const line of String(src || '').split('\n')) {
    const h = /^(#{1,3})\s+(.*)$/.exec(line), li = /^(\s*)[-*]\s+(.*)$/.exec(line);
    if (li) { setDepth(Math.min(3, Math.floor(li[1].length / 2) + 1)); out.push(`<li>${inline(li[2])}</li>`); continue; }
    if (line.trim()) setDepth(0);
    if (h) out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  setDepth(0);
  return out.join('');
}

/* ---------- routing ---------- */
const R = () => decodeURIComponent(location.hash.slice(1)) || 'dashboard';

/* ---------- loading ---------- */
async function boot() {
  try { S.cfg = await (await fetch('/auth/config')).json(); } catch { /* offline */ }
  const r = R(); if (r.startsWith('join-')) S.pendingJoin = r.slice(5);
  const res = await fetch('/api/me', { credentials: 'same-origin', headers: { 'X-TeamOS-Lang': LANG } });
  if (res.status === 401) { if (!R().startsWith('join-')) location.hash = 'login'; return render(); }
  const me = await res.json();
  Object.assign(S, { me: me.user, teams: me.teams, ai: me.ai, transcribe: me.transcribe });
  if (S.me.lang !== LANG) api('PATCH', '/api/me', { lang: LANG }).then((u) => { S.me = u; }).catch(() => {});
  if (S.pendingJoin) { location.hash = 'join-' + S.pendingJoin; return render(); }
  const last = (() => { try { return localStorage.getItem('teamos.team'); } catch { return null; } })();
  const real = S.teams.filter((t) => t.kind !== 'personal');
  S.tid = S.teams.find((t) => t.id === last)?.id || real[0]?.id || S.teams[0]?.id;
  if (!real.length && !last) { location.hash = 'onboarding'; return render(); }
  await reload();
  if (['login', 'onboarding'].includes(R())) location.hash = 'dashboard';
}
async function reloadMe() { const me = await api('GET', '/api/me'); Object.assign(S, { me: me.user, teams: me.teams, ai: me.ai, transcribe: me.transcribe }); }
async function reload() {
  if (!S.tid) return render();
  S.d = await api('GET', T('/state'));
  try { localStorage.setItem('teamos.team', S.tid); } catch { /* storage blocked */ }
  render();
  schedulePoll();
}
let pollT;
function schedulePoll() {
  clearTimeout(pollT);
  if (S.d?.inbox.some((i) => i.status === 'processing')) pollT = setTimeout(async () => { try { await reload(); if (S.review && R().startsWith('review-')) await openReview(S.review.item.id, true); } catch { /* retry next time */ } }, 3000);
}
async function act(fn, ok) {
  if (S.busy) return; S.busy = true;
  try { const r = await fn(); if (ok) toast(typeof ok === 'function' ? ok(r) : ok); return r; }
  catch (e) { toast(e.message); }
  finally { S.busy = false; }
}
async function setLang(lang) {
  if (!LANGS.includes(lang) || lang === LANG) return;
  LANG = lang;
  try { localStorage.setItem('teamos.lang', lang); } catch { /* storage blocked */ }
  render();
  if (!S.me) return;
  try {
    S.me = await api('PATCH', '/api/me', { lang });
    if (S.tid && S.d) S.d = await api('GET', T('/state')); // history and inbox results are translated on the server
    if (S.review && R().startsWith('review-')) await openReview(S.review.item.id, true);
    render();
  } catch { /* the next sync picks it up */ }
}

/* ---------- shell ---------- */
function nav() {
  const r = R(), on = (h) => (r === h || r.startsWith(h + '-') ? 'on' : '');
  const team = S.d.team, ib = S.d.inbox.filter((i) => i.status === 'review').length;
  const projs = S.d.projects.filter((p) => p.status !== 'archived');
  return `<button class="teamsw" data-a="tmenu"><span class="logo">${esc(teamLogo(team))}</span><span class="lbl">${esc(teamName(team))}</span><span class="lbl" style="margin-left:auto">${ico('chev', 14)}</span></button>
  ${S.tmenu ? `<div class="tmenu">${S.teams.map((t) => `<button data-a="team" data-v="${t.id}"><span class="logo">${esc(teamLogo(t))}</span>${esc(teamName(t))}${t.id === S.tid ? ' ✓' : ''}</button>`).join('')}<button data-a="newTeam">${ico('plus')}${$t('Create a team')}</button></div>` : ''}
  <button class="srch" data-a="ask">${ico('search', 15)}<span class="lbl">${$t('Search')}</span><kbd>⌘K</kbd></button>
  <button class="nv ${on('dashboard')}" data-a="go" data-h="dashboard">${ico('dash')}<span class="lbl">${$t('Dashboard')}</span></button>
  <button class="nv ${on('inbox') || on('review')}" data-a="go" data-h="inbox">${ico('inbox')}<span class="lbl">${$t('Inbox')}</span>${ib ? `<span class="bd">${ib}</span>` : ''}</button>
  <button class="nv ${on('tasks')}" data-a="go" data-h="tasks">${ico('tasks')}<span class="lbl">${$t('Tasks')}</span></button>
  <button class="nv ${on('knowledge')}" data-a="go" data-h="knowledge">${ico('kn')}<span class="lbl">${$t('Knowledge')}</span></button>
  <button class="nv ${on('assistant')}" data-a="go" data-h="assistant" aria-label="${$t('Assistant')}">${ico('spark')}<span class="lbl">${$t('Assistant')}</span></button>
  <div class="sect">${personal() ? $t('My space') : 'Team Space'}</div>
  <button class="nv ${on('vision')}" data-a="go" data-h="vision">${ico('vision')}<span class="lbl">${personal() ? 'Vision' : 'Team vision'}</span></button>
  ${projs.map((p) => `<button class="nv ${on('project-' + p.id)}" data-a="go" data-h="project-${p.id}"><span class="dot" style="--c:${p.color}"></span><span class="lbl">${esc(p.name)}</span></button>${S.d.hypotheses.filter((h) => h.project === p.id).map((h) => `<button class="nv sub ${r === 'hyp-' + h.id ? 'on' : ''}" data-a="go" data-h="hyp-${h.id}">${hcode(h.id)} · ${HST[h.status]}</button>`).join('')}`).join('')}
  ${isAdmin() ? `<button class="nv" data-a="newProject">${ico('plus')}<span class="lbl">${$t('New project')}</span></button>` : ''}
  <div class="spacer"></div>
  ${personal() ? '' : `<button class="nv ${on('members')}" data-a="go" data-h="members">${ico('users')}<span class="lbl">${$t('Members')}</span></button>`}
  <button class="nv ${on('profile')}" data-a="go" data-h="profile">${ico('gear')}<span class="lbl">${$t('Profile')}</span></button>
  <button class="nv ${on('roadmap')}" data-a="go" data-h="roadmap">${ico('route')}<span class="lbl">Roadmap</span></button>
  <div class="me">${av(uid(), 28)}<span class="lbl"><b>${esc(S.me.name)}</b><br><span class="hint">${ROLE[role()]}</span></span><button class="btn ghost sm lbl" style="margin-left:auto" data-a="logout" title="${$t('Sign out')}">${ico('out', 14)}</button></div>`;
}
function top() {
  const team = S.d.team;
  return `<button class="btn ghost m-only menu-btn" data-a="navOpen" aria-label="${$t('Menu')}" aria-expanded="${S.navOpen ? 'true' : 'false'}">${ico('menu', 20)}</button><span class="m-only m-team"><span class="logo">${esc(teamLogo(team))}</span><b>${esc(teamName(team))}</b></span>${S.ai ? '' : `<span class="chip amber d-only" title="${$t('Configure an AI provider on the server')}">${$t('AI analysis is off')}</span>`}<div class="spacer"></div><button class="btn ghost m-only icon-btn" data-a="ask" aria-label="${$t('Search')}">${ico('search', 18)}</button><button class="btn pri add-btn" data-a="add" aria-label="${$t('Add to inbox')}">${ico('plus')}<span class="d-only">${$t('Add to inbox')} <kbd style="background:none;color:inherit;border-color:#fff5">I</kbd></span></button>`;
}
function tabbar() {
  const r = R(), on = (...hs) => (hs.some((h) => r === h || r.startsWith(h + '-')) ? 'on' : '');
  const ib = S.d.inbox.filter((i) => i.status === 'review').length;
  const it = (h, i, l, extra = '', o = on(h)) => `<button class="tb ${o}" data-a="go" data-h="${h}" ${o ? 'aria-current="page"' : ''}>${ico(i, 21)}<span>${l}</span>${extra}</button>`;
  return `<nav class="tabbar" aria-label="${$t('Navigation')}">${it('dashboard', 'dash', $t('Dashboard'))}${it('inbox', 'inbox', $t('Inbox'), ib ? `<span class="bd">${ib}</span>` : '', on('inbox', 'review'))}${it('tasks', 'tasks', $t('Tasks'))}${it('knowledge', 'kn', $t('Knowledge'))}${it('assistant', 'spark', $t('Assistant'))}</nav>`;
}

/* ---------- pages ---------- */
function pDashboard() {
  const v = tasks().filter(isOpen), u = uid();
  const mine = v.filter((t) => t.owner === u).sort((a, b) => ((a.due || '9') < (b.due || '9') ? -1 : 1));
  const mf = S.dash === 'team' ? mine.filter((t) => !isExt(t.requester) && t.requester !== u) : S.dash === 'ext' ? mine.filter((t) => isExt(t.requester)) : mine;
  const owed = v.filter((t) => t.requester === u && t.owner !== u);
  const byP = {}; owed.forEach((t) => (byP[t.owner] = byP[t.owner] || []).push(t));
  const over = [...mine, ...owed].filter((t) => t.due && diff(TODAY(), t.due) < 0).length;
  const rv = S.d.inbox.filter((i) => i.status === 'review'), proc = S.d.inbox.filter((i) => i.status === 'processing');
  const unr = tasks().filter((t) => t.unread);
  const dec = S.d.knowledge.filter((k) => !k.supersededBy).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
  const act = S.d.hypotheses.filter((h) => h.status === 'testing');
  const h = new Date().getHours(), hi = h < 12 ? $t('Good morning') : h < 18 ? $t('Good afternoon') : $t('Good evening');
  return `<div class="hd"><div><h1>${hi}, ${esc(S.me.name.split(' ')[0])}</h1><div class="sub">${fdl(new Date())}</div></div></div>
  <div class="chips" style="margin-bottom:20px"><button class="chip big" data-a="go" data-h="inbox">${$t('<b>{n}</b> waiting for review', { n: rv.length })}</button>${proc.length ? `<span class="chip big"><span class="spin"></span> ${$t('<b>{n}</b> being analyzed', { n: proc.length })}</span>` : ''}<span class="chip big" style="${over ? 'color:var(--red)' : ''}">${$t('<b>{n}</b> overdue', { n: over })}</span>${unr.length ? `<span class="chip big" style="color:var(--red)">${$t('<b>{n}</b> with new comments', { n: unr.length })}</span>` : ''}</div>
  <div class="grid g3">
  <div class="col"><div class="card"><h2>${TASK_SECTION_NAMES.mine} <span class="seg sm" style="margin-left:auto">${[['all', $t('All')], ['team', $t('To team')], ['ext', $t('To external')]].map(([k, l]) => `<button class="${S.dash === k ? 'on' : ''}" data-a="dash" data-v="${k}">${l}</button>`).join('')}</span></h2>${mf.length ? mf.map(trow).join('') : `<div class="empty">${$t('No open commitments.')}<br><button class="btn sm" style="margin-top:10px" data-a="newTask">${ico('plus', 13)} ${$t('New task')}</button></div>`}</div>
  ${unr.length ? `<div class="card"><h2>${$t('New comments')}</h2>${unr.map((t) => { const c = t.comments.at(-1); return `<button class="trow" data-a="open" data-id="${t.id}">${av(c.author)}<span class="tt"><b>${esc(t.title)}</b><span class="mt">${esc(c.text.slice(0, 120))}</span></span></button>`; }).join('')}</div>` : ''}</div>
  <div class="col"><div class="card"><h2>${TASK_SECTION_NAMES.delegated} <button class="lnk" data-a="tasksTab" data-v="delegated">${$t('All →')}</button></h2>${Object.keys(byP).length ? Object.entries(byP).map(([pid, ts]) => { const od = ts.filter((t) => t.due && diff(TODAY(), t.due) < 0).length; const nx = ts.filter((t) => t.due).sort((a, b) => (a.due < b.due ? -1 : 1))[0]; return `<button class="trow" data-a="${isExt(pid) ? 'tasksTab' : 'go'}" data-v="delegated" data-h="person-${esc(pid)}">${av(pid, 32)}<span class="tt"><b>${esc(pnx(pid))}</b><span class="mt"><span>${$t('{n} open', { n: ts.length })}</span>${od ? `<span class="chip red">${$t('{n} overdue', { n: od })}</span>` : ''}${nx ? `<span>${$t('next: {date}', { date: fd(nx.due) })}</span>` : ''}</span></span>${ico('arrow', 14)}</button>`; }).join('') : `<div class="empty">${$t('You haven’t delegated anything yet.')}<br>${$t('Tasks appear after you review a meeting.')}</div>`}</div>
  <div class="card"><h2>${$t('Inbox')} <button class="lnk" data-a="go" data-h="inbox">${$t('Open →')}</button></h2>${rv.length ? rv.slice(0, 5).map((i) => `<button class="trow" data-a="go" data-h="review-${i.id}"><span class="iico">${ico(typeIco(i.type))}</span><span class="tt"><b>${esc(i.title)}</b><span class="mt">${propCount(i)} · ${esc(i.origin)}</span></span><span class="btn sm">Review</span></button>`).join('') : `<div class="empty">${$t('The inbox is clear.')}<br><button class="btn sm" style="margin-top:10px" data-a="add">${ico('plus', 13)} ${$t('Drop a transcript')}</button></div>`}</div></div>
  <div class="col"><div class="card"><h2>${$t('Recent knowledge')} <button class="lnk" data-a="go" data-h="knowledge">${$t('Knowledge →')}</button></h2>${dec.map((k) => `<div style="padding:7px 0;border-bottom:1px solid var(--line);font-size:14px"><span class="ty ${k.type}">${KT[k.type]}</span> ${esc(k.text)}<div class="hint">${fds(k.date)} ${tag(k.project)}</div></div>`).join('') || `<div class="empty">${$t('Nothing here yet')}</div>`}</div>
  <div class="card"><h2>${$t('Active hypotheses')}</h2>${act.map((h) => { const ts = tasks().filter((t) => t.hypothesis === h.id), dn = ts.filter((t) => t.status === 'done').length; return `<button class="trow" data-a="go" data-h="hyp-${h.id}"><span class="tt"><b>${hcode(h.id)} · ${esc(h.then)}</b><span class="mt">${av(h.owner, 18)}${h.to ? `<span>${diff(TODAY(), h.to) >= 0 ? $t('{n} d left', { n: diff(TODAY(), h.to) }) : $t('past the deadline')}</span>` : ''}<span>${$t('{done}/{total} tasks', { done: dn, total: ts.length })}</span>${tag(h.project)}</span></span></button>`; }).join('') || `<div class="empty">${$t('No hypotheses in “Testing”')}</div>`}</div></div>
  </div><footer class="dashboard-comparison">${comparisonLink()}</footer>`;
}
const propCount = (i) => { const c = i.counts || {}; const parts = [['task', 'task'], ['status', 'status'], ['kn', 'knowledge'], ['hyp', 'hypothesis'], ['project', 'project']].filter(([k]) => c[k]).map(([k, l]) => $p(c[k], l)); return parts.join(' · ') || $t('no proposals'); };

function pInbox() {
  const it = S.d.inbox, c = (k) => it.filter((i) => i.status === k).length;
  const tabs = [['review', $t('Waiting for review')], ['processing', $t('Processing')], ['done', $t('Processed')], ['ignored', $t('Skipped')], ['failed', $t('Errors')]].filter(([k]) => k !== 'failed' || c('failed'));
  const list = it.filter((i) => i.status === S.itab);
  return `<div class="hd"><div><h1>${$t('Inbox')}</h1><div class="sub">${$t('Personal: only you see the raw sources. The team gets only what you confirm.')}</div></div><div class="act"><button class="btn pri" data-a="add">${ico('plus')}${$t('Add')}</button></div></div>
  <div class="seg" style="margin-bottom:14px">${tabs.map(([k, l]) => `<button class="${S.itab === k ? 'on' : ''}" data-a="itab" data-v="${k}">${l} · ${c(k)}</button>`).join('')}</div>
  <div class="card" style="padding:0">${list.length ? list.map((i) => `<div class="irow" data-a="go" data-h="review-${i.id}"><span class="iico">${ico(typeIco(i.type), 18)}</span><span style="flex:1"><b>${esc(i.title)}</b><div class="hint">${ITYPE[i.type] || ''} · ${esc(i.origin)} · ${fd(i.date)}</div></span>${i.status === 'review' ? `<span class="chips"><span class="chip">${propCount(i)}</span></span><span class="btn sm pri">Review ${ico('arrow', 13)}</span>` : i.status === 'processing' ? `<span class="chip amber"><span class="spin"></span> ${$t('Analyzing…')}</span>` : i.status === 'failed' ? `<span class="chip red">${$t('Error')}</span>` : `<span class="hint">${esc(i.result || '')}</span>`}</div>`).join('') : `<div class="empty">${$t('Nothing here')}${S.itab === 'review' ? `<br><button class="btn sm" style="margin-top:10px" data-a="add">${ico('plus', 13)} ${$t('Add a transcript')}</button>` : ''}</div>`}</div>`;
}

/* ---------- review ---------- */
async function openReview(id, quiet) {
  try {
    const item = await api('GET', T(`/inbox/${encodeURIComponent(id)}`));
    if (quiet && S.review?.item.id === id && S.review.dirty) return;
    S.review = { item, props: structuredClone(item.proposals || []), dirty: false, sourceScope: item.sourceScope || (personal() ? 'private' : 'team') };
    render();
  } catch (e) { if (!quiet) { toast(e.message); location.hash = 'inbox'; } }
}
const norm = (s) => String(s || '').toLowerCase().replace(/[’'`ʼ"«»“”.,!?…:;()\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
function quoteLines(lines, quote) {
  const q = norm(quote); if (!q) return [];
  const hits = [];
  lines.forEach((l, i) => { const n = norm(l); if (n.length < 4) return; if (q.includes(n) || n.includes(q) || (q.length > 30 && n.includes(q.slice(0, 30))) || (n.length > 30 && q.includes(n.slice(0, 30)))) hits.push(i); });
  return hits;
}
function pReview() {
  const id = R().slice(7);
  if (!S.review || S.review.item.id !== id) { openReview(id); return '<div class="empty"><span class="spin"></span></div>'; }
  const { item, props } = S.review;
  if (S.applied?.id === item.id) { const a = S.applied; return `<div class="done-box"><div class="big">${$t('Done')}</div><p style="font-size:17px;margin:14px 0 4px">${esc(a.lines.join(' · ') || $t('Nothing was saved'))}</p><p class="hint">${a.notified.length ? $t('Notifications go to: {names}', { names: esc(a.notified.join(', ')) }) : $t('Everything is saved')}</p>${a.notes.map((n) => `<p class="hint danger">${esc(n)}</p>`).join('')}<div class="chips" style="justify-content:center;margin-top:18px"><button class="btn pri" data-a="go" data-h="tasks">${$t('Go to tasks')}</button><button class="btn" data-a="go" data-h="knowledge">${$t('Go to knowledge')}</button>${a.sourceId ? `<button class="btn" data-a="go" data-h="source-${a.sourceId}">${ico('file', 14)} ${$t('Open source')}</button>` : ''}<button class="btn" data-a="go" data-h="inbox">${$t('Go to inbox')}</button></div></div>`; }
  const lines = (item.source || '').split('\n');
  const tsRe = /^\s*\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\s*/;
  const head = `<div class="hd"><div><button class="btn ghost sm" data-a="go" data-h="inbox">${ico('back', 14)} ${$t('Inbox')}</button><h1 style="margin-top:8px">${esc(item.title)}</h1><div class="sub inl">${ITYPE[item.type] || ''} · ${esc(item.origin)} · ${fd(item.date)}${(item.participants || []).filter((p) => p.member_id).map((p) => `<span class="alias">${esc(p.name_in_source)} → ${esc(pn(p.member_id))} ✓</span>`).join('')}</div></div><div class="act">${item.file ? `<a class="btn" href="${fileUrl(`/inbox/${item.id}`)}" target="_blank" rel="noopener">${ico('file')}${$t('Open PDF')}</a>` : ''}${item.type !== 'routed' && item.status !== 'processing' ? `<button class="btn" data-a="reanalyze">${ico('spark')}${$t('Analyze again')}</button>` : ''}${['review', 'ignored'].includes(item.status) ? `<button class="btn" data-a="ignoreItem">${item.status === 'ignored' ? $t('Back to review') : $t('Skip')}</button>` : ''}<button class="btn ghost" data-a="delItem" title="${$t('Delete item')}">${ico('trash')}</button></div></div>`;
  const src = `<div class="card src" data-keep="src">${item.audio ? audioPlayer(`/inbox/${item.id}`, item.audio) : ''}${(item.summary || []).length ? `<div class="sum"><b>${$t('Summary')}</b><ul>${item.summary.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}${lines.map((l, i) => { const pg = /^\[p\. (\d+)\]$/.exec(l.trim()); if (pg) return `<div class="pg" id="ln-${i}">${$t('Page {n}', { n: pg[1] })}</div>`; const m = tsRe.exec(l); return `<div class="ln ${m ? '' : 'plain'}" id="ln-${i}">${m ? `<span class="ts">${esc(m[1])}</span>` : ''}<span>${esc(m ? l.slice(m[0].length) : l) || '&nbsp;'}</span></div>`; }).join('')}${srcNote(item)}</div>`;
  if (item.status === 'processing') return head + `<div class="rv">${src}<div class="card"><div class="empty"><span class="spin"></span><br><br>${item.stage === 'transcribing' ? $t('Transcribing the recording…') : $t('AI is analyzing the source… usually 20–60 seconds.')}<br>${$t('You can leave — the item will wait in the inbox.')}</div></div></div>`;
  const sec = (k, l) => { const ps = props.filter((p) => p.kind === k); return ps.length ? `<div class="sec"><h2>${l}</h2><span class="n">${ps.length}</span></div>${ps.map((p) => propCard(p, lines)).join('')}` : ''; };
  const on = props.filter((p) => p.on).length;
  const closed = item.status === 'done';
  const body = `${item.error ? `<div class="err">${esc(item.error)}</div>` : ''}${closed ? `<div class="lock" style="margin-bottom:12px">${ico('lock')}<span>${$t('Item processed: {result}', { result: esc(item.result || '') })}</span></div>` : ''}
  ${sec('task', $t('New commitments'))}${sec('status', $t('Status updates'))}${sec('kn', $t('Knowledge'))}${sec('project', $t('New projects'))}${sec('hyp', $t('New hypotheses'))}
  ${!props.length ? `<div class="card"><div class="empty">${S.ai ? $t('AI found nothing to save.') : $t('No proposals.')} ${$t('Add one manually:')}</div></div>` : ''}
  ${closed ? '' : `<div class="chips" style="margin:12px 0"><button class="btn sm" data-a="addProp" data-v="task">${ico('plus', 13)} ${$t('Task')}</button><button class="btn sm" data-a="addProp" data-v="kn">${ico('plus', 13)} ${$t('Knowledge')}</button><button class="btn sm" data-a="addProp" data-v="hyp">${ico('plus', 13)} ${$t('Hypothesis')}</button></div>
  <div class="bar"><b>${$t('Selected {on} of {total}', { on, total: props.length })}</b><span class="hint">${$t('Hover a card to highlight its quote on the left')}</span><button class="btn" data-a="saveDraft">${$t('Save draft')}</button><button class="btn pri" data-a="apply" ${on ? '' : 'disabled'}>${$t('Apply selected')} <kbd style="background:none;color:inherit;border-color:#fff5">⌘↵</kbd></button></div>`}`;
  return head + `<div class="rv">${src}<div>${body}</div></div>`;
}
// Where the original goes when the item is applied: into the knowledge base as a source.
function srcNote(item) {
  const lockNote = `<p class="hint" style="margin:10px 8px 0">${ico('lock', 13)} ${$t('Only you see the raw text.')}</p>`;
  if (!keepsSource(item)) return lockNote;
  const src = srcOf(item.sourceId);
  if (item.status === 'done') return src ? `<p class="hint" style="margin:10px 8px 0">${ico(srcIco(src.kind), 13)} ${$t('Saved to the knowledge base as a source.')} <button class="lnk" data-a="go" data-h="source-${src.id}">${$t('Open source')}</button></p>` : lockNote;
  const sc = S.review.sourceScope;
  return `<div class="src-scope"><span>${ico('kn', 13)} ${item.file ? $t('On apply, the PDF and its text are saved to the knowledge base as a source.') : item.audio ? $t('On apply, the recording and its transcript are saved to the knowledge base as a source.') : $t('On apply, the transcript is saved to the knowledge base as a source.')}</span>${personal() ? '' : `<span class="seg sm"><button class="${sc === 'team' ? 'on' : ''}" data-a="srcScope" data-v="team">${ico('users', 12)} ${$t('Team')}</button><button class="${sc === 'private' ? 'on' : ''}" data-a="srcScope" data-v="private">${ico('lock', 12)} ${$t('Only me')}</button></span>`}</div>`;
}
// Where a knowledge entry belongs: project → hypothesis.
const knPlace = (k) => {
  const p = k.project && prj(k.project), h = k.hypothesis && hyp(k.hypothesis);
  return `<div class="kplace">${ico('route', 13)} ${p ? `<button class="lnk" data-a="go" data-h="project-${p.id}"><span class="dot" style="--c:${p.color}"></span> ${esc(p.name)}</button>` : `<span class="hint">${$t('No project')}</span>`}${h ? ` → <button class="lnk" data-a="go" data-h="hyp-${h.id}">${hcode(h.id)} · ${esc((h.then || h.statement || '').slice(0, 60))}</button>` : p ? ` → <span class="hint">${$t('No hypothesis')}</span>` : ''}</div>`;
};
function propCard(p, lines) {
  const hl = quoteLines(lines, p.quote).join(',');
  const q = p.quote ? `<div class="ev">“${esc(p.quote)}”${p.ts ? `<span class="ts">${esc(p.ts)}</span>` : ''}</div>` : '';
  const A = (f) => `data-f="${f}" data-p="${p.id}"`;
  let b = '';
  if (p.kind === 'task') {
    b = `<input class="ttl" ${A('p.title')} value="${esc(p.title)}" placeholder="${$t('What to do')}" aria-label="${$t('Task title')}"><div class="fields"><label>${$t('Owner')} ${selWho(A('p.owner'), p.owner)}</label><label>${$t('Requester')} ${selWho(A('p.requester'), p.requester)}</label><label>${$t('Deadline')} <input type="date" ${A('p.due')} value="${p.due || ''}"></label><label>${$t('Project')} ${selProj(A('p.project'), p.project)}</label><label>${$t('Hypothesis')} ${selHyp(A('p.hypothesis'), p.hypothesis, p.project)}</label><label><input type="checkbox" ${A('p.important')} ${p.important ? 'checked' : ''}> ${$t('Important')}</label></div>`;
    if (p.owner && p.owner !== uid() && !isExt(p.owner)) b += `<div class="route">${ico('route', 13)} ${$t('{name} will see the task in “{section}”', { name: esc(pn(p.owner)), section: TASK_SECTION_NAMES.mine })}</div>`;
    if (p.requester && p.requester !== uid() && !isExt(p.requester)) b += `<div class="route">${ico('lock', 13)} ${$t('{name}, the requester, will change the status', { name: esc(pn(p.requester)) })}</div>`;
    if (p.dup) { const d = tasks().find((x) => x.id === p.dup); if (d) b += `<div class="warn">${ico('warn')} ${$t('Looks like an existing task “{title}”', { title: esc(d.title) })}<span class="seg sm"><button class="${p.merge ? 'on' : ''}" data-a="pset" data-p="${p.id}" data-k="merge" data-v="1">${$t('Merge')}</button><button class="${p.merge ? '' : 'on'}" data-a="pset" data-p="${p.id}" data-k="merge" data-v="0">${$t('Create new')}</button></span></div>`; }
  } else if (p.kind === 'status') {
    const t = tasks().find((x) => x.id === p.task);
    if (!t) b = `<div class="hint">${$t('The task is no longer available')}</div>`;
    else {
      b = `<div style="font-weight:650">“${esc(t.title)}”</div><div class="fields" style="margin-top:6px"><span class="chip">${STL[t.status]}</span> → <select ${A('p.to')}>${Object.entries(STL).map(([k, l]) => `<option value="${k}" ${k === p.to ? 'selected' : ''}>${l}</option>`).join('')}</select>${av(t.owner, 18)} ${esc(pnx(t.owner))}</div>`;
      if (!t.canEdit) b += `<div class="route">${ico('route', 13)} ${$t('{name} set this task — the proposal goes to them for confirmation', { name: esc(pnx(t.controller)) })}</div>`;
    }
  } else if (p.kind === 'kn') {
    b = `<div class="fields" style="margin-bottom:6px"><select ${A('p.type')}>${Object.entries(KT).map(([k, l]) => `<option value="${k}" ${k === p.type ? 'selected' : ''}>${l}</option>`).join('')}</select>${personal() ? '' : `<span class="seg sm"><button class="${p.scope === 'private' ? 'on' : ''}" data-a="pset" data-p="${p.id}" data-k="scope" data-v="private">${ico('lock', 12)} ${$t('Only me')}</button><button class="${p.scope !== 'private' ? 'on' : ''}" data-a="pset" data-p="${p.id}" data-k="scope" data-v="team">${ico('users', 12)} ${$t('Team')}</button></span>`}<label>${$t('Project')} ${selProj(A('p.project'), p.project)}</label><label>${$t('Hypothesis')} ${selHyp(A('p.hypothesis'), p.hypothesis, p.project)}</label></div><input class="ttl" ${A('p.text')} value="${esc(p.text)}" placeholder="${$t('Text of the decision / fact')}" aria-label="${$t('Knowledge text')}"><input class="in" style="width:100%;font-size:13px" ${A('p.why')} value="${esc(p.why || '')}" placeholder="${$t('Why (optional)')}">`;
    b += knPlace(p);
    if (p.visionConflict) b += `<div class="warn vis">${ico('warn')} <span><b>${$t('Possible conflict with the vision')}:</b> ${esc(p.visionConflict)}</span></div>`;
    if (p.conflict) { const k = S.d.knowledge.find((x) => x.id === p.conflict); if (k) b += `<div class="warn">${ico('warn')} <span><b>${$t('Possible conflict with an earlier agreement')}:</b> ${$t('Contradicts the entry from {date}: “{text}”', { date: fds(k.date), text: esc(k.text) })}${p.conflictNote ? `<span class="cnote">${esc(p.conflictNote)}</span>` : ''}</span><span class="seg sm"><button class="${p.res === 'replace' ? 'on' : ''}" data-a="pset" data-p="${p.id}" data-k="res" data-v="replace">${$t('Replace the old one')}</button><button class="${p.res !== 'replace' ? 'on' : ''}" data-a="pset" data-p="${p.id}" data-k="res" data-v="both">${$t('Keep both')}</button></span></div>`; }
  } else if (p.kind === 'project') {
    b = `<div class="hint">${$t('New project')}${isAdmin() ? '' : ` · ${$t('requires the Admin role')}`}</div><input class="ttl" ${A('p.name')} value="${esc(p.name)}" placeholder="${$t('Project name')}"><textarea class="in" rows="2" ${A('p.vision')} placeholder="Vision">${esc(p.vision || '')}</textarea>`;
  } else {
    b = `<div class="hint">${$t('New hypothesis (draft)')}</div><div class="grid" style="gap:6px;margin:6px 0"><label class="fl">${$t('If')}<input class="in" ${A('p.if')} value="${esc(p.if || '')}"></label><label class="fl">${$t('then')}<input class="in" ${A('p.then')} value="${esc(p.then || '')}"></label><label class="fl">${$t('because')}<input class="in" ${A('p.because')} value="${esc(p.because || '')}"></label></div><div class="fields"><label>${$t('Project')} ${selProj(A('p.project'), p.project)}</label><label>${$t('Responsible')} ${selWho(A('p.owner'), p.owner, false)}</label><label>${$t('Metric')} <input class="in" style="min-height:28px;font-size:13px" ${A('p.metric')} value="${esc(p.metric || '')}"></label></div>`;
  }
  return `<div class="prop ${p.on ? '' : 'off'}" data-ev="${hl}"><input type="checkbox" ${A('p.on')} ${p.on ? 'checked' : ''} aria-label="${$t('Save')}"><div class="pbody">${b}${q}<div class="pmeta">${p.manual ? `<span class="hint">${$t('Added manually')}</span>` : `<span class="conf ${p.conf === 'high' ? '' : 'med'}">${p.conf === 'high' ? $t('High confidence') : $t('Medium confidence — check it')}</span>`}<button class="btn ghost sm" style="margin-left:auto" data-a="delProp" data-p="${p.id}" title="${$t('Remove')}">${ico('x', 13)}</button></div></div></div>`;
}

/* ---------- tasks ---------- */
function filteredTasks() {
  let ts = tasks(); const u = uid();
  if (S.dir === 'mine') ts = ts.filter((t) => t.owner === u); if (S.dir === 'owed') ts = ts.filter((t) => t.requester === u && t.owner !== u); if (S.dir === 'team') ts = ts.filter((t) => t.owner !== u && t.requester !== u);
  if (S.person) ts = ts.filter((t) => t.owner === S.person || t.requester === S.person);
  if (S.proj) ts = ts.filter((t) => t.project === S.proj);
  return ts;
}
function pTasks() {
  const views = [['matrix', $t('Matrix')], ['kanban', $t('Kanban')], ['list', $t('List')], ['delegated', TASK_SECTION_NAMES.delegated]];
  let ts = filteredTasks();
  const people = [...new Set(tasks().flatMap((t) => [t.owner, t.requester]))].filter((w) => w && w !== uid());
  const f = `<div class="chips" style="margin-bottom:16px;align-items:center"><select class="in" data-f="dir" aria-label="${$t('Direction')}"><option value="all">${$t('All directions')}</option><option value="mine" ${S.dir === 'mine' ? 'selected' : ''}>${TASK_SECTION_NAMES.mine}</option><option value="owed" ${S.dir === 'owed' ? 'selected' : ''}>${TASK_SECTION_NAMES.delegated}</option>${isAdmin() && !personal() ? `<option value="team" ${S.dir === 'team' ? 'selected' : ''}>${$t('Between others (visible to admins)')}</option>` : ''}</select><select class="in" data-f="fperson" aria-label="${$t('Person')}"><option value="">${$t('All people')}</option>${people.map((p) => `<option value="${esc(p)}" ${S.person === p ? 'selected' : ''}>${esc(pnx(p))}</option>`).join('')}</select><select class="in" data-f="fproj" aria-label="${$t('Project')}"><option value="">${$t('All projects')}</option>${S.d.projects.map((p) => `<option value="${p.id}" ${S.proj === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>${S.tab === 'list' ? `<select class="in" data-f="fst" aria-label="${$t('Status')}"><option value="open">${$t('Open ones')}</option><option value="all" ${S.fst === 'all' ? 'selected' : ''}>${$t('All statuses')}</option>${Object.entries(STL).map(([k, l]) => `<option value="${k}" ${S.fst === k ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}${role() === 'member' ? `<span class="hint">${ico('lock', 13)} ${$t('You see only tasks where you are the owner or the requester')}</span>` : ''}</div>`;
  let body = '';
  if (S.tab === 'matrix') {
    const o = ts.filter(isOpen), Q = [['11', $t('Do now'), $t('Urgent and important')], ['01', $t('Schedule'), $t('Important, not urgent')], ['10', $t('Delegate'), $t('Urgent, not important')], ['00', $t('Drop'), $t('Neither')]];
    body = `<div class="mx">${Q.map(([k, l, s]) => { const it = o.filter((t) => (urgent(t) ? '1' : '0') + (t.important ? '1' : '0') === k); return `<div class="q q${k}" data-drop="q:${k}"><h3>${l} <small>${s} · ${it.length}</small></h3>${it.map((t) => `<div draggable="${t.canEdit}" data-drag="${t.id}">${trow(t)}</div>`).join('') || `<div class="empty">${$t('Drag a task here')}</div>`}</div>`; }).join('')}</div><p class="hint" style="margin-top:12px">${$t('Urgency comes from the deadline (≤ {n} d), importance from the flag. Only the task’s requester can drag it.', { n: urgentDays() })}</p>`;
  } else if (S.tab === 'kanban') {
    body = `<div class="kb">${['open', 'progress', 'waiting', 'done'].map((s) => { const it = ts.filter((t) => t.status === s); return `<div class="kcol" data-drop="st:${s}"><h3><span class="st ${s}"></span>${STL[s]} <span class="hint">${it.length}</span></h3>${it.map(kcard).join('')}</div>`; }).join('')}</div>`;
  } else if (S.tab === 'list') {
    if (S.fst === 'open') ts = ts.filter(isOpen); else if (S.fst !== 'all') ts = ts.filter((t) => t.status === S.fst);
    const key = (t) => (S.grp === 'person' ? t.owner : S.grp === 'project' ? t.project || '—' : 'all'); const g = {};
    ts.sort((a, b) => ((a.due || '9') < (b.due || '9') ? -1 : 1)).forEach((t) => (g[key(t)] = g[key(t)] || []).push(t));
    body = `<div class="chips" style="margin-bottom:10px;align-items:center"><span class="hint">${$t('Group:')}</span><span class="seg sm">${[['person', $t('By owner')], ['project', $t('By project')], ['none', $t('No grouping')]].map(([k, l]) => `<button class="${S.grp === k ? 'on' : ''}" data-a="grp" data-v="${k}">${l}</button>`).join('')}</span></div><div class="card" style="padding:4px 6px;overflow-x:auto">${ts.length ? `<table class="ttable"><thead><tr><th>${$t('Task')}</th><th>${$t('Owner')}</th><th>${$t('Requester')}</th><th>${$t('Deadline')}</th><th>${$t('Status')}</th><th>${$t('Project')}</th><th>${$t('Hypothesis')}</th><th>${$t('Source')}</th></tr></thead><tbody>${Object.entries(g).map(([k, it]) => `${S.grp !== 'none' ? `<tr class="grp"><td colspan="8">${S.grp === 'person' ? esc(pnx(k)) : esc(prj(k)?.name || $t('No project'))} · ${it.length}</td></tr>` : ''}${it.map((t) => `<tr data-a="open" data-id="${t.id}"><td><b style="font-weight:600">${esc(t.title)}</b> ${cmt(t)}</td><td>${av(t.owner, 20)} ${esc(pnx(t.owner))}</td><td>${esc(pnx(t.requester))}</td><td>${dueChip(t)}</td><td><span class="st ${t.status}" style="display:inline-block;vertical-align:-2px"></span> ${STL[t.status]}</td><td>${tag(t.project)}</td><td>${t.hypothesis ? hcode(t.hypothesis) : ''}</td><td class="hint">${esc(t.source?.itemTitle || '')}</td></tr>`).join('')}`).join('')}</tbody></table>` : `<div class="empty">${$t('No tasks match these filters')}</div>`}</div>`;
  } else {
    const d = tasks().filter((t) => t.requester === uid() && t.owner !== uid()), g = {}; d.forEach((t) => (g[t.owner] = g[t.owner] || []).push(t));
    body = `<div class="grid g2">${Object.entries(g).map(([pid, it]) => { const o = it.filter(isOpen), od = o.filter((t) => t.due && diff(TODAY(), t.due) < 0).length, nc = it.filter((t) => t.unread).length; return `<div class="card"><h2>${av(pid, 28)} ${esc(pnx(pid))}${isExt(pid) ? '' : `<button class="btn sm" style="margin-left:auto" data-a="go" data-h="person-${pid}">1:1 →</button>`}</h2><div class="chips" style="margin-bottom:8px"><span class="chip">${$t('{n} open', { n: o.length })}</span>${od ? `<span class="chip red">${$t('{n} overdue', { n: od })}</span>` : ''}${nc ? `<span class="chip red">${$t('{n} with new comments', { n: nc })}</span>` : ''}</div>${o.map(trow).join('') || `<div class="empty">${$t('All closed')}</div>`}</div>`; }).join('') || `<div class="empty">${$t('No delegated tasks')}</div>`}</div>`;
  }
  return `<div class="hd"><div><h1>${$t('Tasks')}</h1><div class="sub">${$t('Commitments between people: who → to whom → what → by when')}</div></div><div class="act"><span class="seg">${views.map(([k, l]) => `<button class="${S.tab === k ? 'on' : ''}" data-a="tasksTab" data-v="${k}">${l}</button>`).join('')}</span><button class="btn pri" data-a="newTask">${ico('plus')}${$t('New task')}</button></div></div>${S.tab === 'delegated' ? '' : f}${body}`;
}

/* ---------- knowledge ---------- */
function knCard(k) {
  const sup = k.supersedes && S.d.knowledge.find((x) => x.id === k.supersedes), supBy = k.supersededBy && S.d.knowledge.find((x) => x.id === k.supersededBy);
  const canEdit = k.author === uid() || (isAdmin() && k.scope === 'team');
  return `<div class="kn ${k.supersededBy ? 'sup' : ''}"><div class="km"><span class="ty ${k.type}">${KT[k.type]}</span>${k.scope === 'private' ? `<span>${ico('lock', 12)} ${$t('Only me')}</span>` : `<span>${ico('users', 12)} ${$t('Team')}</span>`}${tag(k.project)}${k.hypothesis && hyp(k.hypothesis) ? `<button class="chip" data-a="go" data-h="hyp-${k.hypothesis}">${hcode(k.hypothesis)}</button>` : ''}${canEdit ? `<span style="margin-left:auto" class="inl"><button class="btn ghost sm" data-a="editKn" data-id="${k.id}">${$t('Edit')}</button><button class="btn ghost sm" data-a="delKn" data-id="${k.id}" title="${$t('Delete')}">${ico('trash', 13)}</button></span>` : ''}</div><div class="ktx">${esc(k.text)}</div>${k.why ? `<div class="hint">${$t('Why:')} ${esc(k.why)}</div>` : ''}${k.quote ? `<div class="ev">“${esc(k.quote)}”</div>` : ''}<div class="km" style="margin-top:6px">${av(k.author, 18)}<span>${esc(pn(k.author))} · ${fds(k.date)}</span><span>${$t('Source:')} ${srcOf(k.sourceId) ? `<button class="lnk" data-a="go" data-h="source-${k.sourceId}">${ico(srcIco(srcOf(k.sourceId).kind), 12)} ${esc(knSource(k.source))}</button>` : esc(knSource(k.source))}</span>${sup ? `<span>${$t('replaces “{text}”', { text: esc(sup.text) })}</span>` : ''}${supBy ? `<span class="chip red">${$t('replaced {date}', { date: fds(supBy.date) })}</span>` : ''}</div></div>`;
}
function derivedOf(src) {
  const find = { task: (id) => tasks().find((t) => t.id === id), knowledge: (id) => S.d.knowledge.find((k) => k.id === id), hypothesis: (id) => S.d.hypotheses.find((h) => h.id === id), project: (id) => prj(id) };
  const seen = new Set();
  return (src.derived || []).filter((d) => find[d.kind] && !seen.has(d.kind + d.id) && seen.add(d.kind + d.id)).map((d) => ({ ...d, item: find[d.kind](d.id) }));
}
function derivedCounts(src) {
  const ds = derivedOf(src).filter((d) => d.item), c = (k) => ds.filter((d) => d.kind === k).length;
  return [['task', 'task'], ['knowledge', 'knowledge'], ['hypothesis', 'hypothesis'], ['project', 'project']].filter(([k]) => c(k)).map(([k, l]) => $p(c(k), l)).join(' · ') || $t('nothing you can see');
}
function srcCard(x) {
  return `<div class="kn src-card" data-a="go" data-h="source-${x.id}" style="cursor:pointer"><div class="km"><span class="iico">${ico(srcIco(x.kind), 16)}</span><span class="ty context">${SRCKIND[x.kind] || x.kind}</span>${x.scope === 'private' ? `<span>${ico('lock', 12)} ${$t('Only me')}</span>` : `<span>${ico('users', 12)} ${$t('Team')}</span>`}${x.file ? `<span>${esc(x.file.name)} · ${fsize(x.file.size)}${x.file.pages ? ' · ' + $p(x.file.pages, 'page') : ''}</span>` : ''}${x.audio ? `<span>${ico('mic', 12)} ${mmss(x.audio.duration)}</span>` : ''}</div><div class="ktx">${esc(x.title)}</div><div class="km" style="margin-top:6px">${av(x.author, 18)}<span>${esc(pn(x.author))} · ${fds(x.date)}</span><span>${$t('Created from it:')} ${derivedCounts(x)}</span></div></div>`;
}
async function loadSource(id) {
  try { S.srcView = await api('GET', T(`/sources/${encodeURIComponent(id)}`)); }
  catch (e) { S.srcView = { id, error: e.message }; }
  render();
}
function pSource(id) {
  const meta = srcOf(id);
  if (!S.srcView || S.srcView.id !== id) { S.srcView = { id, loading: true }; loadSource(id); }
  const v = S.srcView, x = v.loading || v.error ? meta : v;
  const back = `<button class="btn ghost sm" data-a="go" data-h="knowledge">${ico('back', 14)} ${$t('Knowledge')}</button>`;
  if (!x) return `<div class="hd"><div>${back}</div></div><div class="empty">${v.loading ? '<span class="spin"></span>' : $t('This source is not available.')}</div>`;
  const base = `/sources/${x.id}`;
  const ds = derivedOf(meta || x), hidden = ((meta || x).derived || []).length - ds.filter((d) => d.item).length;
  const row = (d) => d.kind === 'task' ? `<button class="trow" data-a="open" data-id="${d.id}"><span class="iico">${ico('tasks')}</span><span class="tt"><b>${esc(d.item.title)}</b><span class="mt">${esc(pnx(d.item.owner))} · ${STL[d.item.status]}</span></span></button>`
    : d.kind === 'knowledge' ? `<button class="trow" data-a="go" data-h="knowledge-${d.id}"><span class="iico">${ico('kn')}</span><span class="tt"><b>${esc(d.item.text)}</b><span class="mt">${KT[d.item.type]}${d.item.supersededBy ? ' · ' + $t('replaced') : ''}</span></span></button>`
    : d.kind === 'hypothesis' ? `<button class="trow" data-a="go" data-h="hyp-${d.id}"><span class="iico">${ico('spark')}</span><span class="tt"><b>${esc(d.item.statement || d.item.if)}</b></span></button>`
    : `<button class="trow" data-a="go" data-h="project-${d.id}"><span class="iico">${ico('dash')}</span><span class="tt"><b>${esc(d.item.name)}</b></span></button>`;
  const lines = String(v.text || '').split('\n');
  const pageRe = /^\[p\. (\d+)\]$/, tsRe = /^\s*\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\s*/;
  const text = v.loading ? '<div class="empty"><span class="spin"></span></div>' : v.error ? `<div class="err">${esc(v.error)}</div>` : lines.map((l) => { const pg = pageRe.exec(l.trim()); if (pg) return `<div class="pg">${$t('Page {n}', { n: pg[1] })}</div>`; const m = tsRe.exec(l); return `<div class="ln ${m ? '' : 'plain'}">${m ? `<span class="ts">${esc(m[1])}</span>` : ''}<span>${esc(m ? l.slice(m[0].length) : l) || '&nbsp;'}</span></div>`; }).join('');
  return `<div class="hd"><div>${back}<h1 style="margin-top:8px;display:flex;gap:10px;align-items:center">${ico(srcIco(x.kind), 22)} ${esc(x.title)}</h1><div class="sub inl">${SRCKIND[x.kind] || ''} · ${esc(x.file ? x.file.name : x.origin || '')}${x.file?.pages ? ' · ' + $p(x.file.pages, 'page') : ''} · ${fd(x.date)} · ${esc(pn(x.author))} · ${x.scope === 'private' ? `${ico('lock', 12)} ${$t('Only me')}` : `${ico('users', 12)} ${$t('Team')}`}</div></div><div class="act">${x.file ? `<a class="btn pri" href="${fileUrl(base)}" target="_blank" rel="noopener">${ico('file')}${$t('Open PDF')}</a><a class="btn" href="${fileUrl(base, true)}">${$t('Download')}</a>` : ''}${meta?.canDelete ? `<button class="btn ghost" data-a="delSrc" data-id="${x.id}" title="${$t('Delete source')}">${ico('trash')}</button>` : ''}</div></div>
  <div class="rv"><div class="card src">${x.audio ? audioPlayer(base, x.audio) : ''}${(x.summary || []).length ? `<div class="sum"><b>${$t('Summary')}</b><ul>${x.summary.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}${text}</div>
  <div><div class="card"><h2>${$t('Created from this source')}</h2>${ds.filter((d) => d.item).map(row).join('') || `<div class="empty">${$t('Nothing you can see')}</div>`}${hidden > 0 ? `<p class="hint">${ico('lock', 12)} ${$t('{n} more are private to other people or were deleted', { n: hidden })}</p>` : ''}</div></div></div>`;
}
function pKnowledge(id) {
  if (id) {
    const item = S.d.knowledge.find((k) => k.id === id);
    return `<div class="hd"><div><button class="btn ghost sm" data-a="go" data-h="knowledge">${ico('back', 14)} ${$t('Knowledge')}</button></div></div>${item ? knCard(item) : `<div class="empty">${$t('This knowledge entry is not available.')}</div>`}`;
  }
  let ks = S.d.knowledge;
  if (S.kscope !== 'all') ks = ks.filter((k) => k.scope === S.kscope); if (S.kproj) ks = ks.filter((k) => k.project === S.kproj);
  const head = `<div class="hd"><div><h1>${$t('Knowledge')}</h1><div class="sub">${$t('Agreements, decisions and facts, each linked to its source. Team knowledge is stored as Markdown in the team folder.')}</div></div><div class="act"><button class="btn pri" data-a="newKn">${ico('plus')}${$t('Add')}</button></div></div>
  <div class="chips" style="margin-bottom:16px;align-items:center"><span class="seg">${[['all', $t('All')], ...Object.entries(KT)].map(([k, l]) => `<button class="${S.knt === k && !S.klog ? 'on' : ''}" data-a="knt" data-v="${k}">${l}</button>`).join('')}</span><span class="seg"><button class="${S.klog ? 'on' : ''}" data-a="klog">Decision log</button><button class="${S.ksrc ? 'on' : ''}" data-a="ksrc">${ico('file', 13)} ${$t('Sources')} · ${(S.d.sources || []).length}</button></span>${personal() ? '' : `<select class="in" data-f="kscope" aria-label="${$t('Visibility')}"><option value="all">${$t('Team and mine')}</option><option value="team" ${S.kscope === 'team' ? 'selected' : ''}>${$t('Team only')}</option><option value="private" ${S.kscope === 'private' ? 'selected' : ''}>${$t('Mine only')}</option></select>`}<select class="in" data-f="kproj" aria-label="${$t('Project')}"><option value="">${$t('All projects')}</option>${S.d.projects.map((p) => `<option value="${p.id}" ${S.kproj === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>`;
  if (S.ksrc) {
    let ss = S.d.sources || [];
    if (S.kscope !== 'all') ss = ss.filter((x) => x.scope === S.kscope);
    if (S.kproj) ss = ss.filter((x) => derivedOf(x).some((d) => d.item?.project === S.kproj));
    return head + `<p class="hint" style="margin:-4px 0 12px">${$t('Original transcripts and PDF documents that tasks and knowledge were created from.')}</p>` + (ss.map(srcCard).join('') || `<div class="empty">${$t('No sources yet. They appear when you apply a transcript or a PDF from the inbox.')}</div>`);
  }
  if (S.klog) { const d = ks.filter((k) => k.type === 'decision').sort((a, b) => (a.date < b.date ? 1 : -1)); return head + (d.length ? `<div class="tl">${d.map(knCard).join('')}</div>` : `<div class="empty">${$t('No decisions yet')}</div>`); }
  const list = ks.filter((k) => !k.supersededBy && (S.knt === 'all' || k.type === S.knt)).sort((a, b) => (a.date < b.date ? 1 : -1));
  return head + (list.map(knCard).join('') || `<div class="empty">${$t('Nothing here yet. Knowledge appears after you review meetings, or you can add it manually.')}</div>`);
}

/* ---------- assistant ---------- */
const assistantTopics = () => [
  ['tasks', $t('What needs attention?'), $t('Which of my open tasks need attention?')],
  ['kn', $t('Key knowledge'), $t('What current knowledge and decisions are in this space?')],
  ['vision', $t('Goal progress'), $t('What is the current progress on project goals?')],
  ['spark', $t('Hypotheses in progress'), $t('Which hypotheses are being tested right now, and what are their metrics?')],
];
const assistantSourceNames = translated({ task: 'Task', knowledge: 'Knowledge', goal: 'Goal', hypothesis: 'Hypothesis', source: 'Source', inbox: 'Inbox' });
const assistantPath = (tid, suffix = '') => `/api/teams/${encodeURIComponent(tid)}/assistant/chats${suffix}`;
function assistantState() {
  if (!S.assistant.has(S.tid)) {
    const state = { chats: null, selected: null, chat: null, draft: '', pending: null, retry: null, error: '' };
    S.assistant.set(S.tid, state);
    void loadAssistantChats(S.tid, state);
  }
  return S.assistant.get(S.tid);
}
function renderAssistant(tid, state, scroll = false) {
  if (S.tid !== tid || S.assistant.get(tid) !== state || R() !== 'assistant') return;
  render();
  const history = document.querySelector('.assistant-thread');
  if (scroll && history) history.scrollTop = history.scrollHeight;
}
async function loadAssistantChats(tid, state) {
  state.error = '';
  try {
    state.chats = await api('GET', assistantPath(tid));
    if (state.chats.length && !state.selected) return openAssistantChat(tid, state, state.chats[0].id);
  } catch (error) { state.error = error.message; }
  renderAssistant(tid, state);
}
async function openAssistantChat(tid, state, id) {
  state.selected = id; state.chat = null; state.draft = ''; state.error = '';
  renderAssistant(tid, state);
  try {
    const chat = await api('GET', assistantPath(tid, '/' + encodeURIComponent(id)));
    if (state.selected === id) state.chat = chat;
  } catch (error) { if (state.selected === id) state.error = error.message; }
  if (state.selected === id) renderAssistant(tid, state, true);
}
function pAssistant() {
  const state = assistantState();
  const pending = state.pending?.cid === state.selected ? state.pending : null;
  const turns = state.chat?.turns || [];
  const loading = !state.error && (!state.chats || (state.selected && !state.chat && !pending && state.chats.some((c) => c.id === state.selected)));
  const sources = (items) => items.length ? `<div class="assistant-sources" aria-label="${$t('Sources')}">${items.map((s) => {
    const label = `${esc(assistantSourceNames[s.kind] || $t('Source'))}<span>${esc(s.title)}</span>`;
    if (['source', 'inbox'].includes(s.kind) && Number.isInteger(s.page) && s.page > 0) {
      const base = '/' + (s.kind === 'source' ? 'sources' : 'inbox') + '/' + encodeURIComponent(s.target);
      return `<a class="assistant-source" href="${fileUrl(base)}#page=${s.page}" title="${esc(s.title)}" target="_blank" rel="noopener">${label} · ${$t('Page {n}', { n: s.page })}${ico('arrow', 13)}</a>`;
    }
    return `<button type="button" class="assistant-source" data-a="assistantSource" data-kind="${esc(s.kind)}" data-id="${esc(s.target)}" title="${esc(s.title)}">${label}${ico('arrow', 13)}</button>`;
  }).join('')}</div>` : '';
  return `<section class="assistant">
    <header class="assistant-heading"><div><h1>${$t('Assistant')}</h1><p class="hint">${esc(teamName(S.d.team))}</p></div></header>
    <div class="assistant-workspace">
      <aside class="assistant-history" aria-label="${$t('Chat history')}">
        <div class="assistant-history-head"><h2>${$t('Chats')}</h2><button type="button" class="btn sm" data-a="assistantNew">${ico('plus', 14)} ${$t('New chat')}</button></div>
        <div class="assistant-history-list" data-keep="assistant-history">${(state.chats || []).map((chat) => `<button type="button" class="assistant-chat${chat.id === state.selected ? ' selected' : ''}" data-a="assistantChat" data-id="${esc(chat.id)}" aria-pressed="${chat.id === state.selected}"><span>${esc(chat.title)}</span><time datetime="${esc(chat.updatedAt)}">${fdt(chat.updatedAt)}</time></button>`).join('') || (state.chats ? `<p class="hint">${$t('Your chats will appear here.')}</p>` : '')}</div>
      </aside>
      <div class="assistant-main">
        <div class="assistant-thread" data-keep="assistant-thread" role="log" aria-label="${$t('Messages')}">
          ${loading ? `<div class="assistant-loading" role="status"><span class="spin"></span> ${$t('Loading the chat…')}</div>` : ''}
          ${!loading && !turns.length && !pending && !state.error ? `<div class="assistant-welcome"><span class="assistant-mark">${ico('spark', 26)}</span><h2>${$t('What would you like to know about your space?')}</h2><p>${$t('Ask about your documents, tasks, knowledge, goals or hypotheses.')}</p><div class="assistant-prompts">${assistantTopics().map(([icon, title, question]) => `<button type="button" data-a="assistantPrompt" data-question="${esc(question)}">${ico(icon, 17)}${title}${ico('arrow', 15)}</button>`).join('')}</div></div>` : ''}
          ${turns.map((turn) => `<article class="assistant-turn"><div class="assistant-question">${esc(turn.question)}</div><div class="assistant-answer"><span class="assistant-mark small" aria-hidden="true">${ico('spark', 17)}</span><div class="assistant-answer-body mdv">${md(turn.answer)}${sources(turn.sources || [])}</div></div></article>`).join('')}
          ${pending ? `<article class="assistant-turn"><div class="assistant-question">${esc(pending.question)}</div><div class="assistant-loading" role="status"><span class="spin"></span> ${$t('Preparing an answer…')}</div></article>` : ''}
        </div>
        <div class="assistant-compose">
          ${state.error ? `<p class="err" role="alert">${esc(state.error)}${!state.chats ? ` <button type="button" class="lnk" data-a="assistantReload">${$t('Try again')}</button>` : ''}</p>` : ''}
          ${!S.ai ? `<p class="hint" role="status">${$t('The AI assistant is temporarily unavailable.')}</p>` : ''}
          <form id="assistant-form"><textarea class="in" id="assistant-question" name="question" aria-label="${$t('Question for the assistant')}" maxlength="2000" rows="2" placeholder="${$t('Ask about this space…')}" required${!S.ai ? ' disabled' : ''}>${esc(state.draft)}</textarea><button class="btn pri" type="submit"${!S.ai || state.pending || loading ? ' disabled' : ''}>${ico('arrow', 17)} ${$t('Send')}</button></form>
        </div>
      </div>
    </div>
  </section>`;
}
async function sendAssistantQuestion() {
  const state = assistantState(), tid = S.tid, question = state.draft.trim();
  if (!question || state.pending || !S.ai) return;
  const cid = state.selected || crypto.randomUUID();
  const request = state.retry?.cid === cid && state.retry.question === question
    ? state.retry : { cid, question, id: crypto.randomUUID() };
  Object.assign(state, { pending: request, selected: cid, draft: '', error: '' });
  renderAssistant(tid, state, true);
  try {
    const chat = await api('POST', assistantPath(tid, '/' + encodeURIComponent(cid) + '/messages'), { id: request.id, question });
    state.chats = [{ id: chat.id, title: chat.title, updatedAt: chat.updatedAt }, ...(state.chats || []).filter((c) => c.id !== cid)];
    if (state.selected === cid) state.chat = chat;
    state.retry = null;
  } catch (error) {
    state.retry = request;
    if (state.selected === cid) { state.error = error.message; state.draft = state.draft || question; }
  } finally {
    state.pending = null;
    renderAssistant(tid, state, state.selected === cid);
  }
}

/* ---------- vision ---------- */
function pVision() {
  const ed = isAdmin();
  return `<div class="hd"><div><h1>${personal() ? 'Vision' : 'Team vision'}</h1><div class="sub">${esc(teamName(S.d.team))} · ${$t('vision.md in the team folder')}</div></div><div class="act">${ed ? (S.vEdit ? `<button class="btn" data-a="vCancel">${$t('Cancel')}</button><button class="btn pri" data-a="vSave">${$t('Save')}</button>` : `<button class="btn" data-a="vEdit">${$t('Edit')}</button>`) : `<span class="hint">${ico('lock', 13)} ${$t('Owner and Admin can edit')}</span>`}</div></div>
  <div class="card">${S.vEdit ? `<textarea class="in" id="vText" rows="22" style="font-family:ui-monospace,Menlo,monospace;font-size:14px">${esc(S.d.vision)}</textarea><p class="hint">${$t('Markdown: # heading, **bold**, - list')}</p>` : `<div class="doc mdv">${md(S.d.vision)}</div>`}
  ${S.vEdit ? '' : `<h2 style="margin-top:26px">${$t('Projects')}</h2>${S.d.projects.filter((p) => p.status !== 'archived').map((p) => `<p>${tag(p.id)} — ${esc(p.vision || '')}</p>`).join('') || `<p class="hint">${$t('No projects yet')}</p>`}`}</div>`;
}

/* ---------- project ---------- */
function hypCard(h) { const ts = tasks().filter((t) => t.hypothesis === h.id), dn = ts.filter((t) => t.status === 'done').length; return `<div class="hyp" data-a="go" data-h="hyp-${h.id}"><div class="chips" style="margin-bottom:8px;align-items:center"><b>${hcode(h.id)}</b>${hypChip(h)}${h.from || h.to ? `<span class="hint">${fds(h.from)} – ${fds(h.to)}</span>` : ''}</div>${stmt(h)}<div class="chips" style="margin-top:10px;align-items:center">${av(h.owner, 20)}<span class="hint">${esc(pn(h.owner))}</span>${h.metric ? `<span class="chip">${esc(h.metric)}: ${esc(h.current || '—')} / ${esc(h.target || '—')}</span>` : ''}<span class="chip">${$t('{done}/{total} tasks', { done: dn, total: ts.length })}</span></div></div>`; }
function pProject(id) {
  const p = prj(id); if (!p) return `<div class="empty">${$t('Project not found')}</div>`;
  const ts = tasks().filter((t) => t.project === id), dn = ts.filter((t) => t.status === 'done').length;
  const hs = S.d.hypotheses.filter((h) => h.project === id), ks = S.d.knowledge.filter((k) => k.project === id && !k.supersededBy);
  const ed = isAdmin();
  let b = '';
  if (S.ptab === 'overview') b = `<div class="grid g2"><div class="card"><h2>Vision ${ed ? `<button class="lnk" data-a="editProject" data-id="${id}">${$t('Edit')}</button>` : ''}</h2><p style="margin:0;font-size:16px;white-space:pre-wrap">${esc(p.vision || '—')}</p><div class="chips" style="margin-top:14px;align-items:center"><span class="hint">Owner</span>${av(p.owner)} ${esc(pn(p.owner))}<span class="hint" style="margin-left:10px">${$t('Members')}</span><span class="avs">${(p.members || []).map((m) => av(m)).join('')}</span></div></div>
  <div class="card"><h2>${$t('Task progress')}</h2><div style="font:800 36px Archivo,system-ui,sans-serif;font-stretch:112%">${dn}<span class="hint" style="font-size:18px"> / ${ts.length}</span></div><div class="prog"><i style="width:${ts.length ? (dn / ts.length) * 100 : 0}%"></i></div><div class="chips" style="margin-top:10px">${['open', 'progress', 'waiting'].map((s) => `<span class="chip">${STL[s]}: ${ts.filter((t) => t.status === s).length}</span>`).join('')}</div></div></div>
  <div class="card" style="margin-top:16px"><h2>${$t('Goals')} ${ed ? `<button class="lnk" data-a="editProject" data-id="${id}">${$t('Edit')}</button>` : ''}</h2>${(p.goals || []).length ? `<div style="overflow-x:auto"><table class="gtable"><thead><tr><th>${$t('Goal')}</th><th>${$t('Metric')}</th><th style="text-align:right">${$t('Current')}</th><th style="text-align:right">${$t('Target')}</th><th>${$t('Progress')}</th><th>${$t('By')}</th></tr></thead><tbody>${p.goals.map((g) => { const pc = Number(g.target) ? Math.min(100, (Number(g.current) / Number(g.target)) * 100) : 0; return `<tr style="cursor:default"><td><b style="font-weight:600">${esc(g.goal)}</b></td><td>${esc(g.metric)}</td><td style="text-align:right">${esc(g.current)}</td><td style="text-align:right">${esc(g.target)}</td><td style="width:160px"><div class="prog"><i style="width:${pc || 0}%"></i></div></td><td>${fds(g.by)}</td></tr>`; }).join('')}</tbody></table></div>` : `<div class="empty">${$t('No goals yet')}</div>`}</div>`;
  else if (S.ptab === 'hyps') b = `<div class="chips" style="margin-bottom:12px"><button class="btn pri" data-a="newHyp" data-id="${id}">${ico('plus')}${$t('New hypothesis')}</button></div><div class="grid g2">${hs.map(hypCard).join('') || `<div class="empty">${$t('No hypotheses yet')}</div>`}</div>`;
  else if (S.ptab === 'tasks') b = `<div class="card">${ts.map(trow).join('') || `<div class="empty">${$t('No tasks you can see')}</div>`}</div>`;
  else b = ks.map(knCard).join('') || `<div class="empty">${$t('No knowledge yet')}</div>`;
  return `<div class="hd"><div><div class="hint">${personal() ? $t('My space') : 'Team Space'} · ${$t('project')}</div><h1 style="display:flex;gap:10px;align-items:center"><span class="dot" style="--c:${p.color};width:14px;height:14px"></span>${esc(p.name)} ${prjChip(p)}</h1></div><div class="act">${ed ? `<select class="in" data-f="pst" data-id="${id}" aria-label="${$t('Project status')}">${Object.entries(PST).map(([k, l]) => `<option value="${k}" ${k === p.status ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}<span class="seg">${[['overview', $t('Overview')], ['hyps', $t('Hypotheses') + ' · ' + hs.length], ['tasks', $t('Tasks') + ' · ' + ts.length], ['kn', $t('Knowledge') + ' · ' + ks.length]].map(([k, l]) => `<button class="${S.ptab === k ? 'on' : ''}" data-a="ptab" data-v="${k}">${l}</button>`).join('')}</span></div></div>${b}`;
}

/* ---------- hypothesis ---------- */
function pHyp(id) {
  const h = hyp(id); if (!h) return `<div class="empty">${$t('Hypothesis not found')}</div>`;
  const ts = tasks().filter((t) => t.hypothesis === id), ed = isAdmin() || h.owner === uid();
  const verdict = h.verdict ? esc(h.verdict) : h.status === 'testing' ? (h.to ? $t('Still testing — verdict after {date}', { date: fds(h.to) }) : $t('Still testing')) : h.status === 'draft' ? $t('The hypothesis hasn’t started yet') : HST[h.status];
  return `<div class="hd"><div><button class="btn ghost sm" data-a="go" data-h="project-${h.project}">${ico('back', 14)} ${esc(prj(h.project)?.name || $t('Project'))}</button><div class="chips" style="margin-top:10px;align-items:center"><b>${hcode(id)}</b>${hypChip(h)}</div></div><div class="act">${ed ? `<select class="in" data-f="hst" data-id="${id}" aria-label="${$t('Status')}">${Object.entries(HST).map(([k, l]) => `<option value="${k}" ${k === h.status ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="btn" data-a="editHyp" data-id="${id}">${$t('Edit')}</button><button class="btn ghost" data-a="delHyp" data-id="${id}" title="${$t('Delete')}">${ico('trash')}</button>` : `<span class="hint">${ico('lock', 13)} ${$t('{name} or an Admin can edit', { name: esc(pn(h.owner)) })}</span>`}</div></div>
  <div class="bigstmt" style="margin-bottom:24px">${stmtHtml(h)}</div>
  <div class="chips" style="margin-bottom:22px"><span class="chip big">${$t('Responsible:')} <b>${esc(pn(h.owner))}</b></span><span class="chip big">${esc(h.metric || $t('No metric set'))}: <b>${esc(h.current || '—')}</b> / ${esc(h.target || '—')}</span><span class="chip big">${h.from || h.to ? `${fds(h.from)} – ${fds(h.to)}` : $t('No timeframe set')}</span></div>
  <div class="grid g2"><div class="card"><h2>${$t('Hypothesis tasks')} · ${ts.length}<button class="lnk" data-a="newTask" data-proj="${h.project}" data-hyp="${id}">${$t('+ Task')}</button></h2>${ts.map(trow).join('') || `<div class="empty">${$t('Link tasks from Review or from a task card')}</div>`}</div>
  <div class="card"><h2>Learnings</h2><div class="inl" style="margin-bottom:10px"><input class="in" id="learnTxt" style="flex:1" placeholder="${$t('What did we learn?')}"><button class="btn sm pri" data-a="addLearn" data-id="${id}">${$t('Add')}</button></div>${(h.learnings || []).map((l) => `<div style="padding:8px 0;border-bottom:1px solid var(--line)"><div class="hint">${fds(l.at)} · ${esc(pn(l.by))}</div>${esc(l.text)}</div>`).join('') || `<div class="empty">${$t('Learnings will appear here')}</div>`}<h3 style="margin:16px 0 6px">${$t('Verdict')}</h3><div class="hint">${verdict}</div></div></div>`;
}

/* ---------- person ---------- */
function pPerson(id) {
  const m = M()[id]; if (!m) return `<div class="empty">${$t('Person not found')}</div>`;
  const iOwe = tasks().filter((t) => isOpen(t) && t.owner === uid() && t.requester === id), theyOwe = tasks().filter((t) => isOpen(t) && t.owner === id && t.requester === uid());
  return `<div class="hd"><div style="display:flex;gap:14px;align-items:center">${av(id, 52)}<div><h1>${esc(m.name)}</h1><div class="sub">${ROLE[m.role]} · ${esc(m.email || '')}</div></div></div></div>
  <div class="grid g2"><div class="card"><h2>${$t('Delegated to {name}', { name: esc(m.name) })} · ${theyOwe.length}</h2>${theyOwe.map(trow).join('') || `<div class="empty">${$t('Nothing')}</div>`}</div><div class="card"><h2>${$t('My tasks from {name}', { name: esc(m.name) })} · ${iOwe.length}</h2>${iOwe.map(trow).join('') || `<div class="empty">${$t('Nothing')}</div>`}</div></div>`;
}

/* ---------- members ---------- */
function pMembers() {
  const ad = isAdmin(), own = role() === 'owner';
  const inv = S.d.team.invites || [];
  const yes = '✓', no = '—', own2 = $t('only tasks they set');
  const rights = [['', 'Owner', 'Admin', 'Member'], [$t('Invite, change roles'), yes, yes, no], [$t('Transfer ownership'), yes, no, no], [$t('See shared tasks between other people'), yes, yes, no], [$t('Create projects, edit Team vision'), yes, yes, no], [$t('Create hypotheses'), yes, yes, $t('own')], [$t('Change a task’s status'), own2, own2, own2], [$t('See other people’s raw transcripts'), no, no, no]];
  return `<div class="hd"><div><h1>${$t('Members')}</h1><div class="sub">${esc(teamName(S.d.team))} · ${$p(S.d.members.length, 'member')}</div></div><div class="act">${own && S.d.members.length > 1 ? `<button class="btn" data-a="transfer">${$t('Transfer ownership')}</button>` : ''}${ad ? `<button class="btn pri" data-a="invite">${ico('plus')}${$t('Invite')}</button>` : ''}</div></div>
  <div class="card" style="padding:4px 6px;overflow-x:auto"><table class="mtable"><thead><tr><th>${$t('Person')}</th><th>Email</th><th>${$t('Role')}</th><th style="text-align:right">${$t('Open commitments')}</th><th></th></tr></thead><tbody>${S.d.members.map((m) => `<tr data-a="go" data-h="person-${m.id}"><td>${av(m.id, 26)} <b style="font-weight:600">${esc(m.name)}</b>${m.id === uid() ? ` <span class="hint">(${$t('you')})</span>` : ''}</td><td>${esc(m.email || '')}</td><td>${ad && m.role !== 'owner' && m.id !== uid() ? `<select class="in" data-f="role" data-id="${m.id}" aria-label="${$t('Role')}"><option value="admin" ${m.role === 'admin' ? 'selected' : ''}>Admin</option><option value="member" ${m.role === 'member' ? 'selected' : ''}>Member</option></select>` : ROLE[m.role]}</td><td style="text-align:right">${tasks().filter((t) => isOpen(t) && t.owner === m.id).length}</td><td style="text-align:right">${m.role !== 'owner' && (ad || m.id === uid()) ? `<button class="btn ghost sm" data-a="removeMember" data-id="${m.id}">${m.id === uid() ? $t('Leave') : $t('Remove')}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
  ${ad ? `<div class="card" style="margin-top:16px"><h2>${$t('Invite links')}</h2>${inv.length ? inv.map((i) => `<div class="lnkbox">${ico('link')}<code>${esc(location.origin)}/join/${esc(i.token)}</code><span class="chip">${ROLE[i.role]}</span>${i.email ? `<span class="hint">${esc(i.email)}</span>` : `<span class="hint">${$t('reusable')}</span>`}<button class="btn sm" data-a="copyInv" data-v="${esc(i.token)}">${$t('Copy')}</button><button class="btn ghost sm" data-a="revokeInv" data-v="${esc(i.token)}">${$t('Revoke')}</button></div>`).join('') : `<div class="hint">${$t('No active invites. Create a link and send it to people through any channel.')}</div>`}</div>` : ''}
  <div class="card" style="margin-top:16px"><h2>${$t('Who sees what')}</h2><table><tbody style="cursor:default">${rights.map((r, ri) => `<tr style="cursor:default">${r.map((c, i) => `<td${i ? ' style="color:var(--mut)"' : ''}>${ri === 0 ? `<b>${c}</b>` : c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/* ---------- profile ---------- */
function pProfile() {
  return `<div class="hd"><div><h1>${$t('Profile')}</h1><div class="sub">${esc(S.me.email)}</div></div></div>
  <div class="grid g2"><div class="card"><h2>${$t('About me')}</h2><div class="grid" style="gap:12px"><label class="fl">${$t('Name')}<input class="in" id="pfName" value="${esc(S.me.name)}"></label><label class="fl">${$t('What transcripts call me (comma-separated)')}<input class="in" id="pfAliases" value="${esc((S.me.aliases || []).join(', '))}" placeholder="${$t('Vova, Volodya, Volodymyr')}"></label><p class="hint" style="margin:0">${$t('AI uses these names to understand who promised what.')}</p><div class="fl">${$t('Interface language')}<div>${langSwitch('seg')}</div></div><div><button class="btn pri" data-a="saveProfile">${$t('Save')}</button></div></div></div>
  ${isAdmin() && !personal() ? `<div class="card"><h2>${$t('Team')}</h2><div class="grid" style="gap:12px"><label class="fl">${$t('Team name')}<input class="in" id="tmName" value="${esc(S.d.team.name)}" ${role() === 'owner' ? '' : 'disabled'}></label><label class="fl">${$t('Urgent if the deadline is within (days)')}<input class="in" type="number" min="0" max="14" id="tmUrg" value="${urgentDays()}"></label><div><button class="btn pri" data-a="saveTeam">${$t('Save')}</button></div></div></div>` : ''}
  <div class="card"><h2>${$t('Claude, Codex and other AI apps')}</h2><p class="hint" style="margin-top:0">${$t('Connect TeamOS as an MCP server: the app signs in with your account and sees and changes only what you can.')}</p><pre class="hint" style="font-size:12.5px;white-space:pre-wrap;margin:0 0 12px">${esc(location.origin)}/mcp</pre><a class="btn" href="/oauth/connections">${$t('Connected apps')}</a></div>
  <div class="card"><h2>${$t('Where the data lives')}</h2><p class="hint" style="margin-top:0">${$t('Tasks, projects and hypotheses are JSON; knowledge is Markdown. Each user has their own folder with a subfolder for each team; shared items live in the team folder. The entry point everywhere is <code>index.md</code>.')}</p><pre class="hint" style="font-size:12.5px;white-space:pre-wrap;margin:0">data/users/${esc(S.me.id)}/index.md\ndata/users/${esc(S.me.id)}/teams/${esc(S.tid)}/  (${$t('inbox, private tasks and knowledge')})\ndata/teams/${esc(S.tid)}/index.md  (${$t('projects, hypotheses, shared tasks and knowledge')})</pre></div></div>`;
}

/* ---------- roadmap ---------- */
function pRoadmap() {
  if (S.roadmap == null) {
    S.roadmap = '';
    api('GET', '/api/roadmap').then((r) => { S.roadmap = r.markdown; render(); }).catch((e) => { S.roadmap = null; toast(e.message); });
    return '<div class="empty"><span class="spin"></span></div>';
  }
  return `<div class="hd"><div><h1>Roadmap</h1><div class="sub">${$t('What we plan before TeamOS is complete. Source: the Roadmap section of README.md.')}</div></div></div>
  <div class="card"><div class="doc mdv" lang="en">${md(S.roadmap) || `<p class="hint">${$t('The roadmap is empty')}</p>`}</div></div>`;
}

/* ---------- login, onboarding, join ---------- */
function loginAccess() {
  const invite = S.pendingJoin ? `<p class="orbit-invite">${$t('You’ve been invited to a team. Sign in to join.')}</p>` : '';
  const emailForm = S.loginSent
    ? `<div class="orbit-sent" role="status"><strong>${$t('Check your inbox')}</strong><p>${$t('We sent a one-time link to <b>{email}</b>. It expires in 15 minutes.', { email: esc(S.loginEmail) })}</p></div>
       <button class="orbit-text-button" type="button" data-a="emailAgain">${$t('Use another email or send again')}</button>`
    : `<form id="email-login" class="orbit-form"><label for="orbit-email">${$t('Sign in to your workspace')}</label>
       <div class="orbit-fields"><input id="orbit-email" name="email" type="email" value="${esc(S.loginEmail)}" required maxlength="254" autocomplete="email" placeholder="${$t('Work email address')}" aria-label="${$t('Work email address')}" ${S.loginBusy ? 'disabled' : ''}>
       <button type="submit" ${S.loginBusy ? 'disabled' : ''}>${S.loginBusy ? $t('Sending…') : $t('Email me a link')} ${ico('arrow', 17)}</button></div>
       ${S.loginError ? `<p class="orbit-error" role="alert">${esc(S.loginError)}</p>` : ''}</form>`;
  const local = S.cfg.dev ? `<details class="orbit-local" ${S.cfg.emailLink ? '' : 'open'}><summary>${$t('Local development sign-in')}</summary>
    <label>Email<input id="devEmail" type="email" placeholder="name@example.com" autocomplete="email"></label>
    <label>${$t('Name (optional)')}<input id="devName" autocomplete="name"></label><button type="button" data-a="devLogin">${$t('Sign in locally')}</button></details>` : '';
  return invite + (S.cfg.emailLink ? emailForm : S.cfg.dev ? '' : `<p class="orbit-error" role="status">${$t('Email sign-in is temporarily unavailable.')}</p>`) + local;
}
function pLogin() {
  return `<main class="orbit"><div class="orbit-frame">
    <header class="orbit-header"><div class="orbit-brand"><span aria-hidden="true">T</span>TeamOS</div><div class="orbit-links">${comparisonLink()}${langSwitch('orbit-lang')}</div></header>
    <div class="orbit-hero"><div class="orbit-copy">
      <h1>${$t('A metaverse<br><em>for your business.</em>')}</h1>
      <p>${$t('Invite your team and bring the materials you already work with. TeamOS connects documents, goals, and hypotheses to your projects, and captures what people agreed to after each meeting.')}</p>
      <div id="login-access">${loginAccess()}</div>
    </div><team-knowledge-graph></team-knowledge-graph></div>
  </div></main>`;
}
const obBrand = () => `<div style="display:flex;gap:10px;align-items:center;font-weight:800;margin-bottom:28px"><span class="logo">T</span>TeamOS<span style="margin-left:auto;font-weight:400">${langSwitch()}</span></div>`;
function pOnboarding() {
  return `<div class="ob">${obBrand()}<div class="steps"><i class="on"></i><i></i></div><h1>${$t('Let’s start with a team')}</h1><p class="hint" style="font-size:15px">${$t('You can have as many teams as you like. Your personal space is always there.')}</p>
  <div class="grid" style="gap:10px;margin:20px 0"><button class="opt ${S.obMode !== 'personal' ? 'on' : ''}" data-a="obMode" data-v="create"><span class="logo">${ico('users')}</span><span><b>${$t('Create a team')}</b><div class="hint">${$t('You become the Owner and can invite people with a link')}</div></span></button><button class="opt ${S.obMode === 'personal' ? 'on' : ''}" data-a="obMode" data-v="personal"><span class="logo">${ico('lock')}</span><span><b>${$t('Just for me')}</b><div class="hint">${$t('A personal second brain, no team')}</div></span></button></div>
  ${S.obMode !== 'personal' ? `<label class="fl">${$t('Team name')}<input class="in" id="obName" placeholder="${$t('E.g. Linxa Team')}"></label>` : ''}
  <p class="hint">${$t('Got an invite link? Just open it and you’ll join the team.')}</p>
  <div class="mdf" style="justify-content:flex-end;margin-top:28px"><button class="btn pri" data-a="obGo">${$t('Next')}</button></div></div>`;
}
function pJoin() {
  const tok = R().slice(5);
  if (!S.me) return pLogin();
  if (!S.join || S.join.token !== tok) {
    S.join = { token: tok, loading: true };
    api('GET', `/api/invites/${encodeURIComponent(tok)}`).then((r) => { S.join = { token: tok, ...r }; render(); }).catch((e) => { S.join = { token: tok, error: e.message }; render(); });
  }
  const j = S.join;
  return `<div class="ob">${obBrand()}${j.loading ? '<div class="empty"><span class="spin"></span></div>' : j.error ? `<h1>${$t('This invite is not valid')}</h1><p class="hint">${esc(j.error)}</p><button class="btn" data-a="joinSkip">${$t('Go to the dashboard')}</button>` : `<h1>${$t('Join “{team}”', { team: esc(j.team.name) })}</h1><div class="inv" style="margin:20px 0">${ico('users', 20)}<span>${$t('<b>{who}</b> invited you to the <b>{team}</b> team as {role}.', { who: esc(j.invitedBy), team: esc(j.team.name), role: ROLE[j.role] })}</span></div>${j.member ? `<p class="hint">${$t('You are already a member of this team.')}</p>` : `<p class="hint">${$t('You will see tasks where you are the owner or the requester, plus team knowledge, projects and hypotheses. Your inbox stays personal.')}</p>`}<div class="mdf" style="justify-content:flex-start"><button class="btn pri" data-a="joinGo">${j.member ? $t('Open the team') : $t('Join')}</button><button class="btn ghost" data-a="joinSkip">${$t('Not now')}</button></div>`}</div>`;
}

/* ---------- drawer ---------- */
function drawer() {
  const el = document.getElementById('drawer');
  const t = S.drawer && tasks().find((x) => x.id === S.drawer);
  if (!t || !S.d) { el.classList.remove('on'); el.setAttribute('aria-hidden', 'true'); el.innerHTML = ''; return; }
  const ce = t.canEdit, ro = ce ? '' : 'disabled';
  const srcOwn = t.source && t.source.owner === uid() && S.d.inbox.some((i) => i.id === t.source.itemId);
  el.innerHTML = `<div class="dw"><div class="dwh"><span class="st ${t.status}"></span>${ce ? `<select class="in" data-f="t.status" aria-label="${$t('Status')}">${Object.entries(STL).map(([k, l]) => `<option value="${k}" ${k === t.status ? 'selected' : ''}>${l}</option>`).join('')}</select>` : `<span class="chip">${STL[t.status]}</span>`}${t.shared ? `<span class="chip">${ico('users', 12)} ${$t('shared')}</span>` : `<span class="chip">${ico('lock', 12)} ${$t('private')}</span>`}<div class="task-drawer-actions">${ce ? `<button class="btn ghost sm" data-a="shareTask" aria-label="${$t('Share task')}" title="${$t('Share task')}">${ico('link')}</button><button class="btn ghost sm" data-a="delTask" title="${$t('Delete')}">${ico('trash')}</button>` : ''}<button class="btn ghost sm" data-a="closeD" aria-label="${$t('Close')}">${ico('x')}</button></div></div>
  <textarea class="dwt" rows="2" data-f="t.title" ${ce ? '' : 'readonly'} aria-label="${$t('Title')}">${esc(t.title)}</textarea>
  ${ce ? '' : `<div class="lock">${ico('lock')}<span>${$t('<b>{name}</b>, who set the task, changes its status and fields. If you have an update, write a comment.', { name: esc(pnx(t.controller)) })}</span></div>`}
  <div class="kv"><span>${$t('Owner')}</span>${ce ? selWho(`class="in" data-f="t.owner" aria-label="${$t('Owner')}"`, t.owner) : `<span>${av(t.owner, 20)} ${esc(pnx(t.owner))}</span>`}
  <span>${$t('Requester')}</span><span>${av(t.requester, 20)} ${esc(pnx(t.requester))}</span>
  <span>${$t('Deadline')}</span><span style="display:flex;gap:8px;align-items:center"><input type="date" class="in" data-f="t.due" value="${t.due || ''}" ${ro} aria-label="${$t('Deadline')}">${dueChip(t)}</span>
  <span>${$t('Priority')}</span><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-f="t.important" ${t.important ? 'checked' : ''} ${ro}> ${$t('Important')} ${urgent(t) && isOpen(t) ? `<span class="chip red">${$t('Urgent')}</span>` : ''}</label>
  <span>${$t('Project')}</span>${selProj(`class="in" data-f="t.project" ${ro} aria-label="${$t('Project')}"`, t.project)}
  <span>${$t('Hypothesis')}</span>${selHyp(`class="in" data-f="t.hypothesis" ${ro} aria-label="${$t('Hypothesis')}"`, t.hypothesis, t.project)}</div>
  <label class="fl">${$t('Description')}<textarea class="in" rows="3" data-f="t.description" ${ce ? '' : 'readonly'}>${esc(t.description || '')}</textarea></label>
  ${t.source ? `<div class="box"><h3>${$t('Source')}</h3>${t.source.quote ? `<div class="quote">“${esc(t.source.quote)}”</div>` : ''}<div class="hint" style="margin-top:6px">${esc(t.source.itemTitle)}${t.source.ts ? ' · ' + esc(t.source.ts) : ''} · ${srcOf(t.source.sourceId) ? `<button class="btn ghost sm" data-a="go" data-h="source-${t.source.sourceId}">${ico(srcIco(srcOf(t.source.sourceId).kind), 13)} ${$t('Open source')}</button>` : srcOwn ? `<button class="btn ghost sm" data-a="go" data-h="review-${t.source.itemId}">${$t('View')}</button>` : `${ico('lock', 12)} ${$t('only the person who added it sees the full text')}`}</div></div>` : ''}
  <div class="box"><h3>${$t('Comments')} · ${t.comments.length}</h3>${t.comments.map((c) => `<div class="cm">${av(c.author, 26)}<div><b>${esc(pn(c.author))}</b> <span class="when">${fdt(c.at)}</span><div style="white-space:pre-wrap">${esc(c.text)}</div></div></div>`).join('')}<textarea class="in" id="cmt" rows="2" placeholder="${ce ? $t('Comment…') : $t('Write what’s done or what’s blocking…')}"></textarea><div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn pri sm" data-a="comment">${$t('Send')}</button></div></div>
  <div class="box"><h3>${$t('History')}</h3><div class="hist">${t.history.slice().reverse().map((h) => `<div><b style="color:var(--ink)">${fdt(h.at)}</b> · ${esc(pn(h.by))}: ${esc(h.text)}${h.source ? ` <span>(${esc(h.source)})</span>` : ''}</div>`).join('')}</div></div></div>`;
  el.classList.add('on'); el.setAttribute('aria-hidden', 'false');
}

/* ---------- modals ---------- */
function taskShareContent(m) {
  if (m.pending) return `<p class="hint" role="status">${$t('Loading…')}</p>`;
  if (m.error) return `<p class="err" role="alert">${esc(m.error)}</p><div class="mdf"><button class="btn" data-a="retryTaskShare">${$t('Try again')}</button></div>`;
  return `<p class="hint">${$t('Anyone with the link can view the title, description, deadline and comments.')}</p>
  ${m.link ? `<label class="fl" for="task-share-link">${$t('Task link')}</label><div class="task-share-link"><input class="in" id="task-share-link" type="url" value="${esc(m.link)}" readonly><button class="btn pri" data-a="copyTaskShare">${$t('Copy')}</button></div>
  <p class="hint">${$t('Creating a new link disables the previous one.')}</p><div class="mdf"><button class="btn ghost" data-a="disableTaskShare">${$t('Disable link')}</button><button class="btn" data-a="replaceTaskShare">${$t('Regenerate link')}</button></div>` :
  `<div class="mdf"><button class="btn pri" data-a="replaceTaskShare">${$t('Create link')}</button></div>`}`;
}

async function requestTaskShare(m, method) {
  if (m?.k !== 'taskShare' || m.pending) return;
  m.pending = true;
  m.error = '';
  modal();
  document.getElementById('task-share-dialog')?.focus();
  try {
    const { link } = await api(method, m.url, method === 'POST' ? {} : undefined);
    m.link = link;
    if (S.modal === m && method !== 'GET') toast($t(link ? 'Task link created' : 'Task link disabled'));
  } catch (e) {
    m.error = e instanceof TypeError ? $t('Could not reach TeamOS. Please try again.') : e.message;
  } finally {
    m.pending = false;
    if (S.modal === m) {
      modal();
      document.querySelector('#task-share-dialog .mdf button:last-child, #task-share-dialog [data-a="copyTaskShare"]')?.focus();
    }
  }
}

/* ---------- dictation ---------- */
// MediaRecorder keeps the audio; the browser's speech recognition (where available) fills the transcript live.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const REC_LANGS = [['uk-UA', 'Українська'], ['en-US', 'English'], ['ru-RU', 'Русский'], ['pl-PL', 'Polski'], ['de-DE', 'Deutsch']];
const VREC = { rec: null, sr: null, chunks: [], blob: null, url: null, mime: '', start: 0, dur: 0, timer: null, final: '', lang: (() => { try { return localStorage.getItem('teamos.recLang'); } catch { return null; } })() };
const recLang = () => VREC.lang || (LANG === 'uk' ? 'uk-UA' : 'en-US');
const MAX_AUDIO = 20 * 1048576;
function voicePanel(m) {
  const live = Boolean(VREC.rec);
  const ctl = live
    ? `<button class="btn rec on" data-a="recStop">${ico('x', 15)} ${$t('Stop')}</button><span class="rec-dot"></span><b id="recTime">${mmss((Date.now() - VREC.start) / 1000)}</b><span class="hint">${$t('Recording…')}</span>`
    : VREC.blob
      ? `<audio controls src="${VREC.url}"></audio><span class="hint">${mmss(VREC.dur)} · ${fsize(VREC.blob.size)}</span><button class="btn sm" data-a="recReset">${$t('Record again')}</button>`
      : `<button class="btn pri rec" data-a="recStart">${ico('mic', 16)} ${$t('Start recording')}</button><span class="hint">${$t('Say your conclusions and takeaways — the recording and its transcript are kept as the source.')}</span>`;
  const langSel = SR ? `<label class="hint inl" style="gap:6px">${$t('Speech language')}<select class="in sm" data-f="recLang" ${live ? 'disabled' : ''}>${REC_LANGS.map(([v, l]) => `<option value="${v}" ${v === recLang() ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : '';
  const note = S.transcribe
    ? $t('The live transcript comes from the browser. After saving, the server transcribes the recording again for better accuracy — unless you edit the text by hand.')
    : SR ? $t('Check and fix the transcript before saving — it becomes the source text.') : '';
  const warn = !SR && !S.transcribe ? `<div class="err" style="margin-top:8px">${$t('This browser has no speech recognition and server transcription isn’t configured. Use Chrome or Safari, or set OPENAI_API_KEY on the server.')}</div>` : '';
  return `<div class="card voice-rec"><div class="voice-ctl">${ctl}</div>${langSel ? `<div style="margin-top:10px">${langSel}</div>` : ''}</div>
    <textarea class="in" id="addTxt" rows="7" ${live ? 'readonly' : ''} placeholder="${SR ? $t('The transcript appears here as you speak…') : S.transcribe ? $t('The transcript will be made on the server after saving.') : ''}">${esc(m.text || '')}</textarea>${note ? `<p class="hint" style="margin:6px 0 0">${note}</p>` : ''}${warn}`;
}
function recPickMime() {
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
}
async function recStart() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error($t('This browser can’t record audio'));
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch { throw new Error($t('No access to the microphone. Allow it in the browser and try again.')); }
  recReset();
  if (!S.modal || S.modal.tab !== 'voice') { stream.getTracks().forEach((t) => t.stop()); return; }
  const mime = recPickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  Object.assign(VREC, { rec, chunks: [], mime: rec.mimeType || mime || 'audio/webm', start: Date.now(), final: '' });
  S.modal.text = '';
  rec.ondataavailable = (e) => { if (e.data.size) VREC.chunks.push(e.data); };
  rec.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    if (VREC.rec !== rec) return; // discarded
    VREC.blob = new Blob(VREC.chunks, { type: VREC.mime }); VREC.url = URL.createObjectURL(VREC.blob);
    VREC.dur = (Date.now() - VREC.start) / 1000; VREC.rec = null; clearInterval(VREC.timer);
    if (S.modal?.k === 'add') { const ta = document.getElementById('addTxt'); if (ta) S.modal.text = ta.value; S.modal.title = val('addTitle'); modal(); }
  };
  rec.start(1000);
  VREC.timer = setInterval(() => { const el = document.getElementById('recTime'); if (el) el.textContent = mmss((Date.now() - VREC.start) / 1000); }, 500);
  if (SR) {
    const sr = new SR();
    Object.assign(sr, { lang: recLang(), continuous: true, interimResults: true });
    sr.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) VREC.final += r[0].transcript.trim() + ' '; else interim += r[0].transcript; }
      VREC.auto = (VREC.final + interim).trim();
      const ta = document.getElementById('addTxt'); if (ta) { ta.value = VREC.auto; ta.scrollTop = ta.scrollHeight; }
    };
    sr.onend = () => { if (VREC.sr === sr && VREC.rec) { try { sr.start(); } catch { /* already restarting */ } } }; // Chrome stops after a pause
    sr.onerror = () => {};
    try { sr.start(); VREC.sr = sr; } catch { /* recognition unavailable — audio still records */ }
  }
  S.modal.title = val('addTitle');
  modal();
}
function recStop() {
  const sr = VREC.sr; VREC.sr = null; try { sr?.stop(); } catch { /* ignore */ }
  if (VREC.rec?.state !== 'inactive') VREC.rec?.stop();
}
// Discards the current recording (and stops one in progress).
function recReset() {
  const rec = VREC.rec; VREC.rec = null;
  const sr = VREC.sr; VREC.sr = null; try { sr?.abort(); } catch { /* ignore */ }
  if (rec && rec.state !== 'inactive') rec.stop();
  clearInterval(VREC.timer);
  if (VREC.url) URL.revokeObjectURL(VREC.url);
  Object.assign(VREC, { blob: null, url: null, chunks: [], dur: 0, final: '', auto: '' });
}
const blobBase64 = (blob) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = () => no(new Error($t('Couldn’t read the recording'))); r.readAsDataURL(blob); });
async function addVoice() {
  const m = S.modal;
  if (VREC.rec) throw new Error($t('Stop the recording first'));
  if (!VREC.blob) throw new Error($t('Record a voice note first'));
  if (VREC.blob.size > MAX_AUDIO) throw new Error($t('The recording is too long (max 20 MB)'));
  const text = val('addTxt').trim();
  if (!text && !S.transcribe) throw new Error($t('No transcript yet — type the text or record again'));
  const edited = text !== (VREC.auto || '').trim(); // corrected by hand → the server keeps it instead of transcribing again
  const body = { title: val('addTitle').trim(), type: val('addType'), date: val('addDate'), mime: VREC.mime, duration: VREC.dur, lang: SR ? recLang().slice(0, 2) : undefined, edited, text, audio: await blobBase64(VREC.blob) };
  const tid = m.team || S.tid;
  if (tid !== S.tid) await switchTeam(tid);
  const it = await api('POST', T('/inbox/audio'), body);
  recReset(); S.modal = null; await reload(); go(`review-${it.id}`);
}

function modal() {
  const el = document.getElementById('modal'), m = S.modal;
  if (!m) { el.innerHTML = ''; return; }
  const close = `<button class="btn ghost sm x" data-a="closeM" aria-label="${$t('Close')}">${ico('x')}</button>`;
  const cancel = `<button class="btn" data-a="closeM">${$t('Cancel')}</button>`;
  let h = '';
  if (m.k === 'add') {
    h = `<div class="md wide"><div class="mdh"><h2>${$t('Add to inbox')}</h2>${close}</div><div class="seg" style="margin-bottom:14px">${[['paste', $t('Paste text')], ['file', $t('File')], ['note', $t('Note')], ['voice', `${ico('mic', 13)} ${$t('Dictate')}`]].map(([k, l]) => `<button class="${m.tab === k ? 'on' : ''}" data-a="addTab" data-v="${k}">${l}</button>`).join('')}</div>
    ${m.tab === 'voice' ? voicePanel(m) : m.tab === 'file' ? `<label class="card" style="display:grid;place-items:center;padding:30px;border-style:dashed;cursor:pointer;text-align:center">${ico('file', 26)}<b style="margin-top:8px">${m.fileName ? esc(m.fileName) : $t('Choose a file')}</b><span class="hint">.pdf .txt .md .vtt .srt</span>${m.pdf ? `<span class="hint">${ico('file', 12)} PDF · ${fsize(m.pdfSize)} — ${$t('AI reads the text of the document; the PDF itself is kept as the source.')}</span>` : ''}<input type="file" hidden data-f="addFile" accept=".pdf,.txt,.md,.vtt,.srt,application/pdf,text/plain,text/markdown"></label>` : `<textarea class="in" id="addTxt" rows="9" placeholder="${m.tab === 'note' ? $t('Write down a thought or an agreement — TeamOS processes it just like a transcript') : $t('Paste a meeting transcript, a chat excerpt or an email…')}">${esc(m.text || '')}</textarea>`}
    <div class="grid g2" style="margin-top:14px;gap:12px"><label class="fl">${$t('Title')}<input class="in" id="addTitle" value="${esc(m.title || '')}" placeholder="${$t('E.g. Weekly sync — 20 Nov')}"></label><label class="fl">${$t('Source type')}<select class="in" id="addType">${Object.entries(ITYPE).filter(([k]) => k !== 'routed').map(([k, l]) => `<option value="${k}" ${k === (m.tab === 'note' || m.tab === 'voice' ? 'note' : m.tab === 'file' && m.pdf ? 'doc' : m.type || 'transcript') ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="fl">${$t('Date of the meeting / email')}<input class="in" type="date" id="addDate" value="${m.date || TODAY()}"></label><label class="fl">${$t('Team context')}<select class="in" data-f="addTeam">${S.teams.map((t) => `<option value="${t.id}" ${t.id === S.tid ? 'selected' : ''}>${esc(teamName(t))}</option>`).join('')}</select></label></div>
    <p class="hint" style="margin:10px 0 0">${S.ai ? `${ico('spark', 13)} ${$t('AI will extract tasks, status updates and knowledge. Nothing is saved without your confirmation.')}` : `${ico('warn', 13)} ${$t('AI analysis is off — the item will be saved and you can add proposals manually.')}`}</p>
    <div class="mdf">${cancel}<button class="btn pri" data-a="addGo">${ico('spark')}${S.ai ? $t('Analyze') : $t('Save')}</button></div></div>`;
  } else if (m.k === 'task') {
    h = `<div class="md"><div class="mdh"><h2>${$t('New task')}</h2>${close}</div><div class="grid" style="gap:12px"><label class="fl">${$t('What to do')}<input class="in" id="ntT" placeholder="${$t('E.g. Prepare the investor report')}"></label><div class="grid g2" style="gap:12px"><label class="fl">${$t('Owner')}${selWho('class="in" id="ntO" data-f="ntWho"', m.owner || uid())}</label><label class="fl">${$t('Requester')}<select class="in" id="ntR" data-f="ntWho"><option value="${uid()}">${$t('Me')}</option>${isExt(m.requester) ? `<option value="${esc(m.requester)}" selected>${esc(m.requester.slice(4))} (${$t('ext.')})</option>` : ''}<option value="__ext">${$t('+ External contact…')}</option></select></label><label class="fl">${$t('Deadline')}<input type="date" class="in" id="ntD"></label><label class="fl">${$t('Project')}${selProj('class="in" id="ntP"', m.proj || '')}</label><label class="fl">${$t('Hypothesis')}${selHyp('class="in" id="ntH"', m.hyp || '', m.proj)}</label><label style="display:flex;gap:8px;align-items:center;padding-top:20px"><input type="checkbox" id="ntI" checked> ${$t('Important')}</label></div><label class="fl">${$t('Description')}<textarea class="in" id="ntDesc" rows="2"></textarea></label><p class="hint" style="margin:0">${$t('The requester changes the status. If the requester is external, you change it.')}</p></div><div class="mdf">${cancel}<button class="btn pri" data-a="ntGo">${$t('Create')}</button></div></div>`;
  } else if (m.k === 'project') {
    const p = m.id ? prj(m.id) : { name: '', vision: '', goals: [], members: [uid()], owner: uid() };
    h = `<div class="md wide"><div class="mdh"><h2>${m.id ? $t('Edit project') : $t('New project')}</h2>${close}</div><div class="grid" style="gap:12px"><label class="fl">${$t('Project name')}<input class="in" id="pjN" value="${esc(p.name)}"></label><label class="fl">Vision<textarea class="in" id="pjV" rows="3">${esc(p.vision || '')}</textarea></label><label class="fl">Owner${selWho('class="in" id="pjO"', p.owner, false)}</label><div class="fl">${$t('Members')}<div class="cklist" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">${S.d.members.map((x) => `<label><input type="checkbox" class="pjM" value="${x.id}" ${(p.members || []).includes(x.id) ? 'checked' : ''}>${esc(x.name)}</label>`).join('')}</div></div>
    <div class="fl">${$t('Goals (goal · metric · current · target · date)')}<div id="pjGoals">${[...(p.goals || []), { id: '', goal: '', metric: '', current: '', target: '', by: '' }].map((g) => goalRow(g)).join('')}</div><button class="btn sm" style="justify-self:start" data-a="addGoal">${ico('plus', 13)} ${$t('Another goal')}</button></div></div>
    <div class="mdf">${m.id ? `<button class="btn ghost danger" style="margin-right:auto" data-a="delProject" data-id="${m.id}">${$t('Delete')}</button>` : ''}${cancel}<button class="btn pri" data-a="pjGo">${m.id ? $t('Save') : $t('Create')}</button></div></div>`;
  } else if (m.k === 'hyp') {
    const x = m.id ? hyp(m.id) : { if: '', then: '', because: '', project: m.project, owner: uid(), metric: '', target: '', current: '', from: '', to: '', verdict: '' };
    h = `<div class="md"><div class="mdh"><h2>${m.id ? $t('Edit hypothesis') : $t('New hypothesis')}</h2>${close}</div><div class="grid" style="gap:12px"><label class="fl">${$t('If… (action)')}<input class="in" id="hyIf" value="${esc(x.if)}" placeholder="${$t('we give 100 free calls a month')}"></label><label class="fl">${$t('then… (result)')}<input class="in" id="hyThen" value="${esc(x.then)}" placeholder="${$t('≥ 30% will move to a paid plan')}"></label><label class="fl">${$t('because… (assumption)')}<input class="in" id="hyBo" value="${esc(x.because || '')}"></label>
    <div class="grid g2" style="gap:12px"><label class="fl">${$t('Project')}${selProj('class="in" id="hyP"', x.project)}</label><label class="fl">${$t('Responsible')}${isAdmin() ? selWho('class="in" id="hyO"', x.owner, false) : `<input class="in" disabled value="${esc(pn(x.owner))}">`}</label><label class="fl">${$t('Success metric')}<input class="in" id="hyM" value="${esc(x.metric || '')}"></label><label class="fl">${$t('Target')}<input class="in" id="hyT" value="${esc(x.target || '')}"></label><label class="fl">${$t('Current value')}<input class="in" id="hyC" value="${esc(x.current || '')}"></label><span></span><label class="fl">${$t('Start')}<input class="in" type="date" id="hyF" value="${x.from || ''}"></label><label class="fl">${$t('End')}<input class="in" type="date" id="hyTo" value="${x.to || ''}"></label></div>
    ${m.id ? `<label class="fl">${$t('Verdict')}<textarea class="in" id="hyV" rows="2">${esc(x.verdict || '')}</textarea></label>` : ''}</div><div class="mdf">${cancel}<button class="btn pri" data-a="hyGo">${m.id ? $t('Save') : $t('Create')}</button></div></div>`;
  } else if (m.k === 'kn') {
    const k = m.id ? S.d.knowledge.find((x) => x.id === m.id) : { type: 'decision', text: '', why: '', scope: 'team', project: '' };
    h = `<div class="md"><div class="mdh"><h2>${m.id ? $t('Edit knowledge') : $t('Add knowledge')}</h2>${close}</div><div class="grid" style="gap:12px"><label class="fl">${$t('Type')}<select class="in" id="nkT">${Object.entries(KT).map(([a, l]) => `<option value="${a}" ${a === k.type ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="fl">${$t('Text')}<textarea class="in" id="nkX" rows="3">${esc(k.text)}</textarea></label><label class="fl">${$t('Why (optional)')}<input class="in" id="nkW" value="${esc(k.why || '')}"></label><div class="grid g2" style="gap:12px">${personal() ? '' : `<label class="fl">${$t('Visibility')}<select class="in" id="nkS"><option value="team">${$t('Team')}</option><option value="private" ${k.scope === 'private' ? 'selected' : ''}>${$t('Only me')}</option></select></label>`}<label class="fl">${$t('Project')}${selProj('class="in" id="nkP"', k.project)}</label><label class="fl">${$t('Hypothesis')}${selHyp('class="in" id="nkH"', k.hypothesis)}</label></div></div><div class="mdf">${cancel}<button class="btn pri" data-a="nkGo">${$t('Save')}</button></div></div>`;
  } else if (m.k === 'taskShare') {
    h = `<div class="md" id="task-share-dialog" role="dialog" aria-modal="true" aria-labelledby="task-share-heading" tabindex="-1"><div class="mdh"><h2 id="task-share-heading">${$t('Share task')}</h2>${close}</div>${taskShareContent(m)}</div>`;
  } else if (m.k === 'invite') {
    h = `<div class="md"><div class="mdh"><h2>${$t('Invite to {team}', { team: esc(teamName(S.d.team)) })}</h2>${close}</div><label class="fl">${$t('Role')}<select class="in" id="invR"><option value="member">${$t('Member — sees their own tasks and team knowledge')}</option><option value="admin">${$t('Admin — sees everything, manages members')}</option></select></label><label class="fl" style="margin-top:12px">${$t('Email (optional — then the link works only for that address)')}<input class="in" id="invE" placeholder="name@company.com"></label><p class="hint">${$t('TeamOS doesn’t send emails in v0.1 — copy the link and send it yourself.')}</p>${m.link ? `<div class="lnkbox">${ico('link')}<code>${esc(m.link)}</code><button class="btn sm" data-a="copyText" data-v="${esc(m.link)}">${$t('Copy')}</button></div>` : ''}<div class="mdf"><button class="btn" data-a="closeM">${$t('Done')}</button><button class="btn pri" data-a="invGo">${$t('Create link')}</button></div></div>`;
  } else if (m.k === 'transfer') {
    h = `<div class="md"><div class="mdh"><h2>${$t('Transfer ownership')}</h2>${close}</div><p class="hint" style="font-size:14.5px">${$t('The new Owner gets full control, and you become an Admin.')}</p><label class="fl">${$t('To')}<select class="in" id="trTo">${S.d.members.filter((x) => x.id !== uid()).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label><label class="fl" style="margin-top:12px">${$t('Type the team name “{team}” to confirm', { team: esc(S.d.team.name) })}<input class="in" id="trC" data-f="trC" autocomplete="off"></label><div class="mdf">${cancel}<button class="btn pri" id="trBtn" data-a="trGo" disabled>${$t('Transfer')}</button></div></div>`;
  } else if (m.k === 'team') {
    h = `<div class="md"><div class="mdh"><h2>${$t('New team')}</h2>${close}</div><label class="fl">${$t('Team name')}<input class="in" id="ntmN" placeholder="${$t('E.g. Linxa Team')}"></label><p class="hint">${$t('You become the Owner. The team gets its own folder, and your folder gets a subfolder for it.')}</p><div class="mdf">${cancel}<button class="btn pri" data-a="ntmGo">${$t('Create')}</button></div></div>`;
  } else if (m.k === 'ask') {
    h = `<div class="md wide"><div style="display:flex;gap:10px;align-items:center">${ico('search', 18)}<input class="in" id="askq" data-f="askq" style="flex:1;border:0;font-size:17px" placeholder="${$t('Find a task, decision, hypothesis…')}" value="${esc(m.q || '')}" autocomplete="off"><kbd>Esc</kbd></div><div id="askr">${askRes(m.q || '')}</div></div>`;
  }
  el.innerHTML = `<div class="ov" data-a="ovClose">${h}</div>`;
  const f = el.querySelector('#askq,#addTxt,#ntT,#ntmN,#nkX,#pjN,#hyIf'); if (f && !m.focused) { m.focused = true; setTimeout(() => f.focus(), 20); }
}
const goalRow = (g) => `<div class="goal-row" data-goal="${esc(g.id || '')}"><input class="in" placeholder="${$t('Goal')}" value="${esc(g.goal)}"><input class="in" placeholder="${$t('Metric')}" value="${esc(g.metric)}"><input class="in" placeholder="${$t('Current')}" value="${esc(g.current)}"><input class="in" placeholder="${$t('Target')}" value="${esc(g.target)}"><input class="in" type="date" value="${g.by || ''}"><button class="btn ghost sm" data-a="rmGoal" title="${$t('Remove')}">${ico('x', 13)}</button></div>`;
function askRes(q) {
  q = q.trim().toLowerCase();
  if (!q) return `<div class="res"><div class="hint" style="padding:8px">${$t('Search tasks, knowledge, hypotheses and projects')}</div></div>`;
  const ts = tasks().filter((t) => t.title.toLowerCase().includes(q) || pnx(t.owner).toLowerCase().includes(q)).slice(0, 8);
  const ks = S.d.knowledge.filter((k) => !k.supersededBy && (k.text + ' ' + (k.why || '')).toLowerCase().includes(q)).slice(0, 6);
  const hs = S.d.hypotheses.filter((h) => (h.statement || '').toLowerCase().includes(q)).slice(0, 4);
  const ps = S.d.projects.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 4);
  return `<div class="res">${ps.map((p) => `<button class="trow" data-a="go" data-h="project-${p.id}"><span class="dot" style="--c:${p.color}"></span><span class="tt"><b>${esc(p.name)}</b></span></button>`).join('')}${ts.map(trow).join('')}${hs.map((h) => `<button class="trow" data-a="go" data-h="hyp-${h.id}"><span class="chip">${hcode(h.id)}</span><span class="tt"><b>${stmtHtml(h)}</b></span></button>`).join('')}${ks.map((k) => `<div class="trow" style="cursor:default"><span class="ty ${k.type}">${KT[k.type]}</span><span class="tt"><b>${esc(k.text)}</b></span></div>`).join('')}${!ts.length && !ks.length && !hs.length && !ps.length ? `<div class="hint" style="padding:8px">${$t('Nothing found')}</div>` : ''}</div>`;
}

/* ---------- render ---------- */
function render() {
  const r = R(); const keep = {}; document.querySelectorAll('[data-keep]').forEach((e) => (keep[e.dataset.keep] = e.scrollTop)); const sy = scrollY;
  const app = document.getElementById('app');
  const isLogin = !S.me || r === 'login';
  const existingAccess = isLogin && document.documentElement.lang === LANG && app.querySelector('#login-access');
  let c;
  if (existingAccess) existingAccess.innerHTML = loginAccess();
  else if (isLogin) c = pLogin();
  else if (r.startsWith('join-')) c = pJoin();
  else if (r === 'onboarding' || !S.d) c = pOnboarding();
  else {
    const pg = r === 'assistant' ? pAssistant() : r === 'dashboard' ? pDashboard() : r === 'inbox' ? pInbox() : r.startsWith('review-') ? pReview() : r === 'tasks' ? pTasks() : r === 'knowledge' ? pKnowledge() : r.startsWith('knowledge-') ? pKnowledge(r.slice(10)) : r.startsWith('source-') ? pSource(r.slice(7)) : r === 'vision' ? pVision() : r.startsWith('project-') ? pProject(r.slice(8)) : r.startsWith('hyp-') ? pHyp(r.slice(4)) : r.startsWith('person-') ? pPerson(r.slice(7)) : r === 'members' ? pMembers() : r === 'profile' ? pProfile() : r === 'roadmap' ? pRoadmap() : pDashboard();
    c = `<div class="app${S.navOpen ? ' nav-open' : ''}"><aside class="side" id="side-nav">${nav()}</aside><div class="scrim" data-a="navClose" aria-hidden="true"></div><main class="main"><header class="top">${top()}</header><div class="page page-${r.split('-')[0] || 'dashboard'}${r === 'assistant' ? ' assistant-page' : ''}">${pg}</div></main>${tabbar()}</div>`;
  }
  document.documentElement.lang = LANG;
  document.title = isLogin ? $t('TeamOS — Sign in') : 'TeamOS';
  if (!existingAccess) app.innerHTML = c;
  document.querySelectorAll('[data-keep]').forEach((e) => { if (keep[e.dataset.keep]) e.scrollTop = keep[e.dataset.keep]; }); scrollTo(0, sy);
  drawer(); modal();
}
let tt; const toast = (m) => { const e = document.getElementById('toast'); e.textContent = m; e.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => e.classList.remove('on'), 3200); };
const prop = (id) => S.review?.props.find((p) => p.id === id);
const val = (id) => document.getElementById(id)?.value ?? '';
const go = (h) => { if (location.hash.slice(1) === h) render(); else location.hash = h; };
function askExternal(sel, prev) {
  const n = prompt($t('Name of the external contact (client, partner):'));
  if (!n || !n.trim()) { sel.value = prev || uid(); return null; }
  return `ext:${n.trim()}`;
}
async function patchTask(id, body, okMsg) {
  return act(async () => { const t = await api('PATCH', T(`/tasks/${id}`), body); const i = S.d.tasks.findIndex((x) => x.id === id); if (i >= 0) S.d.tasks[i] = t; render(); return t; }, okMsg);
}
async function switchTeam(id) { S.tid = id; S.drawer = null; S.review = null; S.applied = null; S.person = ''; S.proj = ''; S.kproj = ''; await reload(); }

/* ---------- actions ---------- */
const A = {
  navOpen: () => { S.navOpen = true; render(); },
  navClose: () => { S.navOpen = false; S.tmenu = false; render(); },
  go: (el) => { S.tmenu = false; S.navOpen = false; S.modal = null; if (el.dataset.h.startsWith('project-')) S.ptab = 'overview'; if (el.dataset.h.startsWith('source-')) S.srcView = null; go(el.dataset.h); },
  lang: (el) => { void setLang(el.dataset.v); },
  tmenu: () => { S.tmenu = !S.tmenu; render(); },
  team: (el) => { S.tmenu = false; act(() => switchTeam(el.dataset.v)); },
  newTeam: () => { S.tmenu = false; S.modal = { k: 'team' }; render(); },
  ntmGo: () => act(async () => { const name = val('ntmN').trim(); if (!name) throw new Error($t('Enter a name')); const t = await api('POST', '/api/teams', { name }); S.modal = null; await reloadMe(); await switchTeam(t.id); go('dashboard'); }, () => $t('Team created')),
  logout: () => act(async () => { await api('POST', '/auth/logout'); S.me = null; S.d = null; S.assistant.clear(); location.hash = 'login'; render(); }),
  emailAgain: () => { S.loginSent = false; S.loginError = ''; render(); document.querySelector('#email-login input')?.focus(); },
  devLogin: () => act(async () => { await api('POST', '/auth/dev', { email: val('devEmail'), name: val('devName') }); await boot(); }),
  obMode: (el) => { S.obMode = el.dataset.v; render(); },
  obGo: () => act(async () => {
    if (S.obMode === 'personal') { S.tid = S.teams.find((t) => t.kind === 'personal')?.id; }
    else { const name = val('obName').trim(); if (!name) throw new Error($t('Enter a team name')); const t = await api('POST', '/api/teams', { name }); await reloadMe(); S.tid = t.id; }
    await reload(); go('dashboard');
  }),
  joinGo: () => act(async () => { const r = await api('POST', `/api/invites/${encodeURIComponent(S.join.token)}/accept`); S.pendingJoin = null; await reloadMe(); await switchTeam(r.teamId); go('dashboard'); }, () => $t('Welcome to the team')),
  joinSkip: async () => { S.pendingJoin = null; await reloadMe(); if (!S.tid) S.tid = S.teams[0]?.id; await reload(); go('dashboard'); },
  open: (el) => { S.drawer = el.dataset.id; S.modal = null; const t = tasks().find((x) => x.id === S.drawer); if (t?.unread) { t.unread = 0; api('POST', T(`/tasks/${t.id}/read`)).catch(() => {}); } render(); },
  closeD: () => { S.drawer = null; render(); },
  dash: (el) => { S.dash = el.dataset.v; render(); },
  tasksTab: (el) => { S.tab = el.dataset.v; go('tasks'); },
  grp: (el) => { S.grp = el.dataset.v; render(); },
  itab: (el) => { S.itab = el.dataset.v; render(); },
  ptab: (el) => { S.ptab = el.dataset.v; render(); },
  knt: (el) => { S.knt = el.dataset.v; S.klog = false; S.ksrc = false; render(); },
  klog: () => { S.klog = !S.klog; S.ksrc = false; render(); },
  ksrc: () => { S.ksrc = !S.ksrc; S.klog = false; render(); },
  delSrc: (el) => { if (!confirm($t('Delete the source together with its text and file? Tasks and knowledge created from it will stay.'))) return; act(async () => { await api('DELETE', T(`/sources/${el.dataset.id}`)); S.srcView = null; await reload(); go('knowledge'); }, () => $t('Deleted')); },
  srcScope: (el) => { S.review.sourceScope = el.dataset.v; S.review.dirty = true; render(); },
  ask: () => { S.modal = { k: 'ask', q: '' }; modal(); },
  assistantNew: () => {
    const state = assistantState();
    Object.assign(state, { selected: null, chat: null, draft: '', error: '', retry: null });
    S.drawer = null; render(); document.getElementById('assistant-question')?.focus();
  },
  assistantChat: (el) => { S.drawer = null; void openAssistantChat(S.tid, assistantState(), el.dataset.id); },
  assistantReload: () => { void loadAssistantChats(S.tid, assistantState()); },
  assistantPrompt: (el) => {
    if (!S.ai) return;
    assistantState().draft = el.dataset.question;
    const field = document.getElementById('assistant-question');
    field.value = el.dataset.question; field.focus();
  },
  assistantSource: (el) => {
    const { kind, id } = el.dataset;
    if (kind === 'task') {
      if (!tasks().some((t) => t.id === id)) return toast($t('This task is not available.'));
      return A.open(el);
    }
    S.drawer = null;
    if (kind === 'knowledge') return go('knowledge-' + id);
    if (kind === 'source') return go('source-' + id);
    if (kind === 'inbox') return go('review-' + id);
    if (kind === 'goal') { S.ptab = 'overview'; return go('project-' + id); }
    if (kind === 'hypothesis') go('hyp-' + id);
  },
  closeM: () => { recReset(); S.modal = null; modal(); },
  ovClose: (el, e) => { if (e.target === el) { S.modal = null; modal(); } },
  copyText: (el) => { navigator.clipboard?.writeText(el.dataset.v).then(() => toast($t('Copied')), () => toast($t('Couldn’t copy'))); },
  copyInv: (el) => { navigator.clipboard?.writeText(`${location.origin}/join/${el.dataset.v}`).then(() => toast($t('Link copied')), () => toast($t('Couldn’t copy'))); },

  /* inbox */
  add: () => { if (!S.d) return; S.modal = { k: 'add', tab: 'paste' }; modal(); },
  recStart: () => act(recStart), recStop: () => recStop(), recReset: () => { recReset(); S.modal.text = ''; modal(); },
  addTab: (el) => { if (VREC.rec) recStop(); const t = document.getElementById('addTxt'); if (t) S.modal.text = t.value; S.modal.title = val('addTitle'); S.modal.tab = el.dataset.v; modal(); },
  addGo: () => act(async () => {
    if (S.modal.tab === 'voice') return addVoice();
    const m = S.modal; const pdf = m.tab === 'file' && m.pdf; const text = m.tab === 'file' ? m.fileText : val('addTxt');
    if (!pdf && (!text || !text.trim())) throw new Error(m.tab === 'file' ? $t('Choose a file') : $t('Paste some text'));
    const body = { title: val('addTitle').trim(), type: val('addType'), date: val('addDate'), origin: m.tab === 'file' ? `${pdf ? 'PDF' : $t('File')} · ${m.fileName}` : m.tab === 'note' ? $t('Note') : $t('Pasted text'), ...(pdf ? { file: { name: m.fileName, data: m.pdf } } : { text }) };
    const tid = m.team || S.tid;
    if (tid !== S.tid) await switchTeam(tid);
    const it = await api('POST', T('/inbox'), body);
    S.modal = null; await reload(); go(`review-${it.id}`);
  }, () => (S.ai ? $t('Analyzing… usually 20–60 seconds') : $t('Saved to the inbox'))),
  reanalyze: () => act(async () => { await api('POST', T(`/inbox/${S.review.item.id}/reanalyze`)); S.review = null; await reload(); }, () => $t('Analyzing again…')),
  ignoreItem: () => act(async () => { const it = await api('POST', T(`/inbox/${S.review.item.id}/ignore`)); S.review = null; await reload(); go(it.status === 'ignored' ? 'inbox' : `review-${it.id}`); }),
  delItem: () => { if (!confirm($t('Delete the inbox item together with its raw text? Tasks and knowledge already saved will stay.'))) return; act(async () => { await api('DELETE', T(`/inbox/${S.review.item.id}`)); S.review = null; await reload(); go('inbox'); }, () => $t('Item deleted')); },
  pset: (el) => { const p = prop(el.dataset.p); const v = el.dataset.v; p[el.dataset.k] = v === '1' ? true : v === '0' ? false : v; S.review.dirty = true; render(); },
  addProp: (el) => { const k = el.dataset.v; const base = { id: 'pr_m' + Date.now().toString(36), kind: k, on: true, manual: true, quote: '', conf: 'high' }; S.review.props.push(k === 'task' ? { ...base, title: '', owner: uid(), requester: uid(), due: null, project: null, hypothesis: null, important: true } : k === 'kn' ? { ...base, type: 'decision', text: '', why: '', scope: personal() ? 'private' : 'team', project: null } : { ...base, if: '', then: '', because: '', project: S.d.projects[0]?.id || null, owner: uid(), metric: '' }); S.review.dirty = true; render(); },
  delProp: (el) => { S.review.props = S.review.props.filter((p) => p.id !== el.dataset.p); S.review.dirty = true; render(); },
  saveDraft: () => act(async () => { await api('PATCH', T(`/inbox/${S.review.item.id}`), { proposals: S.review.props, sourceScope: S.review.sourceScope }); S.review.dirty = false; }, () => $t('Draft saved')),
  apply: () => applyReview(),

  /* tasks */
  newTask: (el) => { S.modal = { k: 'task', proj: el?.dataset?.proj || '', hyp: el?.dataset?.hyp || '' }; S.drawer = null; render(); },
  shareTask: () => {
    S.modal = { k: 'taskShare', url: T(`/tasks/${S.drawer}/share`) };
    void requestTaskShare(S.modal, 'GET');
  },
  retryTaskShare: () => { void requestTaskShare(S.modal, 'GET'); },
  replaceTaskShare: () => { void requestTaskShare(S.modal, 'POST'); },
  disableTaskShare: () => { void requestTaskShare(S.modal, 'DELETE'); },
  copyTaskShare: async () => {
    const link = document.getElementById('task-share-link');
    if (!link) return;
    try { await navigator.clipboard.writeText(link.value); toast($t('Link copied')); }
    catch { link.focus(); link.select(); toast($t('Couldn’t copy')); }
  },
  ntGo: () => act(async () => {
    const t = await api('POST', T('/tasks'), { title: val('ntT'), owner: val('ntO'), requester: val('ntR'), due: val('ntD') || null, project: val('ntP') || null, hypothesis: val('ntH') || null, important: document.getElementById('ntI').checked, description: val('ntDesc') });
    S.modal = null; S.d.tasks.unshift(t); render(); return t;
  }, (t) => (t.owner === uid() ? $t('Task created') : $t('Task assigned: {name} will see it in “{section}”', { name: pnx(t.owner), section: TASK_SECTION_NAMES.mine }))),
  delTask: () => { if (!confirm($t('Delete the task? This can’t be undone.'))) return; act(async () => { await api('DELETE', T(`/tasks/${S.drawer}`)); S.d.tasks = S.d.tasks.filter((x) => x.id !== S.drawer); S.drawer = null; render(); }, () => $t('Task deleted')); },
  comment: () => { const c = val('cmt').trim(); if (!c) return; const t = tasks().find((x) => x.id === S.drawer); act(async () => { const r = await api('POST', T(`/tasks/${t.id}/comments`), { text: c }); Object.assign(t, r); render(); }, t.canEdit ? $t('Comment added') : $t('{name} will see the comment on their dashboard', { name: pnx(t.controller) })); },

  /* knowledge */
  newKn: () => { S.modal = { k: 'kn' }; modal(); },
  editKn: (el) => { S.modal = { k: 'kn', id: el.dataset.id }; modal(); },
  nkGo: () => act(async () => { const body = { type: val('nkT'), text: val('nkX'), why: val('nkW'), scope: val('nkS') || 'private', project: val('nkP') || null, hypothesis: val('nkH') || null }; if (S.modal.id) await api('PATCH', T(`/knowledge/${S.modal.id}`), body); else await api('POST', T('/knowledge'), body); S.modal = null; await reload(); }, () => $t('Saved')),
  delKn: (el) => { if (!confirm($t('Delete the knowledge entry?'))) return; act(async () => { await api('DELETE', T(`/knowledge/${el.dataset.id}`)); await reload(); }, () => $t('Deleted')); },

  /* vision */
  vEdit: () => { S.vEdit = true; render(); },
  vCancel: () => { S.vEdit = false; render(); },
  vSave: () => act(async () => { const markdown = val('vText'); await api('PUT', T('/vision'), { markdown }); S.d.vision = markdown; S.vEdit = false; render(); }, () => $t('Vision saved')),

  /* projects & hypotheses */
  newProject: () => { S.modal = { k: 'project' }; render(); },
  editProject: (el) => { S.modal = { k: 'project', id: el.dataset.id }; modal(); },
  addGoal: () => { document.getElementById('pjGoals').insertAdjacentHTML('beforeend', goalRow({ id: '', goal: '', metric: '', current: '', target: '', by: '' })); },
  rmGoal: (el) => el.closest('.goal-row').remove(),
  pjGo: () => act(async () => {
    const goals = [...document.querySelectorAll('#pjGoals .goal-row')].map((r) => { const [g, m, c, t, b] = r.querySelectorAll('input'); return { id: r.dataset.goal || undefined, goal: g.value, metric: m.value, current: c.value, target: t.value, by: b.value || null }; }).filter((g) => g.goal.trim());
    const body = { name: val('pjN'), vision: val('pjV'), owner: val('pjO'), members: [...document.querySelectorAll('.pjM:checked')].map((x) => x.value), goals };
    const p = S.modal.id ? await api('PATCH', T(`/projects/${S.modal.id}`), body) : await api('POST', T('/projects'), body);
    S.modal = null; await reload(); go(`project-${p.id}`);
  }, () => $t('Project saved')),
  delProject: (el) => { if (!confirm($t('Delete the project? Its tasks will stay, without a project.'))) return; act(async () => { await api('DELETE', T(`/projects/${el.dataset.id}`)); S.modal = null; await reload(); go('dashboard'); }, () => $t('Project deleted')); },
  newHyp: (el) => { S.modal = { k: 'hyp', project: el.dataset.id }; modal(); },
  editHyp: (el) => { S.modal = { k: 'hyp', id: el.dataset.id }; modal(); },
  hyGo: () => act(async () => {
    const body = { if: val('hyIf'), then: val('hyThen'), because: val('hyBo'), project: val('hyP'), metric: val('hyM'), target: val('hyT'), current: val('hyC'), from: val('hyF') || null, to: val('hyTo') || null };
    if (document.getElementById('hyO')) body.owner = val('hyO');
    if (document.getElementById('hyV')) body.verdict = val('hyV');
    const h = S.modal.id ? await api('PATCH', T(`/hypotheses/${S.modal.id}`), body) : await api('POST', T('/hypotheses'), body);
    S.modal = null; await reload(); go(`hyp-${h.id}`);
  }, () => $t('Hypothesis saved')),
  delHyp: (el) => { if (!confirm($t('Delete the hypothesis?'))) return; const h = hyp(el.dataset.id); act(async () => { await api('DELETE', T(`/hypotheses/${el.dataset.id}`)); await reload(); go(`project-${h.project}`); }, () => $t('Hypothesis deleted')); },
  addLearn: (el) => act(async () => { const text = val('learnTxt').trim(); if (!text) throw new Error($t('Write a learning')); await api('POST', T(`/hypotheses/${el.dataset.id}/learnings`), { text }); await reload(); }, () => $t('Learning added')),

  /* members */
  invite: () => { S.modal = { k: 'invite' }; modal(); },
  invGo: () => act(async () => { const inv = await api('POST', T('/invites'), { role: val('invR'), email: val('invE') }); S.d = await api('GET', T('/state')); S.modal.link = `${location.origin}/join/${inv.token}`; render(); }, () => $t('Link created')),
  revokeInv: (el) => act(async () => { await api('DELETE', T(`/invites/${encodeURIComponent(el.dataset.v)}`)); await reload(); }, () => $t('Invite revoked')),
  removeMember: (el) => { const self = el.dataset.id === uid(); if (!confirm(self ? $t('Leave the team?') : $t('Remove {name} from the team?', { name: pn(el.dataset.id) }))) return; act(async () => { await api('DELETE', T(`/members/${el.dataset.id}`)); if (self) { await reloadMe(); await switchTeam(S.teams[0].id); go('dashboard'); } else await reload(); }, () => (self ? $t('You left the team') : $t('Member removed'))); },
  transfer: () => { S.modal = { k: 'transfer' }; modal(); },
  trGo: () => act(async () => { await api('POST', T('/transfer'), { userId: val('trTo'), confirm: val('trC').trim() }); S.modal = null; await reloadMe(); await reload(); }, () => $t('Ownership transferred. You are now an Admin.')),

  /* profile */
  saveProfile: () => act(async () => { S.me = await api('PATCH', '/api/me', { name: val('pfName'), aliases: val('pfAliases').split(',').map((s) => s.trim()).filter(Boolean) }); await reload(); }, () => $t('Profile saved')),
  saveTeam: () => act(async () => { const body = { urgentDays: Number(val('tmUrg')) }; if (role() === 'owner') body.name = val('tmName'); await api('PATCH', T(''), body); await reloadMe(); await reload(); }, () => $t('Settings saved')),
};

async function applyReview() {
  const r = S.review; if (!r || r.item.status === 'done') return;
  const sel = r.props.filter((p) => p.on);
  if (!sel.length) return toast($t('Nothing selected'));
  const bad = sel.find((p) => (p.kind === 'task' && !p.title?.trim()) || (p.kind === 'kn' && !p.text?.trim()) || (p.kind === 'hyp' && (!p.if?.trim() || !p.then?.trim())));
  if (bad) return toast($t('Fill in the empty cards or uncheck them'));
  await act(async () => {
    const res = await api('POST', T(`/inbox/${r.item.id}/apply`), { proposals: r.props, sourceScope: r.sourceScope });
    S.applied = { id: r.item.id, ...res }; scrollTo(0, 0); await reload();
  });
}

const F = {
  dir: (el) => { S.dir = el.value; render(); }, fperson: (el) => { S.person = el.value; render(); }, fproj: (el) => { S.proj = el.value; render(); }, fst: (el) => { S.fst = el.value; render(); },
  kscope: (el) => { S.kscope = el.value; render(); }, kproj: (el) => { S.kproj = el.value; render(); },
  addTeam: (el) => { S.modal.team = el.value; },
  recLang: (el) => { VREC.lang = el.value; try { localStorage.setItem('teamos.recLang', el.value); } catch { /* per-browser convenience only */ } },
  addFile: (el) => {
    const f = el.files[0]; if (!f) return;
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    if (isPdf ? f.size > 20 * 1048576 : f.size > 2e6) { toast(isPdf ? $t('The file is too large (max 20 MB)') : $t('The file is too large (max 2 MB)')); return; }
    const rd = new FileReader();
    if (isPdf) {
      rd.onload = () => { Object.assign(S.modal, { pdf: String(rd.result).split(',')[1] || '', pdfSize: f.size, fileText: null, fileName: f.name, title: val('addTitle') || f.name.replace(/\.[^.]+$/, '') }); modal(); document.getElementById('addTitle').value = S.modal.title; };
      return rd.readAsDataURL(f);
    }
    rd.onload = () => { S.modal.pdf = null; S.modal.fileText = String(rd.result); S.modal.fileName = f.name; S.modal.title = val('addTitle') || f.name.replace(/\.[^.]+$/, ''); modal(); document.getElementById('addTitle').value = S.modal.title; };
    rd.readAsText(f);
  },
  ntWho: (el) => { if (el.value === '__ext') { const v = askExternal(el, uid()); if (v) { el.insertAdjacentHTML('afterbegin', `<option value="${esc(v)}">${esc(v.slice(4))} (${$t('ext.')})</option>`); el.value = v; } } },
  'p.on': (el) => { prop(el.dataset.p).on = el.checked; S.review.dirty = true; render(); },
  'p.important': (el) => { prop(el.dataset.p).important = el.checked; S.review.dirty = true; },
  pst: (el) => act(async () => { await api('PATCH', T(`/projects/${el.dataset.id}`), { status: el.value }); await reload(); }, () => $t('Project status changed')),
  hst: (el) => act(async () => { await api('PATCH', T(`/hypotheses/${el.dataset.id}`), { status: el.value }); await reload(); }, () => $t('Hypothesis status: {status}', { status: HST[el.value] })),
  role: (el) => act(async () => { await api('PATCH', T(`/members/${el.dataset.id}`), { role: el.value }); await reload(); }, () => $t('Role changed')),
};
// Proposal fields: data-f="p.<field>"
function onPropField(el) {
  const p = prop(el.dataset.p); if (!p) return;
  const k = el.dataset.f.slice(2);
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if ((k === 'owner' || k === 'requester') && v === '__ext') { v = askExternal(el, p[k]); if (!v) return; }
  if (['project', 'hypothesis', 'due'].includes(k)) v = v || null;
  p[k] = v; S.review.dirty = true;
  if (k === 'project' && p.hypothesis && hyp(p.hypothesis)?.project !== v) p.hypothesis = null;
  if (['owner', 'requester', 'project', 'hypothesis', 'to', 'type'].includes(k)) render();
}
// Task drawer fields: data-f="t.<field>"
function onTaskField(el) {
  const t = tasks().find((x) => x.id === S.drawer); if (!t) return;
  const k = el.dataset.f.slice(2);
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (k === 'owner' && v === '__ext') { v = askExternal(el, t.owner); if (!v) return; }
  if (['project', 'hypothesis', 'due'].includes(k)) v = v || null;
  if (v === t[k]) return;
  patchTask(t.id, { [k]: v }, k === 'status' ? $t('Status: {status}', { status: STL[v] }) : k === 'owner' ? $t('{name} will get the task', { name: pnx(v) }) : null);
}

document.addEventListener('click', (e) => { const el = e.target.closest('[data-a]'); if (!el) return; if (el.tagName === 'INPUT' && el.type !== 'button') return; const a = el.dataset.a; if (a === 'ovClose' && e.target !== el) return; if (A[a]) { e.preventDefault(); A[a](el, e); } });
document.addEventListener('change', (e) => { const f = e.target.dataset?.f; if (!f) return; if (f.startsWith('p.')) return onPropField(e.target); if (f.startsWith('t.')) return onTaskField(e.target); if (F[f]) F[f](e.target); });
document.addEventListener('input', (e) => { const f = e.target.dataset?.f; if (f === 'askq') { S.modal.q = e.target.value; document.getElementById('askr').innerHTML = askRes(e.target.value); } if (f === 'trC') document.getElementById('trBtn').disabled = e.target.value.trim() !== S.d.team.name; if (f && f.startsWith('p.') && e.target.tagName !== 'SELECT' && e.target.type !== 'checkbox' && e.target.type !== 'date') { const p = prop(e.target.dataset.p); if (p) { p[f.slice(2)] = e.target.value; S.review.dirty = true; } } });
document.addEventListener('mouseover', (e) => {
  const p = e.target.closest('.prop'); document.querySelectorAll('.ln.hl').forEach((x) => x.classList.remove('hl'));
  if (!p || !p.dataset.ev) return; const ids = p.dataset.ev.split(',').filter(Boolean);
  ids.forEach((id) => document.getElementById('ln-' + id)?.classList.add('hl'));
  const f = document.getElementById('ln-' + ids[0]), box = f && f.closest('.src');
  if (f && box && box.scrollHeight > box.clientHeight) { const r = f.offsetTop - box.offsetTop; if (r < box.scrollTop || r > box.scrollTop + box.clientHeight - 40) box.scrollTo({ top: r - 60, behavior: 'smooth' }); }
});
document.addEventListener('submit', async (e) => {
  if (e.target.id === 'assistant-form') {
    e.preventDefault();
    assistantState().draft = new FormData(e.target).get('question') || '';
    return sendAssistantQuestion();
  }
  if (e.target.id !== 'email-login') return;
  e.preventDefault();
  if (S.loginBusy) return;
  S.loginEmail = new FormData(e.target).get('email').trim();
  S.loginError = '';
  S.loginBusy = true;
  render();
  try {
    await api('POST', '/auth/link/request', { email: S.loginEmail, returnTo: S.pendingJoin ? `/#join-${S.pendingJoin}` : '/' });
    S.loginSent = true;
  } catch (error) { S.loginError = error instanceof TypeError ? $t('Could not reach TeamOS. Please try again.') : error.message; }
  finally { S.loginBusy = false; render(); }
});
document.addEventListener('dragstart', (e) => { const c = e.target.closest && e.target.closest('[data-drag]'); if (c) { e.dataTransfer.setData('text/plain', c.dataset.drag); c.classList.add('dragging'); } });
document.addEventListener('dragend', () => document.querySelectorAll('.dragging,.over').forEach((x) => x.classList.remove('dragging', 'over')));
document.addEventListener('dragover', (e) => { const z = e.target.closest && e.target.closest('[data-drop]'); if (z) { e.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', (e) => { const z = e.target.closest && e.target.closest('[data-drop]'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('over'); });
document.addEventListener('drop', (e) => {
  const z = e.target.closest && e.target.closest('[data-drop]'); if (!z) return; e.preventDefault(); z.classList.remove('over');
  const t = tasks().find((x) => x.id === e.dataTransfer.getData('text/plain')); if (!t) return;
  if (!t.canEdit) return toast($t('Only the requester can change this — {name}', { name: pnx(t.controller) }));
  const [k, v] = z.dataset.drop.split(':');
  if (k === 'q') patchTask(t.id, { urgent: v[0] === '1', important: v[1] === '1' });
  else if (t.status !== v) patchTask(t.id, { status: v }, $t('Status: {status}', { status: STL[v] }));
});
document.addEventListener('keydown', (e) => {
  if (e.target.id === 'assistant-question' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    if (!e.target.form.querySelector('button').disabled) e.target.form.requestSubmit();
    return;
  }
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
  if (!S.d) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); A.ask(); }
  else if (e.key === 'Escape') { if (S.navOpen) { S.navOpen = false; render(); } else if (S.modal) { recReset(); S.modal = null; modal(); } else if (S.drawer) { S.drawer = null; render(); } }
  else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && R().startsWith('review-') && !S.modal) { e.preventDefault(); applyReview(); }
  else if (!typing && !S.modal && !e.metaKey && !e.ctrlKey && ['i', 'I', 'ш', 'Ш'].includes(e.key)) { e.preventDefault(); A.add(); }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'assistant-question') assistantState().draft = e.target.value;
});
window.addEventListener('hashchange', () => {
  S.tmenu = false; S.navOpen = false;
  const r = R();
  if (!r.startsWith('review-')) { S.review = null; S.applied = null; }
  if (r !== 'vision') S.vEdit = false;
  render();
});
// Pick up changes made by teammates: refresh when the tab regains focus and every 30 s while visible.
let lastSync = 0;
async function backgroundSync() {
  if (!S.d || S.busy || S.modal || S.review?.dirty || S.vEdit || document.hidden || Date.now() - lastSync < 5000) return;
  if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  lastSync = Date.now();
  try { S.d = await api('GET', T('/state')); render(); schedulePoll(); } catch { /* next time */ }
}
window.addEventListener('focus', backgroundSync);
document.addEventListener('visibilitychange', backgroundSync);
setInterval(backgroundSync, 30000);
boot().catch((e) => { document.getElementById('app').innerHTML = `<div class="empty">${$t('Could not load TeamOS.')} ${esc(e.message)}</div>`; });
})();
