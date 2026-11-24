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
const I = { dash: 'M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z', inbox: 'M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z', tasks: 'M4 4h16v16H4zM8 12l3 3 5-6', kn: 'M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4zM5 16a4 4 0 0 1 4-4h10', vision: 'M12 3l9 9-9 9-9-9z', users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 20a5 5 0 0 0-4-5', gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12h3M2 12h3M12 2v3M12 19v3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2', search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5', plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18', menu: 'M4 6h16M4 12h16M4 18h16', lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4', file: 'M6 3h9l4 4v14H6zM14 3v5h5', chat: 'M4 5h16v11H9l-5 4z', warn: 'M12 3l10 18H2zM12 10v5M12 18v.5', mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3', note: 'M5 3h14v18H5zM9 8h6M9 12h6M9 16h3', arrow: 'M5 12h14M13 6l6 6-6 6', back: 'M19 12H5M11 6l-6 6 6 6', chev: 'M6 9l6 6 6-6', cmt: 'M4 5h16v11H9l-5 4z', route: 'M5 12h14M13 6l6 6-6 6', spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6', mail: 'M3 6h18v12H3zM3 6l9 7 9-7', drive: 'M8 3h8l6 11-4 7H6l-4-7z', out: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0', link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1', target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01', tree: 'M5 3v18M5 8h8M5 16h8M13 6h7v4h-7zM13 14h7v4h-7z', check: 'M5 12l5 5L20 7', org: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1', chart: 'M4 20V4M4 20h16M8 16l4-5 3 3 5-7', proc: 'M4 6h4v4H4zM16 6h4v4h-4zM10 15h4v4h-4zM8 8h8M6 10v3h6M18 10v3h-6', agr: 'M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h4M4 8v12a1 1 0 0 0 1 1h1', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4', quote: 'M7 7h4v4c0 3-2 5-4 6M14 7h4v4c0 3-2 5-4 6', bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0', edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4' };
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
const SRCKIND = translated({ pdf: 'PDF', transcript: 'Transcript', doc: 'Document', voice: 'Voice note', note: 'Note', email: 'Email', chat: 'Chat' });
const srcIco = (k) => (k === 'pdf' ? 'file' : k === 'transcript' || k === 'voice' ? 'mic' : 'drive');
const keepsSource = (i) => ['transcript', 'doc', 'note', 'email', 'chat'].includes(i.type);
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
  tmenu: false, tab: 'matrix', dir: 'mine', taskDirs: { matrix: 'mine', kanban: 'mine', list: 'all' }, person: '', proj: '', fst: 'all', grp: 'person', dash: 'all', itab: 'review',
  knt: 'all', kscope: 'all', kproj: '', klog: false, ptab: 'overview', vEdit: false,
  review: null, applied: null, drawer: null, modal: null, pendingJoin: null, busy: false,
  orgs: [], period: null, gtab: 'okr', goal: null, hview: 'cards', hsort: 'score', ckAll: false, ckc: {},
  plvl: 'all', agf: 'all', dtab: {}, dsel: {}, pver: null, advBusy: null, draftBusy: null, genFrom: null,
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
const stmtText = (h) => h.if && h.then ? `${$t('If')} ${h.if}, ${$t('then')} ${h.then}${h.because ? `, ${$t('because')} ${h.because}` : ''}` : h.statement || h.then || h.if || '';
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
  if (!res.ok) throw new Error(me.error || $t('Error {status}', { status: res.status }));
  if (!me.user || !Array.isArray(me.teams)) throw new Error($t('Could not load TeamOS.'));
  Object.assign(S, { me: me.user, teams: me.teams, orgs: me.orgs || [], ai: me.ai, transcribe: me.transcribe });
  if (S.me.lang !== LANG) api('PATCH', '/api/me', { lang: LANG }).then((u) => { S.me = u; }).catch(() => {});
  if (S.pendingJoin) { location.hash = 'join-' + S.pendingJoin; return render(); }
  const last = (() => { try { return localStorage.getItem('teamos.team'); } catch { return null; } })();
  const real = S.teams.filter((t) => t.kind !== 'personal');
  S.tid = S.teams.find((t) => t.id === last)?.id || real[0]?.id || S.teams[0]?.id;
  if (!real.length && !last) { location.hash = 'onboarding'; return render(); }
  await reload();
  if (['login', 'onboarding'].includes(R())) location.hash = 'dashboard';
}
async function reloadMe() { const me = await api('GET', '/api/me'); Object.assign(S, { me: me.user, teams: me.teams, orgs: me.orgs || [], ai: me.ai, transcribe: me.transcribe }); }
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
  ${S.tmenu ? teamMenu() : ''}
  <button class="srch" data-a="ask">${ico('search', 15)}<span class="lbl">${$t('Search')}</span><kbd>⌘K</kbd></button>
  <button class="nv ${on('dashboard')}" data-a="go" data-h="dashboard">${ico('dash')}<span class="lbl">${$t('Dashboard')}</span></button>
  <button class="nv ${on('inbox') || on('review')}" data-a="go" data-h="inbox">${ico('inbox')}<span class="lbl">${$t('Inbox')}</span>${ib ? `<span class="bd">${ib}</span>` : ''}</button>
  <button class="nv ${on('tasks')}" data-a="go" data-h="tasks">${ico('tasks')}<span class="lbl">${$t('Tasks')}</span></button>
  <button class="nv ${on('knowledge')}" data-a="go" data-h="knowledge">${ico('kn')}<span class="lbl">${$t('Knowledge')}</span></button>
  <button class="nv ${on('processes') || on('process')}" data-a="go" data-h="processes">${ico('proc')}<span class="lbl">${$t('Processes')}</span>${procBadge() ? `<span class="bd" title="${$t('Changes waiting for your approval')}">${procBadge()}</span>` : ''}</button>
  <button class="nv ${on('agreements') || on('agreement')}" data-a="go" data-h="agreements">${ico('agr')}<span class="lbl">${$t('Agreements')}</span>${agrBadge() ? `<span class="bd" title="${$t('Agreements waiting for your consent')}">${agrBadge()}</span>` : ''}</button>
  <button class="nv ${on('assistant')}" data-a="go" data-h="assistant" aria-label="${$t('Assistant')}">${ico('spark')}<span class="lbl">${$t('Assistant')}</span></button>
  <div class="sect">${personal() ? $t('My space') : 'Team Space'}</div>
  <button class="nv ${on('vision')}" data-a="go" data-h="vision">${ico('vision')}<span class="lbl">${personal() ? 'Vision' : 'Team vision'}</span></button>
  <button class="nv ${on('goals')}" data-a="go" data-h="goals">${ico('target')}<span class="lbl">${$t('Goals (OKR)')}</span></button>
  ${projs.map((p) => `<button class="nv ${on('project-' + p.id)}" data-a="go" data-h="project-${p.id}"><span class="dot" style="--c:${p.color}"></span><span class="lbl">${esc(p.name)}</span></button>${S.d.hypotheses.filter((h) => h.project === p.id).sort(byScore).map((h) => `<button class="nv sub ${r === 'hyp-' + h.id ? 'on' : ''}" data-a="go" data-h="hyp-${h.id}" title="${esc(stmtText(h))}">${hcode(h.id)} · ${HST[h.status]}${h.priority ? `<span class="sc">${hscore(h)}</span>` : ''}</button>`).join('')}`).join('')}
  ${isAdmin() ? `<button class="nv" data-a="newProject">${ico('plus')}<span class="lbl">${$t('New project')}</span></button>` : ''}
  <div class="spacer"></div>
  ${personal() ? '' : `<button class="nv ${on('members')}" data-a="go" data-h="members">${ico('users')}<span class="lbl">${$t('Members')}</span></button>`}
  <button class="nv ${on('profile')}" data-a="go" data-h="profile">${ico('gear')}<span class="lbl">${$t('Profile')}</span></button>
  <button class="nv ${on('roadmap')}" data-a="go" data-h="roadmap">${ico('route')}<span class="lbl">Roadmap</span></button>
  <div class="me">${av(uid(), 28)}<span class="lbl"><b>${esc(S.me.name)}</b><br><span class="hint">${ROLE[role()]}</span></span><button class="btn ghost sm lbl" style="margin-left:auto" data-a="logout" title="${$t('Sign out')}">${ico('out', 14)}</button></div>`;
}
// The team switcher groups teams by organization; the personal space belongs to none.
function teamMenu() {
  const tb = (t) => `<button data-a="team" data-v="${t.id}"><span class="logo">${esc(teamLogo(t))}</span>${esc(teamName(t))}${t.id === S.tid ? ' ✓' : ''}</button>`;
  const grouped = S.orgs.map((o) => [o, S.teams.filter((t) => t.orgId === o.id)]).filter(([, ts]) => ts.length);
  const rest = S.teams.filter((t) => t.kind !== 'personal' && !grouped.some(([, ts]) => ts.includes(t)));
  const own = S.teams.filter((t) => t.kind === 'personal');
  return `<div class="tmenu">${grouped.map(([o, ts]) => `<div class="og orgrow">${ico('org', 12)} ${esc(o.name)}</div>${ts.map(tb).join('')}`).join('')}${rest.map(tb).join('')}${own.length ? `<div class="og">${$t('Personal')}</div>${own.map(tb).join('')}` : ''}<button data-a="newTeam">${ico('plus')}${$t('Create a team')}</button></div>`;
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
  const act = S.d.hypotheses.filter((h) => h.status === 'testing').sort(byScore);
  const al = alignment(curQ()), myCk = allKrs().filter(needsCheckin).length;
  const teamQ = GL().filter((g) => g.level === 'team' && g.period === curQ() && g.status === 'active');
  const h = new Date().getHours(), hi = h < 12 ? $t('Good morning') : h < 18 ? $t('Good afternoon') : $t('Good evening');
  return `<div class="hd"><div><h1>${hi}, ${esc(S.me.name.split(' ')[0])}</h1><div class="sub">${fdl(new Date())}</div></div></div>
  <div class="chips" style="margin-bottom:20px"><button class="chip big" data-a="go" data-h="inbox">${$t('<b>{n}</b> waiting for review', { n: rv.length })}</button>${proc.length ? `<span class="chip big"><span class="spin"></span> ${$t('<b>{n}</b> being analyzed', { n: proc.length })}</span>` : ''}<span class="chip big" style="${over ? 'color:var(--red)' : ''}">${$t('<b>{n}</b> overdue', { n: over })}</span>${unr.length ? `<span class="chip big" style="color:var(--red)">${$t('<b>{n}</b> with new comments', { n: unr.length })}</span>` : ''}${myCk ? `<button class="chip big" data-a="toCheckin" data-p="${curQ()}">${$t('<b>{n}</b> KRs waiting for a check-in', { n: myCk })}</button>` : ''}${al.total ? `<button class="chip big" data-a="treeGo">Alignment <b>${P100(al.pct)}</b></button>` : ''}${agrBadge() ? `<button class="chip big" style="color:var(--red)" data-a="go" data-h="agreements">${$t('<b>{n}</b> agreements to respond to', { n: agrBadge() })}</button>` : ''}${procBadge() ? `<button class="chip big" data-a="go" data-h="processes">${$t('<b>{n}</b> process changes to decide', { n: procBadge() })}</button>` : ''}</div>
  <div class="grid g3">
  <div class="col"><div class="card"><h2>${TASK_SECTION_NAMES.mine} <span class="seg sm" style="margin-left:auto">${[['all', $t('All')], ['team', $t('To team')], ['ext', $t('To external')]].map(([k, l]) => `<button class="${S.dash === k ? 'on' : ''}" data-a="dash" data-v="${k}">${l}</button>`).join('')}</span></h2>${mf.length ? mf.map(trow).join('') : `<div class="empty">${$t('No open commitments.')}<br><button class="btn sm" style="margin-top:10px" data-a="newTask">${ico('plus', 13)} ${$t('New task')}</button></div>`}</div>
  ${unr.length ? `<div class="card"><h2>${$t('New comments')}</h2>${unr.map((t) => { const c = t.comments.at(-1); return `<button class="trow" data-a="open" data-id="${t.id}">${av(c.author)}<span class="tt"><b>${esc(t.title)}</b><span class="mt">${esc(c.text.slice(0, 120))}</span></span></button>`; }).join('')}</div>` : ''}</div>
  <div class="col"><div class="card"><h2>${TASK_SECTION_NAMES.delegated} <button class="lnk" data-a="tasksTab" data-v="delegated">${$t('All →')}</button></h2>${Object.keys(byP).length ? Object.entries(byP).map(([pid, ts]) => { const od = ts.filter((t) => t.due && diff(TODAY(), t.due) < 0).length; const nx = ts.filter((t) => t.due).sort((a, b) => (a.due < b.due ? -1 : 1))[0]; return `<button class="trow" data-a="${isExt(pid) ? 'tasksTab' : 'go'}" data-v="delegated" data-h="person-${esc(pid)}">${av(pid, 32)}<span class="tt"><b>${esc(pnx(pid))}</b><span class="mt"><span>${$t('{n} open', { n: ts.length })}</span>${od ? `<span class="chip red">${$t('{n} overdue', { n: od })}</span>` : ''}${nx ? `<span>${$t('next: {date}', { date: fd(nx.due) })}</span>` : ''}</span></span>${ico('arrow', 14)}</button>`; }).join('') : `<div class="empty">${$t('You haven’t delegated anything yet.')}<br>${$t('Tasks appear after you review a meeting.')}</div>`}</div>
  <div class="card"><h2>${$t('Inbox')} <button class="lnk" data-a="go" data-h="inbox">${$t('Open →')}</button></h2>${rv.length ? rv.slice(0, 5).map((i) => `<button class="trow" data-a="go" data-h="review-${i.id}"><span class="iico">${ico(typeIco(i.type))}</span><span class="tt"><b>${esc(i.title)}</b><span class="mt">${propCount(i)} · ${esc(i.origin)}</span></span><span class="btn sm">Review</span></button>`).join('') : `<div class="empty">${$t('The inbox is clear.')}<br><button class="btn sm" style="margin-top:10px" data-a="add">${ico('plus', 13)} ${$t('Drop a transcript')}</button></div>`}</div></div>
  <div class="col">${docsWaiting()}${teamQ.length ? `<div class="card"><h2>${ico('target')} ${$t('Quarter goals · {period}', { period: periodLabel(curQ()) })} <button class="lnk" data-a="go" data-h="goals">${$t('All goals →')}</button></h2>${teamQ.map((g) => `<div style="margin-bottom:12px;cursor:pointer" data-a="goal" data-id="${g.id}"><div style="display:flex;gap:8px;align-items:center"><b style="flex:1">${esc(g.title)}</b>${typeChip(g.type)}<b>${P100(gPct(g))}</b></div>${(g.keyResults || []).map((k) => `<div class="dk"><span class="x">${cd(k.confidence)} ${esc(k.title)} <span class="hint">${fnum(k.current, k.unit)} / ${fnum(k.target, k.unit)}</span></span>${pbar(k)}</div>`).join('')}</div>`).join('')}</div>` : ''}<div class="card"><h2>${$t('Recent knowledge')} <button class="lnk" data-a="go" data-h="knowledge">${$t('Knowledge →')}</button></h2>${dec.map((k) => `<div style="padding:7px 0;border-bottom:1px solid var(--line);font-size:14px"><span class="ty ${k.type}">${KT[k.type]}</span> ${esc(k.text)}<div class="hint">${fds(k.date)} ${tag(k.project)}</div></div>`).join('') || `<div class="empty">${$t('Nothing here yet')}</div>`}</div>
  <div class="card"><h2>${$t('Active hypotheses')}</h2>${act.map((h) => { const ts = tasks().filter((t) => t.hypothesis === h.id), dn = ts.filter((t) => t.status === 'done').length; return `<button class="trow" data-a="go" data-h="hyp-${h.id}">${h.priority ? scb(h) : ''}<span class="tt"><b>${hcode(h.id)} · ${esc(h.then)}</b><span class="mt">${av(h.owner, 18)}${h.to ? `<span>${diff(TODAY(), h.to) >= 0 ? $t('{n} d left', { n: diff(TODAY(), h.to) }) : $t('past the deadline')}</span>` : ''}<span>${$t('{done}/{total} tasks', { done: dn, total: ts.length })}</span>${tag(h.project)}${krHit(h.kr) ? `<span>${ico('target', 12)} ${esc(krHit(h.kr).k.title)}</span>` : ''}</span></span></button>`; }).join('') || `<div class="empty">${$t('No hypotheses in “Testing”')}</div>`}</div></div>
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
  if (S.applied?.id === item.id) { const a = S.applied; return `<div class="done-box"><div class="big">${$t('Done')}</div><p style="font-size:17px;margin:14px 0 4px">${esc(a.lines.join(' · ') || $t('Nothing was saved'))}</p><p class="hint">${a.notified.length ? $t('Notifications go to: {names}', { names: esc(a.notified.join(', ')) }) : $t('Everything is saved')}</p>${a.notes.map((n) => `<p class="hint danger">${esc(n)}</p>`).join('')}<div class="chips" style="justify-content:center;margin-top:18px"><button class="btn pri" data-a="go" data-h="tasks">${$t('Go to tasks')}</button><button class="btn" data-a="go" data-h="knowledge">${$t('Go to knowledge')}</button>${props.some((p) => p.on && ['proc', 'newproc'].includes(p.kind)) ? `<button class="btn" data-a="go" data-h="processes">${ico('proc', 14)} ${$t('Processes')}</button>` : ''}${props.some((p) => p.on && ['agr', 'newagr'].includes(p.kind)) ? `<button class="btn" data-a="go" data-h="agreements">${ico('agr', 14)} ${$t('Agreements')}</button>` : ''}${a.sourceId ? `<button class="btn" data-a="go" data-h="source-${a.sourceId}">${ico('file', 14)} ${$t('Open source')}</button>` : ''}<button class="btn" data-a="go" data-h="inbox">${$t('Go to inbox')}</button></div></div>`; }
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
  ${props.some((p) => ['proc', 'newproc', 'agr', 'newagr'].includes(p.kind)) ? `<div class="note dcnote">${ico('users')}<span>${$t('<b>Step 1 of 2.</b> You confirm that this was really said and that it concerns this process or agreement. Step 2 is the decision of the process owner or the consent of every party of the agreement.')}</span></div>` : ''}${sec('proc', $t('Process changes'))}${sec('newproc', $t('New processes'))}${sec('agr', $t('Agreement changes'))}${sec('newagr', $t('New agreements'))}
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
  return `<div class="src-scope"><span>${ico('kn', 13)} ${item.file ? $t('On apply, the PDF and its text are saved to the knowledge base as a source.') : item.audio ? $t('On apply, the recording and its transcript are saved to the knowledge base as a source.') : $t('On apply, the original text is saved to the knowledge base as a source.')}</span>${personal() ? '' : `<span class="seg sm"><button class="${sc === 'team' ? 'on' : ''}" data-a="srcScope" data-v="team">${ico('users', 12)} ${$t('Team')}</button><button class="${sc === 'private' ? 'on' : ''}" data-a="srcScope" data-v="private">${ico('lock', 12)} ${$t('Only me')}</button></span>`}</div>`;
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
    b = `<input class="ttl" ${A('p.title')} value="${esc(p.title)}" placeholder="${$t('What to do')}" aria-label="${$t('Task title')}"><div class="fields"><label>${$t('Requester')} ${selWho(A('p.requester'), p.requester)}</label><label class="owner-field">${$t('Owner')} ${selWho(A('p.owner'), p.owner)}</label><label>${$t('Deadline')} <input type="date" ${A('p.due')} value="${p.due || ''}"></label><label>${$t('Project')} ${selProj(A('p.project'), p.project)}</label><label>${$t('Hypothesis')} ${selHyp(A('p.hypothesis'), p.hypothesis, p.project)}</label><label><input type="checkbox" ${A('p.important')} ${p.important ? 'checked' : ''}> ${$t('Important')}</label></div>`;
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
  } else if (['proc', 'newproc', 'agr', 'newagr'].includes(p.kind)) {
    b = docPropCard(p, A);
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
  const inboxSource = k.author === uid() && k.sourceItem && S.d.inbox.some((i) => i.id === k.sourceItem);
  return `<div class="kn ${k.supersededBy ? 'sup' : ''}"><div class="km"><span class="ty ${k.type}">${KT[k.type]}</span>${k.scope === 'private' ? `<span>${ico('lock', 12)} ${$t('Only me')}</span>` : `<span>${ico('users', 12)} ${$t('Team')}</span>`}${tag(k.project)}${k.hypothesis && hyp(k.hypothesis) ? `<button class="chip" data-a="go" data-h="hyp-${k.hypothesis}">${hcode(k.hypothesis)}</button>` : ''}${canEdit ? `<span style="margin-left:auto" class="inl"><button class="btn ghost sm" data-a="editKn" data-id="${k.id}">${$t('Edit')}</button><button class="btn ghost sm" data-a="delKn" data-id="${k.id}" title="${$t('Delete')}">${ico('trash', 13)}</button></span>` : ''}</div><div class="ktx">${esc(k.text)}</div>${k.why ? `<div class="hint">${$t('Why:')} ${esc(k.why)}</div>` : ''}${k.quote ? `<div class="ev">“${esc(k.quote)}”</div>` : ''}<div class="km" style="margin-top:6px">${av(k.author, 18)}<span>${esc(pn(k.author))} · ${fds(k.date)}</span><span>${$t('Source:')} ${srcOf(k.sourceId) ? `<button class="lnk" data-a="go" data-h="source-${k.sourceId}">${ico(srcIco(srcOf(k.sourceId).kind), 12)} ${esc(knSource(k.source))}</button>` : inboxSource ? `<button class="lnk" data-a="go" data-h="review-${esc(k.sourceItem)}">${esc(knSource(k.source))}</button>` : esc(knSource(k.source))}</span>${sup ? `<span>${$t('replaces “{text}”', { text: esc(sup.text) })}</span>` : ''}${supBy ? `<span class="chip red">${$t('replaced {date}', { date: fds(supBy.date) })}</span>` : ''}</div></div>`;
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
    return head + `<p class="hint" style="margin:-4px 0 12px">${$t('Original texts, recordings and documents that tasks and knowledge were created from.')}</p>` + (ss.map(srcCard).join('') || `<div class="empty">${$t('No sources yet. They appear when you apply an item from the inbox.')}</div>`);
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

/* ---------- goals (OKR): helpers ---------- */
// Goals on every level (team annual / quarterly, project, member) share one shape: an objective with key results.
// A goal contributes to a key result one level higher (alignedTo); a hypothesis moves a key result of its project; a task moves
// a key result through its hypothesis, or directly through task.kr. The "golden thread" is that chain up to a team goal.
const GL = () => S.d?.goals || [];
const goalById = (id) => GL().find((g) => g.id === id);
const krHit = (id) => { if (!id) return null; for (const g of GL()) { const k = (g.keyResults || []).find((x) => x.id === id); if (k) return { g, k }; } return null; };
const krPct = (k) => { const d = k.target - k.start; return d ? Math.max(0, Math.min(1, (k.current - k.start) / d)) : k.current >= k.target ? 1 : 0; };
const gPct = (g) => (g.keyResults?.length ? g.keyResults.reduce((a, k) => a + krPct(k), 0) / g.keyResults.length : 0);
const P100 = (x) => `${Math.round(x * 100)}%`;
const fnum = (n, unit) => { const s = Number(n || 0).toLocaleString(LANG === 'uk' ? 'uk-UA' : 'en-US', { maximumFractionDigits: 2 }); return unit === '$' ? (LANG === 'uk' ? `${s} $` : `$${s}`) : unit === '%' ? `${s}%` : unit ? `${s} ${unit}` : s; };
const curQ = () => { const d = new Date(); return `${d.getFullYear()}Q${Math.floor(d.getMonth() / 3) + 1}`; };
const qShift = (p, n) => { let y = +p.slice(0, 4), q = +p[5] - 1 + n; y += Math.floor(q / 4); q = ((q % 4) + 4) % 4; return `${y}Q${q + 1}`; };
const yearOf = (p) => p.slice(0, 4);
const periodLabel = (p) => (p.length === 4 ? $t('Year {year}', { year: p }) : `Q${p[5]} ${p.slice(0, 4)}`);
const qRange = (p) => { const y = +p.slice(0, 4), q = +p[5]; return [new Date(y, (q - 1) * 3, 1), new Date(y, q * 3, 1)]; };
const curPeriod = () => (S.period && /^\d{4}Q[1-4]$/.test(S.period) ? S.period : curQ());
const periodList = () => [...new Set([qShift(curQ(), -1), curQ(), qShift(curQ(), 1), ...GL().filter((g) => g.period.length > 4).map((g) => g.period)])].sort();
const weekOfQuarter = (p) => { const [a, b] = qRange(p); const n = Math.round((b - a) / 6048e5); const w = Math.min(n, Math.max(1, Math.ceil((Date.now() - a) / 6048e5))); return [w, n]; };
const CONF = { on_track: 'on', at_risk: 'risk', off_track: 'off' };
const CONFL = translated({ on_track: 'On track', at_risk: 'At risk', off_track: 'Off track' });
const cd = (c) => `<span class="cd ${CONF[c] || 'none'}" title="${c ? CONFL[c] : $t('No check-in yet')}"></span>`;
const pbar = (k, w) => `<div class="pb ${CONF[k.confidence] || ''}" ${w ? `style="width:${w}"` : ''}><i style="width:${Math.round(krPct(k) * 100)}%"></i></div>`;
const typeChip = (t) => (t === 'committed' ? `<span class="ty2 com" title="${$t('We deliver it in full')}">Committed</span>` : `<span class="ty2" title="${$t('0.7 is a good result')}">Aspirational</span>`);
const levelName = (g) => (g.level === 'team' ? (g.period.length === 4 ? $t('Annual team goal') : $t('Team goal')) : g.level === 'project' ? `${$t('Project goal')} · ${prj(g.project)?.name || '—'}` : `${$t('Member goal')} · ${pn(g.member)}`);
const parentKr = (g) => (g.alignedTo || []).map((a) => a.krId).find((id) => krHit(id));
function chainFromKr(krId) {
  const out = []; const seen = new Set(); let id = krId;
  while (id && !seen.has(id)) { seen.add(id); const h = krHit(id); if (!h) break; out.push(h); id = parentKr(h.g); }
  return out;
}
const reachesTeam = (krId) => chainFromKr(krId).some((x) => x.g.level === 'team' && x.g.status !== 'cancelled');
const taskKr = (t) => (t.kr && krHit(t.kr) ? t.kr : t.hypothesis && krHit(hyp(t.hypothesis)?.kr) ? hyp(t.hypothesis).kr : null);
const taskAligned = (t) => { const k = taskKr(t); return Boolean(k && reachesTeam(k)); };
// Alignment score: the share of tasks closed in the quarter that lead, through the chain, to an active team key result.
function alignment(p = curPeriod()) {
  const [a, b] = qRange(p);
  const done = tasks().filter((t) => t.status === 'done' && ((d) => d >= a && d < b)(new Date(t.updatedAt || t.createdAt)));
  const al = done.filter(taskAligned);
  return { total: done.length, aligned: al.length, pct: done.length ? al.length / done.length : 0, orphans: done.filter((t) => !taskAligned(t)) };
}
const childrenOfKr = (krId) => GL().filter((g) => g.status !== 'cancelled' && (g.alignedTo || []).some((x) => x.krId === krId));
const hypsOfKr = (krId) => S.d.hypotheses.filter((h) => h.kr === krId);
const unalignedGoals = (p) => GL().filter((g) => g.period === p && g.status === 'active' && !parentKr(g) && !g.unaligned);
const allKrs = () => GL().flatMap((g) => (g.keyResults || []).map((k) => ({ k, g })));
const mondayOf = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
const needsCheckin = ({ k, g }) => g.status === 'active' && k.owner === uid() && (g.period === curQ() || g.period === yearOf(curQ())) && !(k.checkins || []).some((c) => new Date(c.at) >= mondayOf());

// rights (the server enforces the same rules)
const canTeamGoal = () => isAdmin();
const canProjectGoal = (p) => Boolean(p) && (isAdmin() || p.owner === uid());
const canEditGoal = (g) => (g.level === 'team' ? canTeamGoal() : g.level === 'project' ? canProjectGoal(prj(g.project)) : g.member === uid());
const canCheckin = (g, k) => k.owner === uid() || canEditGoal(g);
const canEditHyp = (h) => isAdmin() || h.owner === uid();

/* ---------- hypothesis priority ---------- */
// Priority = Impact × Confidence × Speed ÷ Cost; Cost is the average of team time and money. Every factor is 1–10.
const PKEYS = ['impact', 'confidence', 'speed', 'costTime', 'costMoney'];
const DEF_PR = { impact: 5, confidence: 3, speed: 5, costTime: 3, costMoney: 3 };
const prOf = (h) => h.priority || DEF_PR;
const hcost = (p) => (p.costTime + p.costMoney) / 2;
const hscore = (h) => (h.priority ? Math.round((h.priority.impact * h.priority.confidence * h.priority.speed) / hcost(h.priority)) : null);
const hvalue = (h) => prOf(h).impact * prOf(h).confidence;
const QUAD = translated({ qw: 'Quick win', bb: 'Big bet', ce: 'Cheap experiment', nw: 'Costly, little evidence' });
const quad = (h) => { const hv = hvalue(h) >= 25, hc = hcost(prOf(h)) >= 5; return hv && !hc ? 'qw' : hv && hc ? 'bb' : !hv && !hc ? 'ce' : 'nw'; };
const qchip = (h, id) => (h.priority ? `<span class="qchip ${quad(h)}" ${id ? `id="${id}"` : ''}>${QUAD[quad(h)]}</span>` : '');
const byScore = (a, b) => (hscore(b) ?? -1) - (hscore(a) ?? -1);
const projHyps = (pid) => S.d.hypotheses.filter((h) => h.project === pid);
const rankIn = (h) => { const list = projHyps(h.project).filter((x) => x.priority).sort(byScore); return [list.indexOf(h) + 1, list.length]; };
const scb = (h, big) => (h.priority ? `<span class="scb ${hscore(h) < 30 ? 'lo' : ''} ${big ? 'big' : ''}" title="${$t('Priority')}">${hscore(h)}</span>` : `<span class="scb lo ${big ? 'big' : ''}" title="${$t('Not scored yet')}">—</span>`);
// AI suggestion for Impact: the expected contribution as a share of what is left to the key result's target.
const aiImpact = (h) => { const k = krHit(h.kr)?.k; if (!k || !h.expectedImpact) return null; const gap = Math.max(Math.abs(k.target - k.current), 1e-9); const r = Math.abs(h.expectedImpact) / gap; return { r, v: r >= 0.5 ? 10 : r >= 0.25 ? 8 : r >= 0.1 ? 6 : r >= 0.05 ? 4 : 2, k }; };
const ANC = {
  impact: (v) => (v <= 2 ? $t('barely moves the KR') : v <= 4 ? $t('a small contribution') : v <= 6 ? $t('a noticeable contribution') : v <= 8 ? $t('a strong contribution') : $t('closes most of the KR')),
  confidence: (v) => (v <= 1 ? $t('just my opinion') : v <= 2 ? $t('the team agrees, no evidence') : v <= 4 ? $t('trends, other companies’ cases') : v <= 6 ? $t('our own past experience') : v <= 8 ? $t('data from our product / a small test') : $t('a clean experiment with a result')),
  speed: (v) => (v >= 10 ? $t('a result within a week') : v >= 8 ? $t('in 2–3 weeks') : v >= 6 ? $t('in a month') : v >= 4 ? $t('in 2 months') : v >= 2 ? $t('in a quarter') : $t('longer than a quarter')),
  costTime: (v) => (v <= 1 ? $t('≤ 1 person-day') : v <= 3 ? $t('≈ a week of work') : v <= 5 ? $t('2–3 weeks of work') : v <= 7 ? $t('≈ a month of work') : $t('> 2 person-months')),
  costMoney: (v) => (v <= 1 ? '$0' : v <= 3 ? $t('up to $200') : v <= 5 ? $t('up to $1,000') : v <= 7 ? $t('up to $5,000') : $t('more than $5,000')),
};

/* ---------- goals: components ---------- */
function alignChip(g) {
  const pk = parentKr(g);
  if (pk) { const { k, g: pg } = krHit(pk); return `<button class="al" data-a="goal" data-id="${pg.id}" title="${esc(pg.title)}">${ico('route', 12)}<span>${$t('contributes to')}: ${esc(k.title)} · ${esc(pg.level === 'project' ? prj(pg.project)?.name || '' : periodLabel(pg.period))}</span></button>`; }
  if (g.unaligned?.reason === 'growth') return `<span class="al grow">${$t('Growth — not aligned on purpose')}</span>`;
  if (g.unaligned?.reason === 'bau') return `<span class="al grow">${$t('Support / BAU')}</span>`;
  if (g.level === 'team' && g.period.length === 4) return `<span class="al grow">${$t('Top level')}</span>`;
  if (g.status !== 'active') return '';
  return `<span class="al warn2">${ico('warn', 12)} ${$t('Not aligned')}</span>`;
}
const krRow = (k) => `<div class="kr"><div class="kn1"><i>KR</i>${esc(k.title)}</div><div class="num">${fnum(k.current, k.unit)} <span>/ ${fnum(k.target, k.unit)}</span></div>${pbar(k)}${cd(k.confidence)}${av(k.owner, 20)}</div>`;
function goalCard(g, opts = {}) {
  const closed = g.status === 'done' && g.score != null;
  return `<div class="gcard ${S.goal === g.id ? 'sel' : ''}" data-a="goal" data-id="${g.id}">
   <div class="ghead"><div class="gt"><b>${esc(g.title)}</b><div class="gmeta">${typeChip(g.type)}${opts.showLevel ? `<span>${esc(levelName(g))}</span>` : ''}${g.status === 'cancelled' ? `<span class="chip">${$t('Cancelled')}</span>` : ''}${av(g.owner, 18)}<span>${esc(pn(g.owner))}</span>${alignChip(g)}</div></div>
   <div class="gpct">${closed ? Number(g.score).toFixed(1) : P100(gPct(g))}<small>${closed ? $t('score') : $t('progress')}</small></div></div>
   <div class="krs">${(g.keyResults || []).map(krRow).join('')}</div>
   ${closed && g.retro ? `<div class="ev" style="margin-top:10px">${esc(g.retro)}</div>` : ''}</div>`;
}
const periodSeg = () => `<span class="seg">${periodList().map((p) => `<button class="${curPeriod() === p ? 'on' : ''}" data-a="period" data-v="${p}">${periodLabel(p)}</button>`).join('')}</span>`;

/* ---------- goals page ---------- */
function pGoals() {
  const p = curPeriod(), year = yearOf(p);
  const annual = GL().filter((g) => g.level === 'team' && g.period === year);
  const qGoals = GL().filter((g) => g.period === p);
  const al = alignment(p);
  const teamQ = qGoals.filter((g) => g.level === 'team' && g.status !== 'cancelled');
  const risk = allKrs().filter(({ k, g }) => g.status === 'active' && (g.period === p || g.period === year) && k.confidence && k.confidence !== 'on_track').length;
  const myCk = allKrs().filter(needsCheckin).length;
  const unal = unalignedGoals(p).length;
  const [w, n] = weekOfQuarter(p);
  const head = `<div class="hd"><div><h1>${$t('Goals (OKR)')}</h1><div class="sub">${esc(teamName(S.d.team))} · ${$t('the team sees every goal: team, projects and members')}</div></div><div class="act">${periodSeg()}<button class="btn pri" data-a="newGoal">${ico('plus')} ${$t('Goal')}</button></div></div>`;
  const stats = qGoals.length || annual.length ? `<div class="sumrow">
    <button class="stat" data-a="gtab" data-v="tree"><div class="v">${al.total ? P100(al.pct) : '—'}</div><div class="l">${$t('Alignment · {n} of {total} closed tasks work toward OKRs', { n: al.aligned, total: al.total })}</div></button>
    <div class="stat"><div class="v">${teamQ.length ? P100(teamQ.reduce((a, g) => a + gPct(g), 0) / teamQ.length) : '—'}</div><div class="l">${p === curQ() ? $t('Team OKR progress · week {w} of {n}', { w, n }) : $t('Team OKR progress')}</div></div>
    <button class="stat ${risk ? 'warnv' : ''}" data-a="gtab" data-v="tree"><div class="v">${risk}</div><div class="l">${$t('KRs at risk or off track · {n} goals not aligned', { n: unal })}</div></button>
    <button class="stat" data-a="gtab" data-v="checkin"><div class="v">${myCk}</div><div class="l">${$t('My KRs waiting for a check-in this week')}</div></button></div>` : '';
  const tabs = `<div class="chips" style="margin:18px 0 0"><span class="seg">${[['okr', 'OKR'], ['tree', $t('Alignment tree')], ['checkin', 'Check-in']].map(([k, l]) => `<button class="${(S.gtab || 'okr') === k ? 'on' : ''}" data-a="gtab" data-v="${k}">${l}</button>`).join('')}</span></div>`;
  let body;
  if (!qGoals.length && !annual.length) body = emptyPeriod(p);
  else if (S.gtab === 'tree') body = treeView(annual, p);
  else if (S.gtab === 'checkin') body = checkinView(p);
  else body = okrList(annual, qGoals, p);
  return head + stats + tabs + body;
}
function emptyPeriod(p) {
  return `<div class="card okr-empty"><h2 style="justify-content:center">${$t('No goals for {period} yet', { period: periodLabel(p) })}</h2><p class="hint">${$t('Start from the annual goal, then set 3–5 quarterly objectives with 2–5 measurable key results each.')}</p><div class="chips" style="justify-content:center;margin-top:14px">${canTeamGoal() ? `<button class="btn pri" data-a="newGoal" data-level="team">${ico('plus')} ${$t('Team goal')}</button>` : ''}<button class="btn" data-a="newGoal" data-level="member">${ico('plus')} ${$t('My goal')}</button></div></div>`;
}
function okrList(annual, qGoals, p) {
  const year = yearOf(p);
  const team = qGoals.filter((g) => g.level === 'team');
  const projects = S.d.projects.map((x) => [x, qGoals.filter((g) => g.level === 'project' && g.project === x.id)]).filter(([, gs]) => gs.length);
  const members = S.d.members.map((m) => [m.id, qGoals.filter((g) => g.level === 'member' && g.member === m.id)]).filter(([, gs]) => gs.length);
  const many = team.filter((g) => g.status !== 'cancelled').length > 5;
  let h = '';
  if (annual.length) h += `<div class="gsec">${ico('target', 18)}<h2>${$t('Annual goal · {year}', { year })}</h2><span class="hint">${$t('where we are going this year')}</span><span class="line"></span></div>${annual.map((g) => goalCard(g)).join('')}`;
  else if (canTeamGoal()) h += `<div class="gsec"><h2>${$t('Annual goal · {year}', { year })}</h2><span class="hint">${$t('not set yet')}</span><span class="line"></span><button class="btn sm" data-a="newGoal" data-level="team" data-period="${year}">${ico('plus', 13)} ${$t('Annual goal')}</button></div>`;
  h += `<div class="gsec"><h2>${$t('Team · {period}', { period: periodLabel(p) })}</h2><span class="hint">${$t('what has to change in 3 months')}</span><span class="line"></span>${canTeamGoal() ? `<button class="btn sm" data-a="newGoal" data-level="team">${ico('plus', 13)} ${$t('Team goal')}</button>` : ''}</div>${many ? `<div class="awarn">${ico('warn', 13)} ${$t('More than 5 objectives are no longer priorities.')}</div>` : ''}${team.map((g) => goalCard(g)).join('') || `<div class="empty">${$t('No team goals')}</div>`}`;
  if (projects.length) h += `<div class="gsec"><h2>${$t('Projects · {period}', { period: periodLabel(p) })}</h2><span class="hint">${$t('how projects contribute to team KRs')}</span><span class="line"></span></div>${projects.map(([x, gs]) => `<div class="persongrp"><span class="dot" style="--c:${x.color}"></span><button class="lnk" style="margin:0;color:var(--ink);font-size:14px" data-a="go" data-h="project-${x.id}">${esc(x.name)}</button></div>${gs.map((g) => goalCard(g)).join('')}`).join('')}`;
  h += `<div class="gsec"><h2>${$t('Members · {period}', { period: periodLabel(p) })}</h2><span class="hint">${$t('personal goals for focus, not for performance reviews')}</span><span class="line"></span><button class="btn sm" data-a="newGoal" data-level="member">${ico('plus', 13)} ${$t('My goal')}</button></div>${members.map(([u, gs]) => `<div class="persongrp">${av(u, 22)}<button class="lnk" style="margin:0;color:var(--ink);font-size:14px" data-a="go" data-h="person-${u}">${esc(pn(u))}</button><span class="hint">${ROLE[M()[u]?.role] || ''}</span></div>${gs.map((g) => goalCard(g)).join('')}`).join('') || `<div class="empty">${$t('Nobody has set personal goals for this quarter yet')}</div>`}`;
  return h;
}
function krRisk(k, g) {
  if (g.level === 'member' || g.status !== 'active') return '';
  const kids = childrenOfKr(k.id), hs = hypsOfKr(k.id);
  if (g.level === 'project') return hs.length === 0 ? `<span class="rbadge r">${$t('no hypotheses — nobody moves this KR')}</span>` : hs.length === 1 ? `<span class="rbadge a">${$t('one bet — no alternatives')}</span>` : '';
  if (g.level === 'team' && g.period.length > 4 && !kids.some((x) => x.level === 'project') && !hs.length) return `<span class="rbadge r">${$t('no project works on this KR')}</span>`;
  return '';
}
const LV_ORDER = { team: 0, project: 1, member: 2 };
function treeGoal(g, p, seen = new Set()) {
  if (seen.has(g.id)) return ''; seen.add(g.id);
  const lv = g.level === 'team' ? (g.period.length === 4 ? $t('Year') : $t('Quarter')) : g.level === 'project' ? prj(g.project)?.name || '' : pn(g.member);
  const node = `<span class="tn goal ${g.level === 'team' ? 'team' : ''}" data-a="goal" data-id="${g.id}">${g.level === 'member' ? av(g.member, 18) : g.level === 'project' ? `<span class="dot" style="--c:${prj(g.project)?.color || '#888'}"></span>` : ''}<span class="lv">${esc(lv)}</span>${esc(g.title)} <b>${P100(gPct(g))}</b></span>`;
  const krs = (g.keyResults || []).map((k) => {
    const kids = childrenOfKr(k.id).filter((x) => x.period === p || x.period === yearOf(p)).sort((a, b) => LV_ORDER[a.level] - LV_ORDER[b.level]);
    const hs = hypsOfKr(k.id).sort(byScore);
    const inner = [...kids.map((x) => `<li>${treeGoal(x, p, seen)}</li>`), ...hs.map((h) => { const nt = tasks().filter((t) => t.hypothesis === h.id).length; return `<li><span class="tn hypn" data-a="go" data-h="hyp-${h.id}">${scb(h)}<b>${hcode(h.id)}</b> ${esc((h.then || '').slice(0, 60))}${(h.then || '').length > 60 ? '…' : ''} <span class="hint">· ${HST[h.status]} · ${$p(nt, 'task')}</span>${h.status === 'testing' && !nt ? `<span class="rbadge a">${$t('testing without tasks')}</span>` : ''}</span></li>`; })].join('');
    return `<li><span class="tn krn" data-a="goal" data-id="${g.id}">${cd(k.confidence)}<span class="lv">KR</span>${esc(k.title)} <span class="hint">${fnum(k.current, k.unit)} / ${fnum(k.target, k.unit)}</span><span class="mini">${pbar(k)}</span>${krRisk(k, g)}</span>${inner ? `<ul>${inner}</ul>` : ''}</li>`;
  }).join('');
  return `${node}<ul>${krs}</ul>`;
}
function treeView(annual, p) {
  const quarterTeam = GL().filter((g) => g.level === 'team' && g.period === p && !parentKr(g));
  const roots = [...annual, ...quarterTeam];
  const al = alignment(p);
  const unal = unalignedGoals(p).filter((g) => !(g.level === 'team' && roots.includes(g)));
  const conscious = GL().filter((g) => g.period === p && g.unaligned);
  const empty = S.d.projects.filter((x) => x.status === 'active' && !GL().some((g) => g.level === 'project' && g.project === x.id && g.period === p));
  const noKr = S.d.hypotheses.filter((h) => ['draft', 'testing'].includes(h.status) && !krHit(h.kr));
  return `<div class="okr-grid">
  <div class="card tree-wrap"><h2>${ico('tree')} ${$t('How everything flows into the main goal')}</h2><p class="hint" style="margin-top:-6px">${$t('Year → quarter → projects → hypotheses (with priority) and member goals. Click for details.')}</p><ul class="tree">${roots.map((g) => `<li>${treeGoal(g, p)}</li>`).join('') || `<li class="hint">${$t('No team goals in this period')}</li>`}</ul></div>
  <div class="col">
   <div class="card"><h2>${ico('warn')} ${$t('Not aligned')}</h2>
    ${unal.map((g) => `<button class="crow" data-a="goal" data-id="${g.id}">${g.level === 'project' ? `<span class="dot" style="--c:${prj(g.project)?.color || '#888'}"></span>` : av(g.member || g.owner, 18)}<span class="x">${esc(g.title)}</span><span class="al warn2">${$t('no parent')}</span></button>`).join('') || `<div class="hint">${$t('Every goal is aligned')}</div>`}
    ${empty.length ? `<div class="contrib"><div class="lbl2">${$t('Projects without goals')} · ${empty.length}</div>${empty.map((x) => `<button class="crow" data-a="go" data-h="project-${x.id}"><span class="dot" style="--c:${x.color}"></span><span class="x">${esc(x.name)}</span></button>`).join('')}</div>` : ''}
    ${noKr.length ? `<div class="contrib"><div class="lbl2">${$t('Hypotheses without a KR')} · ${noKr.length}</div>${noKr.map((h) => `<button class="crow" data-a="go" data-h="hyp-${h.id}"><span class="chip">${hcode(h.id)}</span><span class="x">${esc(h.then)}</span>${tag(h.project)}</button>`).join('')}</div>` : ''}
    <div class="contrib"><div class="lbl2">${$t('Closed tasks outside OKRs')} · ${al.orphans.length}</div>${al.orphans.slice(0, 12).map((t) => `<button class="crow" data-a="open" data-id="${t.id}">${av(t.owner, 18)}<span class="x">${esc(t.title)}</span><span class="hint">${taskKr(t) ? $t('KR without a parent') : $t('no goal')}</span></button>`).join('')}</div>
    <p class="hint" style="margin-bottom:0">${$t('It is normal for 15–30% of work to be support. It is a problem when most work leads to no goal.')}</p></div>
   <div class="card"><h2>${$t('Outside OKRs on purpose')}</h2>${conscious.map((g) => `<button class="crow" data-a="goal" data-id="${g.id}">${av(g.member || g.owner, 18)}<span class="x">${esc(g.title)}</span><span class="al grow">${g.unaligned.reason === 'growth' ? $t('Growth') : 'BAU'}</span></button>`).join('') || `<div class="hint">${$t('None')}</div>`}</div>
  </div></div>`;
}
function checkinView(p) {
  const krs = allKrs().filter(({ k, g }) => g.status === 'active' && (g.period === p || g.period === yearOf(p)) && (S.ckAll ? true : k.owner === uid()));
  const rows = krs.map(({ k, g }) => {
    const done = (k.checkins || []).some((c) => new Date(c.at) >= mondayOf() && c.by === uid());
    const can = canCheckin(g, k);
    const conf = S.ckc[k.id] || k.confidence || 'on_track';
    return `<div class="ck ${done ? 'done' : ''}"><div><div class="g">${esc(levelName(g))} · ${esc(g.title)}</div><div class="k">${esc(k.title)}</div><div class="hint">${$t('target {target} · now {current}', { target: fnum(k.target, k.unit), current: fnum(k.current, k.unit) })} · ${av(k.owner, 16)} ${esc(pn(k.owner))}</div></div>
     <input class="in" type="number" step="any" id="ckv-${k.id}" value="${k.current}" ${can ? '' : 'disabled'} aria-label="${$t('New value')}">
     <span class="cseg">${Object.keys(CONF).map((c) => `<button class="${conf === c ? 'on' : ''}" data-a="ckc" data-k="${k.id}" data-v="${c}" ${can ? '' : 'disabled'} title="${CONFL[c]}" aria-label="${CONFL[c]}">${cd(c)}</button>`).join('')}</span>
     <input class="in" id="ckn-${k.id}" placeholder="${$t('Comment: what changed, what blocks')}" ${can ? '' : 'disabled'}>
     ${can ? `<button class="btn ${done ? '' : 'pri'} sm" data-a="ckSave" data-g="${g.id}" data-k="${k.id}">${done ? $t('Update') : $t('Save')}</button>` : `<span class="lock-who">${ico('lock', 13)} ${esc(pn(k.owner))}</span>`}
    </div>`;
  }).join('');
  const [a] = [mondayOf()]; const b = new Date(a); b.setDate(b.getDate() + 6);
  return `<div class="card" style="margin-top:16px;padding:0"><div style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap"><h2 style="margin:0">${$t('Check-in · week {from} – {to}', { from: fds(isoDay(a)), to: fds(isoDay(b)) })}</h2><span class="hint">${$t('KR value + confidence 🟢🟡🔴 + a comment')}</span><span class="seg sm" style="margin-left:auto"><button class="${!S.ckAll ? 'on' : ''}" data-a="ckAll" data-v="0">${$t('My KRs')}</button><button class="${S.ckAll ? 'on' : ''}" data-a="ckAll" data-v="1">${$t('All team KRs')}</button></span></div>
  ${rows || `<div class="empty">${S.ckAll ? $t('No key results in this period') : $t('You own no key results in this period')}</div>`}</div>`;
}

/* ---------- goal drawer ---------- */
function spark(k) {
  const pts = [{ v: k.start }, ...(k.checkins || []).map((c) => ({ v: c.value, c: c.confidence }))]; if (pts.length < 2) return '';
  const w = 400, h = 46, lo = Math.min(k.start, k.target, ...pts.map((x) => x.v)), hi = Math.max(k.start, k.target, ...pts.map((x) => x.v));
  const x = (i) => 4 + (i / (pts.length - 1)) * (w - 8), y = (v) => h - 4 - ((v - lo) / (hi - lo || 1)) * (h - 8);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><line x1="4" x2="${w - 4}" y1="${y(k.target)}" y2="${y(k.target)}" stroke="var(--line2)" stroke-dasharray="4 4"/><path d="${path}" fill="none" stroke="var(--ink)" stroke-width="2"/>${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="3" fill="${p.c === 'off_track' ? 'var(--red)' : p.c === 'at_risk' ? '#e0a11b' : p.c ? 'var(--green)' : 'var(--line2)'}"/>`).join('')}</svg>`;
}
function goalDrawer(el) {
  const g = goalById(S.goal);
  if (!g) { S.goal = null; el.classList.remove('on'); el.innerHTML = ''; return; }
  const pk = parentKr(g); const chain = pk ? chainFromKr(pk) : [];
  const ed = canEditGoal(g);
  const krBlocks = (g.keyResults || []).map((k) => {
    const kids = childrenOfKr(k.id), hs = hypsOfKr(k.id).sort(byScore), last = (k.checkins || []).at(-1);
    return `<div class="dkr"><div class="top2">${cd(k.confidence)}<b>${esc(k.title)}</b>${av(k.owner, 20)}</div>
     <div class="big">${fnum(k.current, k.unit)} <span>/ ${fnum(k.target, k.unit)} · ${$t('start')} ${fnum(k.start, k.unit)} · ${P100(krPct(k))}</span></div>${pbar(k)}${spark(k)}
     ${k.note ? `<div class="ev">${esc(k.note)}</div>` : ''}
     <div class="hint" style="margin-top:6px">${last ? $t('Last check-in {date}', { date: fds(last.at) }) : $t('No check-in yet')}${canCheckin(g, k) && g.status === 'active' ? ` · <button class="lnk" style="margin:0;display:inline" data-a="toCheckin" data-p="${g.period.length === 4 ? curQ() : g.period}">${$t('Check in')}</button>` : ''}</div>
     ${kids.length || hs.length ? `<div class="contrib">${kids.length ? `<div class="lbl2">${$t('Goals that flow into this KR')}</div>${kids.map((x) => `<button class="crow" data-a="goal" data-id="${x.id}">${x.level === 'project' ? `<span class="dot" style="--c:${prj(x.project)?.color || '#888'}"></span>` : av(x.member || x.owner, 18)}<span class="x">${esc(x.title)}</span><span class="hint">${P100(gPct(x))}</span></button>`).join('')}` : ''}${hs.length ? `<div class="lbl2">${$t('Hypotheses that move this KR')}</div>${hs.map((h) => `<button class="crow" data-a="go" data-h="hyp-${h.id}">${scb(h)}<span class="x"><b>${hcode(h.id)}</b> ${esc(h.then)}</span><span class="hint">${HST[h.status]}${h.expectedImpact ? ` · +${fnum(h.expectedImpact, k.unit)}` : ''}</span></button>`).join('')}` : ''}</div>` : g.level !== 'member' && g.status === 'active' ? `<div class="contrib"><span class="rbadge r" style="justify-self:start">${$t('Nobody works on this KR yet')}</span></div>` : ''}
    </div>`;
  }).join('');
  const hist = (g.keyResults || []).flatMap((k) => (k.checkins || []).map((c) => ({ ...c, k }))).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8);
  el.innerHTML = `<div class="dw"><div class="dwh"><span class="chip">${esc(levelName(g))}</span><span class="chip">${periodLabel(g.period)}</span>${typeChip(g.type)}<span class="task-drawer-actions">${ed ? `<button class="btn sm" data-a="editGoal" data-id="${g.id}">${$t('Edit')}</button><button class="btn ghost sm" data-a="delGoal" data-id="${g.id}" title="${$t('Delete')}">${ico('trash')}</button>` : `<span class="lockhint">${ico('lock', 13)} ${g.level === 'project' ? $t('Project Owner / Admin') : g.level === 'team' ? 'Owner / Admin' : $t('Goal author')}</span>`}<button class="btn ghost sm" data-a="closeD" aria-label="${$t('Close')}">${ico('x')}</button></span></div>
   <div class="dwt" style="padding:0;margin:4px 0 8px">${esc(g.title)}</div>
   ${g.description ? `<p style="margin:0 0 8px;white-space:pre-wrap">${esc(g.description)}</p>` : ''}
   <div class="kv"><span>${$t('Goal owner')}</span><span class="inl">${av(g.owner)} ${esc(pn(g.owner))}</span><span>${$t('Progress')}</span><span><b>${g.status === 'done' && g.score != null ? `${$t('score')} ${Number(g.score).toFixed(1)}` : P100(gPct(g))}</b> <span class="hint">· ${g.type === 'aspirational' ? $t('for aspirational goals 70% is a success') : $t('committed: we expect 100%')}</span></span>
   <span>${$t('Contributes to')}</span><span>${chain.length ? `<div class="path">${chain.map((x) => `<button data-a="goal" data-id="${x.g.id}"><span class="arr">↳</span> <b>${esc(x.k.title)}</b> <span class="hint">· ${esc(x.g.title)}</span></button>`).join('')}</div>` : alignChip(g) || '—'}</span></div>
   ${krBlocks || `<div class="empty">${$t('No key results')}</div>`}
   <div class="box"><h3>${$t('End of the period')}</h3>${g.status === 'done' ? `<div><b style="font-size:20px">${g.score != null ? Number(g.score).toFixed(1) : '—'}</b> <span class="hint">/ 1.0</span></div>${g.retro ? `<div class="ev">${esc(g.retro)}</div>` : ''}` : `<div class="hint">${$t('A 0.0–1.0 score and a short retro at the end of the period. Committed: we expect 1.0 and explain any shortfall. Aspirational: 0.7 is a good result.')}</div>${ed && g.status === 'active' ? `<button class="btn sm" style="margin-top:8px" data-a="editGoal" data-id="${g.id}" data-close="1">${$t('Close the period')}</button>` : ''}`}</div>
   <div class="box"><h3>${$t('History')}</h3><div class="hist">${hist.map((c) => `<div>${fds(c.at)} · ${esc(pn(c.by))}: ${esc(c.k.title)} → ${fnum(c.value, c.k.unit)} ${cd(c.confidence)}${c.note ? ` <span>— ${esc(c.note)}</span>` : ''}</div>`).join('') || `<div>${$t('No check-ins yet')}</div>`}</div></div>
  </div>`;
  el.classList.add('on'); el.setAttribute('aria-hidden', 'false');
}

/* ---------- goal modal ---------- */
const ACTIVITY = /^(запустити|зробити|підготувати|написати|створити|провести|налаштувати|launch|build|ship|make|create|write|prepare|set up)(?=\s|$)/i;
function alignOptions(m) {
  const opts = [];
  const add = (label, g) => g.keyResults?.length && g.status !== 'cancelled' && g.id !== m.id && opts.push([label, g.keyResults]);
  const year = yearOf(m.period);
  if (m.level === 'team' && m.period.length > 4) GL().filter((g) => g.level === 'team' && g.period === year).forEach((g) => add(`${$t('Annual goal {year}', { year })} · ${g.title}`, g));
  if (m.level === 'project') GL().filter((g) => g.level === 'team' && (g.period === m.period || g.period === year)).forEach((g) => add(`${periodLabel(g.period)} · ${g.title}`, g));
  if (m.level === 'member') {
    S.d.projects.filter((x) => (x.members || []).includes(uid())).forEach((x) => GL().filter((g) => g.level === 'project' && g.project === x.id && (g.period === m.period)).forEach((g) => add(`${x.name} · ${g.title}`, g)));
    GL().filter((g) => g.level === 'team' && (g.period === m.period || g.period === year)).forEach((g) => add(`${$t('Team')} · ${g.title}`, g));
  }
  return opts;
}
function goalModalHtml(m, close, cancel) {
  const myProjects = S.d.projects.filter((x) => x.status !== 'archived' && canProjectGoal(x));
  const levels = [['team', $t('Team'), canTeamGoal(), 'Owner / Admin'], ['project', $t('Project'), myProjects.length > 0, $t('Project Owner / Admin')], ['member', $t('My goal'), true, '']];
  const opts = alignOptions(m);
  const top = m.level === 'team' && m.period.length === 4;
  const periods = [...new Set([...(m.level === 'team' ? [yearOf(curQ()), String(+yearOf(curQ()) + 1)] : []), ...periodList(), m.period])].sort();
  const owners = S.d.members.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('');
  return `<div class="md wide"><div class="mdh"><h2>${m.id ? $t('Edit goal') : $t('New goal')}</h2>${close}</div>
  ${m.id ? `<div class="hint">${esc(levelName({ ...goalById(m.id), period: m.period }))}</div>` : `<div class="mrow2" style="margin-top:0"><span class="lbl3">${$t('Level')}</span><div class="rad">${levels.map(([k, l, ok, whoCan]) => `<label class="${m.level === k ? 'on' : ''} ${ok ? '' : 'dis'}" title="${ok ? '' : esc($t('Only {who}', { who: whoCan }))}"><input type="radio" name="glvl" value="${k}" data-f="g.level" ${m.level === k ? 'checked' : ''} ${ok ? '' : 'disabled'}>${l}${ok ? '' : ` ${ico('lock', 12)}`}</label>`).join('')}
   ${m.level === 'project' ? `<select class="in" style="width:auto" data-f="g.project" aria-label="${$t('Project')}">${myProjects.map((x) => `<option value="${x.id}" ${m.project === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : ''}</div></div>`}
  <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:14px;margin-top:14px"><label class="fl">${$t('Period')}<select class="in" data-f="g.period">${periods.map((x) => `<option value="${x}" ${m.period === x ? 'selected' : ''}>${periodLabel(x)}</option>`).join('')}</select></label>
   <div class="fl">${$t('Type')}<div class="rad">${[['committed', 'Committed', $t('we deliver 100%')], ['aspirational', 'Aspirational', $t('70% is a success')]].map(([k, l, s]) => `<label class="${m.type === k ? 'on' : ''}"><input type="radio" name="gtyp" value="${k}" data-f="g.type" ${m.type === k ? 'checked' : ''}>${l} <span class="hint">${s}</span></label>`).join('')}</div></div></div>
  <label class="fl" style="margin-top:14px">${$t('Objective — a qualitative goal')}<input class="in" id="gTitle" value="${esc(m.title)}" placeholder="${m.level === 'member' ? $t('E.g. Launch 3 sequences people reply to') : $t('E.g. Prove that outreach sells')}"></label>
  <div class="mrow2"><span class="lbl3">${$t('Contributes to (a KR one level higher)')}</span>
   ${opts.length ? `<select class="in" data-f="g.align"><option value="">${$t('— choose a KR —')}</option>${opts.map(([lbl, krs]) => `<optgroup label="${esc(lbl)}">${krs.map((k) => `<option value="${k.id}" ${m.align === k.id ? 'selected' : ''}>${esc(k.title)} · ${fnum(k.current, k.unit)} / ${fnum(k.target, k.unit)}</option>`).join('')}</optgroup>`).join('')}</select>` : `<div class="hint">${top ? $t('The annual team goal is the top level. Organization goals will come later.') : $t('No goals one level higher in this period')}</div>`}
   ${top ? '' : `<div class="rad" style="margin-top:4px"><span class="hint" style="align-self:center">${$t('or not aligned on purpose:')}</span>${[['growth', $t('Growth')], ['bau', $t('Support / BAU')]].map(([k, l]) => `<label class="${m.reason === k ? 'on' : ''}"><input type="checkbox" data-f="g.reason" value="${k}" ${m.reason === k ? 'checked' : ''}>${l}</label>`).join('')}</div>`}
   ${!m.align && !m.reason && !top ? `<div class="awarn">${ico('warn', 13)} ${$t('Without alignment the goal is marked “Not aligned” and does not count toward Alignment.')}</div>` : ''}</div>
  <div class="mrow2"><span class="lbl3">${$t('Key Results — 2–5 measurable outcomes')}</span>
   <div class="krrow hint" style="font-size:12px;font-weight:600"><span>${$t('What we measure')}</span><span>${$t('Unit')}</span><span>${$t('From')}</span><span>${$t('To (target)')}</span><span>${$t('KR owner')}</span><span></span></div>
   ${m.krs.map((k, i) => `<div class="krrow"><input value="${esc(k.title)}" data-kr="${i}" data-kk="title" placeholder="${$t('E.g. MRR from outreach')}" aria-label="${$t('What we measure')}"><input value="${esc(k.unit)}" data-kr="${i}" data-kk="unit" placeholder="$" aria-label="${$t('Unit')}"><input type="number" step="any" value="${k.start}" data-kr="${i}" data-kk="start" aria-label="${$t('From')}"><input type="number" step="any" value="${k.target}" data-kr="${i}" data-kk="target" aria-label="${$t('To (target)')}"><select data-kr="${i}" data-kk="owner" aria-label="${$t('KR owner')}">${owners.replace(`value="${k.owner}"`, `value="${k.owner}" selected`)}</select><button class="btn ghost sm" data-a="krDel" data-v="${i}" aria-label="${$t('Remove')}">${ico('x', 13)}</button></div><div class="awarn" id="kw-${i}" style="${ACTIVITY.test(k.title.trim()) ? '' : 'display:none'}">${ico('warn', 13)} ${$t('This looks like a task, not an outcome. What will change in numbers once it is done?')}</div>`).join('')}
   <button class="btn sm" style="justify-self:start" data-a="krAdd">${ico('plus', 13)} Key Result</button></div>
  ${m.id ? `<div class="mrow2"><span class="lbl3">${$t('Status and end of the period')}</span><div class="grid" style="grid-template-columns:minmax(0,1fr) 110px;gap:10px"><select class="in" id="gStatus">${[['active', $t('Active')], ['done', $t('Period closed')], ['cancelled', $t('Cancelled')]].map(([k, l]) => `<option value="${k}" ${m.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select><input class="in" id="gScore" type="number" min="0" max="1" step="0.1" value="${m.score ?? ''}" placeholder="0.0–1.0" aria-label="${$t('Score')}"></div><textarea class="in" id="gRetro" rows="2" placeholder="${$t('Retro: why this result, what we carry over')}">${esc(m.retro || '')}</textarea></div>` : ''}
  <div class="mdf"><span class="hint" style="margin-right:auto">${m.level === 'member' ? $t('Personal goals help you focus. The whole team sees them; they are not used to assess work.') : ''}</span>${cancel}<button class="btn pri" data-a="goalSave">${m.id ? $t('Save') : $t('Create goal')}</button></div></div>`;
}
function syncGoalModal() {
  const m = S.modal; if (!m || m.k !== 'goal') return;
  const t = document.getElementById('gTitle'); if (t) m.title = t.value;
  document.querySelectorAll('[data-kr]').forEach((el) => { const k = m.krs[Number(el.dataset.kr)]; if (k) k[el.dataset.kk] = el.value; });
  for (const [id, key] of [['gStatus', 'status'], ['gScore', 'score'], ['gRetro', 'retro']]) { const el = document.getElementById(id); if (el) m[key] = el.value; }
}
const blankKr = () => ({ title: '', unit: '', start: 0, target: 0, owner: uid() });
function openGoalModal(opts = {}) {
  if (opts.id) {
    const g = goalById(opts.id); if (!g) return;
    S.modal = { k: 'goal', id: g.id, level: g.level, project: g.project, period: g.period, type: g.type, title: g.title, align: parentKr(g) || '', reason: g.unaligned?.reason || '', status: opts.close ? 'done' : g.status, score: g.score ?? (opts.close ? Math.round(gPct(g) * 10) / 10 : ''), retro: g.retro || '', krs: (g.keyResults || []).map((k) => ({ ...k })) };
  } else {
    let level = opts.level || (canTeamGoal() ? 'team' : 'member');
    if (level === 'team' && !canTeamGoal()) level = 'member';
    const project = opts.project || S.d.projects.find((x) => x.status !== 'archived' && canProjectGoal(x))?.id || null;
    if (level === 'project' && !canProjectGoal(prj(project))) { toast($t('Project goals are set by the project Owner or an Admin')); return; }
    const period = opts.period && (level === 'team' || opts.period.length > 4) ? opts.period : curPeriod();
    S.modal = { k: 'goal', level, project, period, type: 'committed', title: '', align: '', reason: '', krs: [blankKr()] };
    // A personal goal started from a project aligns with that project's first KR by default.
    if (opts.project && level === 'member') { const g = GL().find((x) => x.level === 'project' && x.project === opts.project && x.period === period); if (g?.keyResults?.[0]) S.modal.align = g.keyResults[0].id; }
  }
  S.drawer = null; S.goal = null; render();
}
async function saveGoalModal() {
  syncGoalModal(); const m = S.modal;
  if (!m.title.trim()) throw new Error($t('Write the objective'));
  const keyResults = m.krs.filter((k) => String(k.title).trim()).map((k) => ({ ...(k.id ? { id: k.id } : {}), title: k.title, unit: k.unit, start: Number(k.start) || 0, target: Number(k.target) || 0, owner: k.owner || uid() }));
  if (m.period.length > 4 && !keyResults.length) throw new Error($t('A quarterly goal needs at least one key result'));
  const body = { title: m.title, period: m.period, type: m.type, alignedTo: m.align ? [m.align] : [], unaligned: m.align ? null : m.reason || null, keyResults };
  let g;
  if (m.id) {
    Object.assign(body, { status: m.status, score: m.status === 'done' ? m.score : m.score === '' ? null : m.score, retro: m.retro });
    g = await api('PATCH', T(`/goals/${m.id}`), body);
    S.d.goals = GL().map((x) => (x.id === g.id ? g : x));
  } else {
    g = await api('POST', T('/goals'), { ...body, level: m.level, project: m.level === 'project' ? m.project : undefined });
    S.d.goals = [...GL(), g];
  }
  S.modal = null; if (g.period.length > 4) S.period = g.period; S.goal = g.id; render();
}

/* ---------- project ---------- */
function hypCard(h) {
  const ts = tasks().filter((t) => t.hypothesis === h.id), dn = ts.filter((t) => t.status === 'done').length;
  const k = krHit(h.kr)?.k; const [r] = rankIn(h);
  return `<div class="hyp" data-a="go" data-h="hyp-${h.id}"><div class="hc"><b>${hcode(h.id)}</b>${hypChip(h)}${h.from || h.to ? `<span class="hint">${fds(h.from)} – ${fds(h.to)}</span>` : ''}${h.priority && r ? `<span class="hint" style="margin-left:auto">#${r}</span>` : ''}${scb(h)}</div>
   ${stmt(h)}<div class="chips" style="margin-top:10px;align-items:center">${av(h.owner, 20)}<span class="hint">${esc(pn(h.owner))}</span>${h.metric ? `<span class="chip">${esc(h.metric)}: ${esc(h.current || '—')} / ${esc(h.target || '—')}</span>` : ''}<span class="chip">${$t('{done}/{total} tasks', { done: dn, total: ts.length })}</span>${k ? `<span class="al krchip">${ico('target', 12)}<span>${esc(k.title)}${h.expectedImpact ? ` +${fnum(h.expectedImpact, k.unit)}` : ''}</span></span>` : `<span class="al warn2">${$t('no KR')}</span>`}${qchip(h)}</div></div>`;
}
function projOverview(p) {
  const p0 = curPeriod();
  const gs = GL().filter((g) => g.level === 'project' && g.project === p.id && g.status !== 'cancelled').sort((a, b) => (a.period < b.period ? 1 : -1));
  const current = gs.filter((g) => g.period === p0);
  const memberGoals = GL().filter((g) => g.level === 'member' && g.status !== 'cancelled' && (g.project === p.id || current.some((x) => (x.keyResults || []).some((k) => (g.alignedTo || []).some((a) => a.krId === k.id)))));
  const can = canProjectGoal(p);
  const byPeriod = [...new Set(gs.map((g) => g.period))];
  const goalsHtml = byPeriod.map((per) => `<div class="persongrp">${periodLabel(per)}${per === curQ() ? ` <span class="hint">· ${$t('current quarter')}</span>` : ''}</div>${gs.filter((g) => g.period === per).map((g) => `<div class="gcard" data-a="goal" data-id="${g.id}"><div class="ghead"><div class="gt"><b>${esc(g.title)}</b><div class="gmeta">${typeChip(g.type)}${alignChip(g)}</div></div><div class="gpct">${P100(gPct(g))}<small>${$t('progress')}</small></div></div>
    <div class="krs">${(g.keyResults || []).map((k) => `${krRow(k)}<div style="display:flex;gap:6px;flex-wrap:wrap;padding:0 6px 8px 36px;align-items:center"><span class="hint">${$t('Moved by:')}</span>${hypsOfKr(k.id).sort(byScore).map((h) => `<button class="al" data-a="go" data-h="hyp-${h.id}">${scb(h)} ${hcode(h.id)} · ${HST[h.status]}</button>`).join('') || `<span class="rbadge r">${$t('no hypotheses')}</span>`}</div>`).join('')}</div></div>`).join('')}`).join('');
  const contrib = current.filter((g) => parentKr(g)).map((g) => { const { k, g: tg } = krHit(parentKr(g)); return `<div class="dk" data-a="goal" data-id="${tg.id}" style="cursor:pointer"><span class="x">${ico('route', 13)} <b>${esc(k.title)}</b> <span class="hint">· ${esc(tg.title)}</span></span>${pbar(k, '90px')}<span class="hint">${P100(krPct(k))}</span></div>`; }).join('');
  return `<div class="gsec" style="margin-top:22px"><h2>${$t('Project goals')}</h2><span class="line"></span>${can ? `<button class="btn sm" data-a="newGoal" data-level="project" data-proj="${p.id}">${ico('plus', 13)} ${$t('Project goal')}</button>` : `<span class="lockhint">${ico('lock', 13)} ${$t('Project goals are added by the project Owner or an Admin')}</span>`}</div>
   ${current.length ? `<div class="card" style="margin-bottom:12px"><h2>${$t('Contribution to team goals')} · ${periodLabel(p0)}</h2>${contrib || `<div class="al warn2">${$t('The project’s goals are not aligned with team goals')}</div>`}</div>` : ''}
   ${goalsHtml || `<div class="card"><div class="empty">${ico('warn')} ${$t('The project has no goals yet — it is not visible how it helps the team')}</div></div>`}
   <div class="gsec"><h2>${$t('Member goals in the project')}</h2><span class="line"></span>${(p.members || []).includes(uid()) ? `<button class="btn sm" data-a="newGoal" data-level="member" data-proj="${p.id}">${ico('plus', 13)} ${$t('My goal')}</button>` : ''}</div>
   ${memberGoals.map((g) => goalCard(g, { showLevel: true })).join('') || `<div class="empty">${$t('Members haven’t set goals that flow into this project yet')}</div>`}
   ${docsCardFor('project', p.id)}`;
}
function projHypsView(p, hs) {
  const testing = hs.filter((h) => h.status === 'testing').length;
  const view = S.hview || 'cards';
  const sorted = [...hs].sort(S.hsort === 'status' ? (a, b) => HYP_ORDER[a.status] - HYP_ORDER[b.status] || byScore(a, b) : S.hsort === 'date' ? (a, b) => (a.createdAt < b.createdAt ? 1 : -1) : byScore);
  const top2 = `<div class="chips" style="margin-bottom:14px;align-items:center"><button class="btn pri" data-a="newHyp" data-id="${p.id}">${ico('plus')}${$t('New hypothesis')}</button>
    <span class="seg sm">${[['cards', $t('Cards')], ['matrix', $t('2×2 matrix')], ['rank', $t('Ranking')]].map(([k, l]) => `<button class="${view === k ? 'on' : ''}" data-a="hview" data-v="${k}">${l}</button>`).join('')}</span>
    ${view === 'cards' ? `<span class="seg sm">${[['score', $t('By priority')], ['status', $t('By status')], ['date', $t('By date')]].map(([k, l]) => `<button class="${(S.hsort || 'score') === k ? 'on' : ''}" data-a="hsort" data-v="${k}">${l}</button>`).join('')}</span>` : ''}
    <span class="wip" style="margin-left:auto" title="${$t('No more than 3 hypotheses in “Testing” at once')}">${$t('Testing')} ${[0, 1, 2].map((i) => `<i class="${i < testing ? 'f' : ''}"></i>`).join('')} ${testing} / ${WIP_LIMIT} · ${$t('WIP limit')}</span></div>`;
  if (!hs.length) return top2 + `<div class="empty">${$t('No hypotheses yet')}</div>`;
  if (view === 'cards') return top2 + `<div class="grid g2">${sorted.map(hypCard).join('')}</div>`;
  if (view === 'rank') {
    const rows = [...hs].sort(byScore); const mx = Math.max(1, ...rows.map((h) => hscore(h) || 0));
    return top2 + `<div class="card" style="padding:4px 8px;overflow-x:auto"><table class="rk"><thead><tr><th>#</th><th>${$t('Hypothesis')}</th><th>${$t('Moves KR')}</th><th class="c" title="${$t('Impact')}">I</th><th class="c" title="${$t('Confidence')}">C</th><th class="c" title="${$t('Speed')}">S</th><th class="c">${$t('Cost')}</th><th>${$t('Priority')}</th></tr></thead><tbody>${rows.map((h, i) => `<tr class="click" data-a="go" data-h="hyp-${h.id}"><td>${h.priority ? i + 1 : '—'}</td><td><b>${hcode(h.id)}</b> ${esc(h.then)} <span class="hint">· ${HST[h.status]}</span></td><td class="hint">${esc(krHit(h.kr)?.k.title || '—')}</td>${h.priority ? `<td class="c">${h.priority.impact}</td><td class="c">${h.priority.confidence}</td><td class="c">${h.priority.speed}</td><td class="c">${hcost(h.priority)}</td><td style="white-space:nowrap"><span class="sbar" style="width:${Math.round((hscore(h) / mx) * 90)}px"></span> <b>${hscore(h)}</b></td>` : `<td class="c hint" colspan="5">${$t('not scored yet')}</td>`}</tr>`).join('')}</tbody></table></div>
    <p class="hint">${$t('Priority = Impact × Confidence × Speed ÷ Cost. Change it with the sliders on the hypothesis page.')}</p>`;
  }
  const scored = hs.filter((h) => h.priority);
  const bubbles = scored.map((h) => { const x = ((hcost(h.priority) - 1) / 9) * 100, y = Math.min(1, hvalue(h) / 50) * 88 + 4; const sz = 30 + h.priority.speed * 4; return `<div class="bub" data-a="go" data-h="hyp-${h.id}" style="left:${x}%;bottom:${y}%;width:${sz}px;height:${sz}px;background:${h.status === 'testing' ? 'var(--ink)' : '#8a8a85'}" title="${esc(h.then)}">${hcode(h.id)}<span>${hscore(h)}${krHit(h.kr) ? ' · ' + esc(krHit(h.kr).k.title) : ''}</span></div>`; }).join('');
  const vx = ((5 - 1) / 9) * 100, hy = (25 / 50) * 88 + 4;
  return top2 + `<div class="mxax"><div class="mxw">
    <div class="qd" style="left:0;top:0">Quick wins<small>${$t('high value, low cost — do first')}</small></div>
    <div class="qd" style="right:0;top:0;text-align:right">${$t('Big bets')}<small>${$t('valuable but costly — split into a cheaper test')}</small></div>
    <div class="qd" style="left:0;bottom:0">${$t('Cheap experiments')}<small>${$t('little evidence — check quickly')}</small></div>
    <div class="qd" style="right:0;bottom:0;text-align:right">${$t('Costly, little evidence')}<small>${$t('make it cheaper first or postpone')}</small></div>
    <div class="vl" style="left:${vx}%"></div><div class="hl2" style="bottom:${hy}%"></div>${bubbles}</div>
    <div class="ax" style="left:28px;right:0;bottom:6px;text-align:center">${$t('Cost: team time + money →')}</div><div class="ax" style="left:-4px;top:200px;transform:rotate(-90deg);transform-origin:left top">${$t('Value: Impact × Confidence →')}</div></div>
    <p class="hint">${$t('Bubble size is speed (bigger = sooner). Black ones are in “Testing”.')}${scored.length < hs.length ? ' ' + $t('{n} not scored yet.', { n: hs.length - scored.length }) : ''}</p>`;
}
const HYP_ORDER = { testing: 0, draft: 1, validated: 2, invalidated: 3 };
const WIP_LIMIT = 3;
function pProject(id) {
  const p = prj(id); if (!p) return `<div class="empty">${$t('Project not found')}</div>`;
  const ts = tasks().filter((t) => t.project === id), dn = ts.filter((t) => t.status === 'done').length;
  const hs = projHyps(id), ks = S.d.knowledge.filter((k) => k.project === id && !k.supersededBy);
  const ed = isAdmin();
  let b = '';
  if (S.ptab === 'overview') b = `<div class="grid g2"><div class="card"><h2>Vision ${ed ? `<button class="lnk" data-a="editProject" data-id="${id}">${$t('Edit')}</button>` : ''}</h2><p style="margin:0;font-size:16px;white-space:pre-wrap">${esc(p.vision || '—')}</p><div class="chips" style="margin-top:14px;align-items:center"><span class="hint">Owner</span>${av(p.owner)} ${esc(pn(p.owner))}<span class="hint" style="margin-left:10px">${$t('Members')}</span><span class="avs">${(p.members || []).map((m) => av(m)).join('')}</span></div></div>
  <div class="card"><h2>${$t('Task progress')}</h2><div style="font:800 36px Archivo,system-ui,sans-serif;font-stretch:112%">${dn}<span class="hint" style="font-size:18px"> / ${ts.length}</span></div><div class="prog"><i style="width:${ts.length ? (dn / ts.length) * 100 : 0}%"></i></div><div class="chips" style="margin-top:10px">${['open', 'progress', 'waiting'].map((s) => `<span class="chip">${STL[s]}: ${ts.filter((t) => t.status === s).length}</span>`).join('')}</div></div></div>
  ${projOverview(p)}`;
  else if (S.ptab === 'hyps') b = projHypsView(p, hs);
  else if (S.ptab === 'tasks') b = `<div class="card">${ts.map(trow).join('') || `<div class="empty">${$t('No tasks you can see')}</div>`}</div>`;
  else b = ks.map(knCard).join('') || `<div class="empty">${$t('No knowledge yet')}</div>`;
  return `<div class="hd"><div><div class="hint">${personal() ? $t('My space') : 'Team Space'} · ${$t('project')}</div><h1 style="display:flex;gap:10px;align-items:center"><span class="dot" style="--c:${p.color};width:14px;height:14px"></span>${esc(p.name)} ${prjChip(p)}</h1></div><div class="act"><button class="btn" data-a="newNote" data-proj="${id}">${ico('plus')} ${$t('Add note')}</button>${ed ? `<select class="in" data-f="pst" data-id="${id}" aria-label="${$t('Project status')}">${Object.entries(PST).map(([k, l]) => `<option value="${k}" ${k === p.status ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}<span class="seg">${[['overview', $t('Overview')], ['hyps', $t('Hypotheses') + ' · ' + hs.length], ['tasks', $t('Tasks') + ' · ' + ts.length], ['kn', $t('Knowledge') + ' · ' + ks.length]].map(([k, l]) => `<button class="${S.ptab === k ? 'on' : ''}" data-a="ptab" data-v="${k}">${l}</button>`).join('')}</span></div></div>${b}`;
}

/* ---------- hypothesis ---------- */
const PNAMES = () => ({ impact: [$t('Impact'), $t('how much it moves the KR')], confidence: [$t('Confidence'), $t('how sure we are — by evidence')], speed: [$t('Speed'), $t('how soon we see a result')], costTime: [$t('Team time'), $t('person-days')], costMoney: [$t('Money'), $t('budget, services')] });
function sliderRow(h, key, dis) {
  const [name, sub] = PNAMES()[key]; const v = prOf(h)[key];
  return `<div class="row"><div class="nm">${name}<small>${sub}</small></div><input type="range" min="1" max="10" step="1" value="${v}" data-r="${key}" ${dis ? 'disabled' : ''} aria-label="${name}"><div class="val" id="v-${key}">${v}</div><div class="anc" id="a-${key}">${ANC[key](v)}</div></div>`;
}
function formulaHtml(h) {
  const p = prOf(h);
  return `<span class="pill">${$t('Impact')} <b>${p.impact}</b></span><span class="op">×</span><span class="pill">${$t('Confidence')} <b>${p.confidence}</b></span><span class="op">×</span><span class="pill">${$t('Speed')} <b>${p.speed}</b></span><span class="op">=</span><span>${$t('value')} <b>${p.impact * p.confidence * p.speed}</b></span><span class="op">÷</span><span class="pill">${$t('Cost')} <b>${hcost(p)}</b></span><span class="op">=</span>${h.priority ? scb(h) : `<span class="scb">${Math.round((p.impact * p.confidence * p.speed) / hcost(p))}</span>`}`;
}
function cmpBars(h) {
  const list = projHyps(h.project).filter((x) => x.priority || x === h).sort((a, b) => (hscore(b) ?? 0) - (hscore(a) ?? 0)); const mx = Math.max(1, ...list.map((x) => hscore(x) || 0));
  return list.map((x) => `<div class="${x === h ? 'me2' : ''}"><span>${hcode(x.id)}</span><div class="pb"><i style="width:${((hscore(x) || 0) / mx) * 100}%;background:${x === h ? 'var(--ink)' : 'var(--line2)'}"></i></div><span>${hscore(x) ?? '—'}</span></div>`).join('');
}
function pHyp(id) {
  const h = hyp(id); if (!h) return `<div class="empty">${$t('Hypothesis not found')}</div>`;
  const ts = tasks().filter((t) => t.hypothesis === id), ks = S.d.knowledge.filter((k) => k.hypothesis === id), ed = canEditHyp(h);
  const verdict = h.verdict ? esc(h.verdict) : h.status === 'testing' ? (h.to ? $t('Still testing — verdict after {date}', { date: fds(h.to) }) : $t('Still testing')) : h.status === 'draft' ? $t('The hypothesis hasn’t started yet') : HST[h.status];
  const hit = krHit(h.kr), k = hit?.k, chain = k ? chainFromKr(h.kr) : [], ai = aiImpact(h), [r, n] = rankIn(h);
  const projKrs = GL().filter((g) => g.level === 'project' && g.project === h.project && g.status !== 'cancelled').flatMap((g) => (g.keyResults || []).map((x) => ({ x, g })));
  return `<div class="hd"><div><button class="btn ghost sm" data-a="go" data-h="project-${h.project}">${ico('back', 14)} ${esc(prj(h.project)?.name || $t('Project'))}</button><div class="chips" style="margin-top:10px;align-items:center"><b>${hcode(id)}</b>${hypChip(h)}${h.priority ? scb(h) : ''}</div></div><div class="act">${ed ? `<select class="in" data-f="hst" data-id="${id}" aria-label="${$t('Status')}">${Object.entries(HST).map(([k2, l]) => `<option value="${k2}" ${k2 === h.status ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="btn" data-a="editHyp" data-id="${id}">${$t('Edit')}</button><button class="btn ghost" data-a="delHyp" data-id="${id}" title="${$t('Delete')}">${ico('trash')}</button>` : `<span class="hint">${ico('lock', 13)} ${$t('{name} or an Admin can edit', { name: esc(pn(h.owner)) })}</span>`}</div></div>
  <div class="bigstmt" style="margin-bottom:24px">${stmtHtml(h)}</div>
  <div class="chips" style="margin-bottom:6px"><span class="chip big">${$t('Responsible:')} <b>${esc(pn(h.owner))}</b></span><span class="chip big">${esc(h.metric || $t('No metric set'))}: <b>${esc(h.current || '—')}</b> / ${esc(h.target || '—')}</span><span class="chip big">${h.from || h.to ? `${fds(h.from)} – ${fds(h.to)}` : $t('No timeframe set')}</span></div>
  <div class="hyp-grid">
   <div class="card prio"><h2>${ico('chart')} ${$t('Prioritization')} ${qchip(h, 'qchip')}<span style="margin-left:auto;display:flex;align-items:center;gap:10px"><span class="hint" id="rank">${h.priority ? $t('#{r} of {n} in the project', { r, n }) : $t('not scored yet')}</span><span id="bigscore">${scb(h, true)}</span></span></h2>
    ${ed ? '' : `<div class="lock">${ico('lock', 14)} ${$t('The estimates are changed by the responsible person ({name}) or an Admin', { name: esc(pn(h.owner)) })}</div>`}
    ${h.forecast ? `<div class="hint" style="margin-top:4px">${$t('Forecast fixed when testing started ({date}): priority {score}', { date: fds(h.forecast.at), score: h.forecast.score })}</div>` : ''}
    <div class="formula" id="formula">${formulaHtml(h)}</div>
    ${sliderRow(h, 'impact', !ed)}
    ${ai ? `<div class="aisug">${ico('spark', 13)} ${$t('Suggestion: +{imp} = {pct} of what is left to the KR target → {v}', { imp: fnum(h.expectedImpact, ai.k.unit), pct: P100(ai.r), v: ai.v })}${ed && ai.v !== prOf(h).impact ? ` <button class="btn sm" data-a="aiImp" data-id="${h.id}" data-v="${ai.v}">${$t('Accept {v}', { v: ai.v })}</button>` : ''}</div>` : ''}
    ${sliderRow(h, 'confidence', !ed)}
    ${sliderRow(h, 'speed', !ed)}
    <div class="row" style="margin-top:16px"><div class="nm">${$t('Cost')}<small>${$t('the average of the two below')}</small></div><div class="hint">${$t('the higher, the more expensive')}</div><div class="val" id="v-cost">${hcost(prOf(h))}</div></div>
    <div class="sub2">${sliderRow(h, 'costTime', !ed)}${sliderRow(h, 'costMoney', !ed)}</div>
    <details style="margin-top:16px"><summary style="cursor:pointer;font-weight:650">${$t('How to read the priority?')}</summary><div class="explain">
     <p><b>${$t('Priority shows how much progress toward the team goal we get per unit of time and money spent.')}</b></p>
     <p>${$t('The top is value: how much the hypothesis moves the KR (impact), how sure we are (confidence) and how soon we see the result (speed). The bottom is the price: team time and money.')}</p>
     <p>${$t('Multiplication means that one weak factor keeps a hypothesis from the top even with a big impact. The easiest way to raise priority is a cheap test that raises confidence.')}</p>
     <p class="hint">${$t('Based on ICE (Sean Ellis), RICE (Intercom), the Confidence Meter (Itamar Gilad) and Cost of Delay.')}</p></div></details>
    <div class="box"><h3>${$t('Comparison in the project')}</h3><div class="cmpbars" id="cmp">${cmpBars(h)}</div></div>
   </div>
   <div class="col">
    <div class="card"><h2>${ico('target')} ${$t('Moves the goal')}</h2>
     <div class="kv" style="margin-top:0"><span>${$t('Project KR')}</span>${projKrs.length ? `<select class="in" data-f="hkr" data-id="${h.id}" ${ed ? '' : 'disabled'}><option value="">${$t('— choose a KR —')}</option>${projKrs.map(({ x, g }) => `<option value="${x.id}" ${x.id === h.kr ? 'selected' : ''}>${esc(x.title)} · ${esc(g.title)} · ${periodLabel(g.period)}</option>`).join('')}</select>` : `<span class="hint">${$t('The project has no goals yet')}</span>`}
      <span>${$t('Expected contribution')}</span><span class="inl"><input class="in" style="width:110px" type="number" step="any" value="${h.expectedImpact ?? ''}" data-f="himp" data-id="${h.id}" ${ed ? '' : 'disabled'} aria-label="${$t('Expected contribution')}"> <span class="hint">${esc(k?.unit || $t('units'))} ${$t('over the hypothesis period')}</span></span></div>
     ${k ? `<div class="dk" data-a="goal" data-id="${hit.g.id}" style="cursor:pointer"><span class="x">${cd(k.confidence)} <b>${esc(k.title)}</b> <span class="hint">${fnum(k.current, k.unit)} / ${fnum(k.target, k.unit)}</span></span>${pbar(k, '90px')}</div>` : ''}
     <div class="path" style="margin-top:8px">${chain.slice(1).map((x) => `<button data-a="goal" data-id="${x.g.id}"><span class="arr">↳</span> <b>${esc(x.k.title)}</b> <span class="hint">· ${esc(x.g.title)}</span></button>`).join('')}</div>
     ${k ? (reachesTeam(h.kr) ? `<div class="route">${ico('check', 13)} ${$t('Reaches the team’s main goal')}</div>` : `<div class="al warn2">${$t('The KR is not aligned with team goals')}</div>`) : `<div class="al warn2">${$t('Choose the KR this hypothesis moves')}</div>`}</div>
    <div class="card"><h2>${$t('Criteria')}</h2><div class="kv" style="margin:0"><span>${$t('Signal')}</span><span>${esc(h.metric || '—')}: <b>${esc(h.current || '—')}</b> / ${esc(h.target || '—')}</span><span>${$t('Success')}</span><span>${esc(h.successCriteria || '—')}</span><span>${$t('Stop')}</span><span style="color:var(--red)">${esc(h.killCriteria || '—')}</span></div><p class="hint" style="margin-bottom:0">${$t('The signal is the hypothesis’s fast (leading) metric. The KR is the result it has to move.')}</p></div>
   </div></div>
  <div class="grid g2" style="margin-top:16px"><div class="card"><h2>${$t('Hypothesis tasks')} · ${ts.length}<button class="lnk" data-a="newTask" data-proj="${h.project}" data-hyp="${id}">${$t('+ Task')}</button></h2>${ts.map(trow).join('') || `<div class="empty">${$t('Link tasks from Review or from a task card')}</div>`}</div>
  <div class="card"><h2>${$t('Hypothesis knowledge')} · ${ks.length}<button class="lnk" data-a="newNote" data-proj="${h.project}" data-hyp="${id}">${$t('+ Note')}</button><button class="lnk" style="margin-left:0" data-a="newKn" data-proj="${h.project}" data-hyp="${id}">${$t('+ Knowledge')}</button></h2>${ks.map(knCard).join('') || `<div class="empty">${$t('No knowledge linked to this hypothesis yet')}</div>`}</div></div>
  ${docsCardFor('hypothesis', id)}
  <div class="card" style="margin-top:16px"><h2>Learnings</h2><div class="inl" style="margin-bottom:10px"><input class="in" id="learnTxt" style="flex:1" placeholder="${$t('What did we learn?')}"><button class="btn sm pri" data-a="addLearn" data-id="${id}">${$t('Add')}</button></div>${(h.learnings || []).map((l) => `<div style="padding:8px 0;border-bottom:1px solid var(--line)"><div class="hint">${fds(l.at)} · ${esc(pn(l.by))}</div>${esc(l.text)}</div>`).join('') || `<div class="empty">${$t('Learnings will appear here')}</div>`}<h3 style="margin:16px 0 6px">${$t('Verdict')}</h3><div class="hint">${verdict}</div></div>`;
}
// Live update of the prioritization block while a slider moves; the value is saved when it is released.
function onPriorityInput(el) {
  const h = hyp(R().slice(4)); if (!h) return;
  h.priority = { ...prOf(h), [el.dataset.r]: Number(el.value) };
  const set = (id, v, html) => { const e = document.getElementById(id); if (e) e[html ? 'innerHTML' : 'textContent'] = v; };
  set('v-' + el.dataset.r, el.value); set('a-' + el.dataset.r, ANC[el.dataset.r](Number(el.value)));
  set('v-cost', hcost(h.priority)); set('formula', formulaHtml(h), true); set('bigscore', scb(h, true), true); set('cmp', cmpBars(h), true);
  const [r, n] = rankIn(h); set('rank', $t('#{r} of {n} in the project', { r, n }));
  const q = document.getElementById('qchip'); if (q) { q.className = 'qchip ' + quad(h); q.textContent = QUAD[quad(h)]; }
}
async function saveHyp(id, body, ok) {
  return act(async () => { const h = await api('PATCH', T(`/hypotheses/${id}`), body); S.d.hypotheses = S.d.hypotheses.map((x) => (x.id === id ? h : x)); render(); return h; }, ok);
}

/* ---------- person ---------- */
function pPerson(id) {
  const m = M()[id]; if (!m) return `<div class="empty">${$t('Person not found')}</div>`;
  const iOwe = tasks().filter((t) => isOpen(t) && t.owner === uid() && t.requester === id), theyOwe = tasks().filter((t) => isOpen(t) && t.owner === id && t.requester === uid());
  return `<div class="hd"><div style="display:flex;gap:14px;align-items:center">${av(id, 52)}<div><h1>${esc(m.name)}</h1><div class="sub">${ROLE[m.role]} · ${esc(m.email || '')}</div></div></div></div>
  ${personGoals(id)}
  <div class="grid g2" style="margin-top:16px"><div class="card"><h2>${$t('Delegated to {name}', { name: esc(m.name) })} · ${theyOwe.length}</h2>${theyOwe.map(trow).join('') || `<div class="empty">${$t('Nothing')}</div>`}</div><div class="card"><h2>${$t('My tasks from {name}', { name: esc(m.name) })} · ${iOwe.length}</h2>${iOwe.map(trow).join('') || `<div class="empty">${$t('Nothing')}</div>`}</div></div>`;
}

function personGoals(id) {
  const p = curQ(), self = id === uid();
  const gs = GL().filter((g) => g.level === 'member' && g.member === id && g.period === p);
  const owned = allKrs().filter(({ k, g }) => k.owner === id && g.level !== 'member' && g.status === 'active' && (g.period === p || g.period === yearOf(p)));
  return `<div class="member-note">${ico('user', 16)} ${$t('Personal goals help to focus and show how a person helps projects. They are not used to assess work.')}</div>
  <div class="gsec" style="margin-top:8px"><h2>${$t('Goals · {period}', { period: periodLabel(p) })}</h2><span class="line"></span>${self ? `<button class="btn sm" data-a="newGoal" data-level="member">${ico('plus', 13)} ${$t('My goal')}</button>` : ''}</div>${gs.map((g) => goalCard(g)).join('') || `<div class="card"><div class="empty">${self ? $t('You have no goals for the quarter yet') : $t('No goals yet')}</div></div>`}
  ${owned.length ? `<div class="gsec"><h2>${$t('Key results they own')}</h2><span class="line"></span></div><div class="card">${owned.map(({ k, g }) => `<div class="dk" style="cursor:pointer" data-a="goal" data-id="${g.id}"><span class="x">${cd(k.confidence)} <b>${esc(k.title)}</b> <span class="hint">· ${esc(levelName(g))}</span></span>${pbar(k, '90px')}<span class="hint">${P100(krPct(k))}</span></div>`).join('')}</div>` : ''}`;
}

/* ---------- members ---------- */
function pMembers() {
  const ad = isAdmin(), own = role() === 'owner';
  const inv = S.d.team.invites || [];
  const yes = '✓', no = '—', own2 = $t('only tasks they set');
  const rights = [['', 'Owner', 'Admin', 'Member'], [$t('Invite, change roles'), yes, yes, no], [$t('Transfer ownership'), yes, no, no], [$t('See shared tasks between other people'), yes, yes, no], [$t('Create projects, edit Team vision'), yes, yes, no], [$t('Create hypotheses'), yes, yes, $t('own')], [$t('Set team goals'), yes, yes, no], [$t('Set project goals'), yes, yes, $t('project Owner')], [$t('Set personal goals (visible to the team)'), yes, yes, yes], [$t('Change a task’s status'), own2, own2, own2], [$t('See other people’s raw transcripts'), no, no, no]];
  return `<div class="hd"><div><h1>${$t('Members')}</h1><div class="sub">${esc(teamName(S.d.team))} · ${$p(S.d.members.length, 'member')}</div></div><div class="act">${own && S.d.members.length > 1 ? `<button class="btn" data-a="transfer">${$t('Transfer ownership')}</button>` : ''}${ad ? `<button class="btn pri" data-a="invite">${ico('plus')}${$t('Invite')}</button>` : ''}</div></div>
  <div class="card" style="padding:4px 6px;overflow-x:auto"><table class="mtable"><thead><tr><th>${$t('Person')}</th><th>Email</th><th>${$t('Role')}</th><th style="text-align:right">${$t('Open commitments')}</th><th></th></tr></thead><tbody>${S.d.members.map((m) => `<tr data-a="go" data-h="person-${m.id}"><td>${av(m.id, 26)} <b style="font-weight:600">${esc(m.name)}</b>${m.id === uid() ? ` <span class="hint">(${$t('you')})</span>` : ''}</td><td>${esc(m.email || '')}</td><td>${ad && m.role !== 'owner' && m.id !== uid() ? `<select class="in" data-f="role" data-id="${m.id}" aria-label="${$t('Role')}"><option value="admin" ${m.role === 'admin' ? 'selected' : ''}>Admin</option><option value="member" ${m.role === 'member' ? 'selected' : ''}>Member</option></select>` : ROLE[m.role]}</td><td style="text-align:right">${tasks().filter((t) => isOpen(t) && t.owner === m.id).length}</td><td style="text-align:right">${m.role !== 'owner' && (ad || m.id === uid()) ? `<button class="btn ghost sm" data-a="removeMember" data-id="${m.id}">${m.id === uid() ? $t('Leave') : $t('Remove')}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
  ${ad ? `<div class="card" style="margin-top:16px"><h2>${$t('Invite links')}</h2>${inv.length ? inv.map((i) => `<div class="lnkbox">${ico('link')}<code>${esc(location.origin)}/join/${esc(i.token)}</code><span class="chip">${ROLE[i.role]}</span>${i.email ? `<span class="hint">${esc(i.email)}</span>` : `<span class="hint">${$t('reusable')}</span>`}<button class="btn sm" data-a="copyInv" data-v="${esc(i.token)}">${$t('Copy')}</button><button class="btn ghost sm" data-a="revokeInv" data-v="${esc(i.token)}">${$t('Revoke')}</button></div>`).join('') : `<div class="hint">${$t('No active invites. Create a link and send it to people through any channel.')}</div>`}</div>` : ''}
  ${orgCard()}
  <div class="card" style="margin-top:16px"><h2>${$t('Who sees what')}</h2><table><tbody style="cursor:default">${rights.map((r, ri) => `<tr style="cursor:default">${r.map((c, i) => `<td${i ? ' style="color:var(--mut)"' : ''}>${ri === 0 ? `<b>${c}</b>` : c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function orgCard() {
  const o = S.d.org && S.orgs.find((x) => x.id === S.d.org.id); if (!o) return '';
  return `<div class="card" style="margin-top:16px"><h2>${ico('org')} ${$t('Organization')} · ${esc(o.name)}${o.role ? `<button class="lnk" data-a="renameOrg" data-id="${o.id}">${$t('Rename')}</button>` : ''}</h2><p class="hint" style="margin-top:0">${o.role ? $t('You are {role} of the organization: you can create teams in it and see its teams. This gives no access to their content.', { role: ROLE[o.role] }) : $t('The organization groups the company’s teams. You see only the teams you are on.')}</p><div class="org-teams">${o.teams.map((t) => `<div>${ico('users', 14)} <b>${esc(t.name)}</b> <span class="hint">· Owner: ${esc(t.owner)}${t.member ? '' : ' · ' + $t('you are not on this team')}</span></div>`).join('')}</div>${o.role ? `<button class="btn sm" style="margin-top:10px" data-a="newTeam">${ico('plus', 13)} ${$t('Team')}</button>` : ''}</div>`;
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
  if (S.goal && S.d && !S.drawer) return goalDrawer(el);
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
  <span>${$t('Hypothesis')}</span>${selHyp(`class="in" data-f="t.hypothesis" ${ro} aria-label="${$t('Hypothesis')}"`, t.hypothesis, t.project)}
  ${t.hypothesis && krHit(hyp(t.hypothesis)?.kr) ? '' : `<span>${$t('Key result')}</span>${selKr(`class="in" data-f="t.kr" ${ro} aria-label="${$t('Key result')}"`, t.kr)}`}
  <span>${$t('Works toward')}</span><span>${worksToward(t)}</span></div>
  <label class="fl">${$t('Description')}<textarea class="in" rows="3" data-f="t.description" ${ce ? '' : 'readonly'}>${esc(t.description || '')}</textarea></label>
  ${t.source ? `<div class="box"><h3>${$t('Source')}</h3>${t.source.quote ? `<div class="quote">“${esc(t.source.quote)}”</div>` : ''}<div class="hint" style="margin-top:6px">${esc(t.source.itemTitle)}${t.source.ts ? ' · ' + esc(t.source.ts) : ''} · ${srcOf(t.source.sourceId) ? `<button class="btn ghost sm" data-a="go" data-h="source-${t.source.sourceId}">${ico(srcIco(srcOf(t.source.sourceId).kind), 13)} ${$t('Open source')}</button>` : srcOwn ? `<button class="btn ghost sm" data-a="go" data-h="review-${t.source.itemId}">${$t('View')}</button>` : `${ico('lock', 12)} ${$t('only the person who added it sees the full text')}`}</div></div>` : ''}
  <div class="box"><h3>${$t('Comments')} · ${t.comments.length}</h3>${t.comments.map((c) => `<div class="cm">${av(c.author, 26)}<div><b>${esc(pn(c.author))}</b> <span class="when">${fdt(c.at)}</span><div style="white-space:pre-wrap">${esc(c.text)}</div></div></div>`).join('')}<textarea class="in" id="cmt" rows="2" placeholder="${ce ? $t('Comment…') : $t('Write what’s done or what’s blocking…')}"></textarea><div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn pri sm" data-a="comment">${$t('Send')}</button></div></div>
  <div class="box"><h3>${$t('History')}</h3><div class="hist">${t.history.slice().reverse().map((h) => `<div><b style="color:var(--ink)">${fdt(h.at)}</b> · ${esc(pn(h.by))}: ${esc(h.text)}${h.source ? ` <span>(${esc(h.source)})</span>` : ''}</div>`).join('')}</div></div></div>`;
  el.classList.add('on'); el.setAttribute('aria-hidden', 'false');
}

// "Works toward": task → hypothesis → project KR → team KR. Computed, not edited.
function worksToward(t) {
  const k = taskKr(t); if (!k) return `<span class="al warn2">${$t('not linked to a goal')}</span>`;
  const chain = chainFromKr(k);
  const parts = [...(t.hypothesis && hyp(t.hypothesis)?.kr === k ? [`<b>${hcode(t.hypothesis)}</b>`] : []), ...chain.map((x) => `<button class="lnk" style="margin:0" data-a="goal" data-id="${x.g.id}">${esc(x.k.title)}</button>${x.g.level === 'team' ? ` <span class="hint">(${$t('team goal')})</span>` : ''}`)];
  return `<span class="inl" style="flex-wrap:wrap">${parts.join(' → ')}${reachesTeam(k) ? '' : ` <span class="al warn2">${$t('does not reach a team goal')}</span>`}</span>`;
}
const selKr = (attrs, val) => `<select ${attrs}><option value="">${$t('No key result')}</option>${GL().filter((g) => g.status === 'active').map((g) => `<optgroup label="${esc(periodLabel(g.period) + ' · ' + g.title)}">${(g.keyResults || []).map((k) => `<option value="${k.id}" ${k.id === val ? 'selected' : ''}>${esc(k.title)}</option>`).join('')}</optgroup>`).join('')}</select>`;

/* ---------- modals ---------- */
function taskShareContent(m) {
  if (m.pending) return `<p class="hint" role="status">${$t('Loading…')}</p>`;
  if (m.error) return `<p class="err" role="alert">${esc(m.error)}</p><div class="mdf"><button class="btn" data-a="retryTaskShare">${$t('Try again')}</button></div>`;
  return `<p class="hint">${$t('Anyone with the link can open the task in read-only mode, including its comments and history. The task status stays private.')}</p>
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
    h = `<div class="md"><div class="mdh"><h2>${$t('New task')}</h2>${close}</div><div class="grid" style="gap:12px"><label class="fl">${$t('What to do')}<input class="in" id="ntT" placeholder="${$t('E.g. Prepare the investor report')}"></label><div class="grid g2" style="gap:12px"><label class="fl">${$t('Owner')}${selWho('class="in" id="ntO" data-f="ntWho"', m.owner || uid())}</label><label class="fl">${$t('Requester')}<select class="in" id="ntR" data-f="ntWho"><option value="${uid()}">${$t('Me')}</option>${isExt(m.requester) ? `<option value="${esc(m.requester)}" selected>${esc(m.requester.slice(4))} (${$t('ext.')})</option>` : ''}<option value="__ext">${$t('+ External contact…')}</option></select></label><label class="fl">${$t('Deadline')}<input type="date" class="in" id="ntD"></label><label class="fl">${$t('Project')}${selProj('class="in" id="ntP" data-f="placementProject" data-target="ntH"', m.proj || '')}</label><label class="fl">${$t('Hypothesis')}${selHyp('class="in" id="ntH"', m.hyp || '', m.proj)}</label><label style="display:flex;gap:8px;align-items:center;padding-top:20px"><input type="checkbox" id="ntI" checked> ${$t('Important')}</label></div><label class="fl">${$t('Description')}<textarea class="in" id="ntDesc" rows="2"></textarea></label><p class="hint" style="margin:0">${$t('The requester changes the status. If the requester is external, you change it.')}</p></div><div class="mdf">${cancel}<button class="btn pri" data-a="ntGo">${$t('Create')}</button></div></div>`;
  } else if (m.k === 'project') {
    const p = m.id ? prj(m.id) : { name: '', vision: '', goals: [], members: [uid()], owner: uid() };
    h = `<div class="md wide"><div class="mdh"><h2>${m.id ? $t('Edit project') : $t('New project')}</h2>${close}</div><div class="grid" style="gap:12px"><label class="fl">${$t('Project name')}<input class="in" id="pjN" value="${esc(p.name)}"></label><label class="fl">Vision<textarea class="in" id="pjV" rows="3">${esc(p.vision || '')}</textarea></label><label class="fl">Owner${selWho('class="in" id="pjO"', p.owner, false)}</label><div class="fl">${$t('Members')}<div class="cklist" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">${S.d.members.map((x) => `<label><input type="checkbox" class="pjM" value="${x.id}" ${(p.members || []).includes(x.id) ? 'checked' : ''}>${esc(x.name)}</label>`).join('')}</div></div>
    <p class="hint" style="margin:0">${ico('target', 13)} ${$t('Project goals with key results are set on the project page, in the Goals section.')}</p></div>
    <div class="mdf">${m.id ? `<button class="btn ghost danger" style="margin-right:auto" data-a="delProject" data-id="${m.id}">${$t('Delete')}</button>` : ''}${cancel}<button class="btn pri" data-a="pjGo">${m.id ? $t('Save') : $t('Create')}</button></div></div>`;
  } else if (m.k === 'hyp') {
    const x = m.id ? hyp(m.id) : { if: '', then: '', because: '', project: m.project, owner: uid(), metric: '', target: '', current: '', from: '', to: '', verdict: '', kr: '', expectedImpact: '', successCriteria: '', killCriteria: '' };
    const krOpts = GL().filter((g) => g.level === 'project' && g.project === x.project && g.status !== 'cancelled').flatMap((g) => (g.keyResults || []).map((k) => `<option value="${k.id}" ${k.id === x.kr ? 'selected' : ''}>${esc(k.title)} · ${esc(g.title)}</option>`)).join('');
    h = `<div class="md"><div class="mdh"><h2>${m.id ? $t('Edit hypothesis') : $t('New hypothesis')}</h2>${close}</div><div class="grid" style="gap:12px"><label class="fl">${$t('If… (action)')}<input class="in" id="hyIf" value="${esc(x.if)}" placeholder="${$t('we give 100 free calls a month')}"></label><label class="fl">${$t('then… (result)')}<input class="in" id="hyThen" value="${esc(x.then)}" placeholder="${$t('≥ 30% will move to a paid plan')}"></label><label class="fl">${$t('because… (assumption)')}<input class="in" id="hyBo" value="${esc(x.because || '')}"></label>
    <div class="grid g2" style="gap:12px"><label class="fl">${$t('Project')}${selProj('class="in" id="hyP"', x.project)}</label><label class="fl">${$t('Responsible')}${isAdmin() ? selWho('class="in" id="hyO"', x.owner, false) : `<input class="in" disabled value="${esc(pn(x.owner))}">`}</label><label class="fl">${$t('Success metric')}<input class="in" id="hyM" value="${esc(x.metric || '')}"></label><label class="fl">${$t('Target')}<input class="in" id="hyT" value="${esc(x.target || '')}"></label><label class="fl">${$t('Current value')}<input class="in" id="hyC" value="${esc(x.current || '')}"></label><span></span><label class="fl">${$t('Start')}<input class="in" type="date" id="hyF" value="${x.from || ''}"></label><label class="fl">${$t('End')}<input class="in" type="date" id="hyTo" value="${x.to || ''}"></label>
    <label class="fl">${$t('Moves the project KR')}<select class="in" id="hyKr"><option value="">${krOpts ? $t('— choose a KR —') : $t('The project has no goals yet')}</option>${krOpts}</select></label><label class="fl">${$t('Expected contribution to the KR')}<input class="in" type="number" step="any" id="hyImp" value="${x.expectedImpact ?? ''}"></label>
    <label class="fl">${$t('Success criterion')}<input class="in" id="hySc" value="${esc(x.successCriteria || '')}" placeholder="${$t('≥ 20 good replies a month')}"></label><label class="fl">${$t('Stop criterion')}<input class="in" id="hyKc" value="${esc(x.killCriteria || '')}" placeholder="${$t('< 5 replies in the first 2 weeks')}"></label></div>
    <p class="hint" style="margin:0">${$t('Score the priority with the sliders on the hypothesis page once it is created.')}</p>
    ${m.id ? `<label class="fl">${$t('Verdict')}<textarea class="in" id="hyV" rows="2">${esc(x.verdict || '')}</textarea></label>` : ''}</div><div class="mdf">${cancel}<button class="btn pri" data-a="hyGo">${m.id ? $t('Save') : $t('Create')}</button></div></div>`;
  } else if (m.k === 'goal') {
    h = goalModalHtml(m, close, cancel);
  } else if (m.k === 'note') {
    h = `<div class="md"><div class="mdh"><h2>${$t('Add note')}</h2>${close}</div><label class="fl">${$t('Note')}<textarea class="in" id="noteText" rows="5" maxlength="1000" placeholder="${$t('Write your note…')}"></textarea></label><p class="hint">${$t('The note will be saved as knowledge in this context.')}</p>${personal() ? '' : `<label class="fl">${$t('Visibility')}<select class="in" id="noteScope"><option value="team">${$t('Team')}</option><option value="private">${$t('Only me')}</option></select></label>`}<div class="mdf">${cancel}<button class="btn pri" data-a="saveNote">${$t('Save')}</button></div></div>`;
  } else if (m.k === 'kn') {
    const k = m.id ? S.d.knowledge.find((x) => x.id === m.id) : { type: 'decision', text: '', why: '', scope: 'team', project: m.proj || '', hypothesis: m.hyp || '' };
    h = `<div class="md"><div class="mdh"><h2>${m.id ? $t('Edit knowledge') : $t('Add knowledge')}</h2>${close}</div><div class="grid" style="gap:12px"><label class="fl">${$t('Type')}<select class="in" id="nkT">${Object.entries(KT).map(([a, l]) => `<option value="${a}" ${a === k.type ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="fl">${$t('Text')}<textarea class="in" id="nkX" rows="3">${esc(k.text)}</textarea></label><label class="fl">${$t('Why (optional)')}<input class="in" id="nkW" value="${esc(k.why || '')}"></label><div class="grid g2" style="gap:12px">${personal() ? '' : `<label class="fl">${$t('Visibility')}<select class="in" id="nkS"><option value="team">${$t('Team')}</option><option value="private" ${k.scope === 'private' ? 'selected' : ''}>${$t('Only me')}</option></select></label>`}<label class="fl">${$t('Project')}${selProj('class="in" id="nkP" data-f="placementProject" data-target="nkH"', k.project)}</label><label class="fl">${$t('Hypothesis')}${selHyp('class="in" id="nkH"', k.hypothesis, k.project)}</label></div></div><div class="mdf">${cancel}<button class="btn pri" data-a="nkGo">${$t('Save')}</button></div></div>`;
  } else if (m.k === 'taskShare') {
    h = `<div class="md" id="task-share-dialog" role="dialog" aria-modal="true" aria-labelledby="task-share-heading" tabindex="-1"><div class="mdh"><h2 id="task-share-heading">${$t('Share task')}</h2>${close}</div>${taskShareContent(m)}</div>`;
  } else if (m.k === 'invite') {
    h = `<div class="md"><div class="mdh"><h2>${$t('Invite to {team}', { team: esc(teamName(S.d.team)) })}</h2>${close}</div><label class="fl">${$t('Role')}<select class="in" id="invR"><option value="member">${$t('Member — sees their own tasks and team knowledge')}</option><option value="admin">${$t('Admin — sees everything, manages members')}</option></select></label><label class="fl" style="margin-top:12px">${$t('Email (optional — then the link works only for that address)')}<input class="in" id="invE" placeholder="name@company.com"></label><p class="hint">${$t('TeamOS doesn’t send emails in v0.1 — copy the link and send it yourself.')}</p>${m.link ? `<div class="lnkbox">${ico('link')}<code>${esc(m.link)}</code><button class="btn sm" data-a="copyText" data-v="${esc(m.link)}">${$t('Copy')}</button></div>` : ''}<div class="mdf"><button class="btn" data-a="closeM">${$t('Done')}</button><button class="btn pri" data-a="invGo">${$t('Create link')}</button></div></div>`;
  } else if (m.k === 'transfer') {
    h = `<div class="md"><div class="mdh"><h2>${$t('Transfer ownership')}</h2>${close}</div><p class="hint" style="font-size:14.5px">${$t('The new Owner gets full control, and you become an Admin.')}</p><label class="fl">${$t('To')}<select class="in" id="trTo">${S.d.members.filter((x) => x.id !== uid()).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label><label class="fl" style="margin-top:12px">${$t('Type the team name “{team}” to confirm', { team: esc(S.d.team.name) })}<input class="in" id="trC" data-f="trC" autocomplete="off"></label><div class="mdf">${cancel}<button class="btn pri" id="trBtn" data-a="trGo" disabled>${$t('Transfer')}</button></div></div>`;
  } else if (m.k === 'team') {
    const orgs = S.orgs.filter((o) => o.role);
    const sel = m.org || orgs[0]?.id || 'new';
    h = `<div class="md"><div class="mdh"><h2>${$t('New team')}</h2>${close}</div><label class="fl">${$t('Team name')}<input class="in" id="ntmN" value="${esc(m.name || '')}" placeholder="${$t('E.g. Linxa Team')}"></label>
    ${orgs.length ? `<div class="mrow2"><span class="lbl3">${$t('Organization')}</span>${orgs.map((o) => `<label class="opt ${sel === o.id ? 'on' : ''}" style="margin-bottom:8px"><input type="radio" name="torg" value="${o.id}" data-f="torg" ${sel === o.id ? 'checked' : ''} style="accent-color:var(--ink)"><span>${ico('org')} <b>${esc(o.name)}</b><br><span class="hint">${o.teams.map((t) => esc(t.name)).join(' · ')}</span></span></label>`).join('')}<label class="opt ${sel === 'new' ? 'on' : ''}"><input type="radio" name="torg" value="new" data-f="torg" ${sel === 'new' ? 'checked' : ''} style="accent-color:var(--ink)"><span style="flex:1">${ico('plus')} <b>${$t('New organization')}</b>${sel === 'new' ? `<input class="in" id="ntmOrg" style="margin-top:8px;width:100%" value="${esc(m.orgName || '')}" placeholder="${$t('Organization name')}">` : `<br><span class="hint">${$t('a separate company or client')}</span>`}</span></label></div><p class="hint">${$t('An organization only groups teams. It gives no access to other teams’ tasks, knowledge or goals.')}</p>` : `<p class="hint">${$t('An organization with the same name is created together with your first team. You can rename it later.')}</p>`}
    <p class="hint">${$t('You become the Owner. The team gets its own folder, and your folder gets a subfolder for it.')}</p><div class="mdf">${cancel}<button class="btn pri" data-a="ntmGo">${$t('Create')}</button></div></div>`;
  } else if (m.k.startsWith('doc.')) {
    h = docModal(m, close, cancel);
  } else if (m.k === 'ask') {
    h = `<div class="md wide"><div style="display:flex;gap:10px;align-items:center">${ico('search', 18)}<input class="in" id="askq" data-f="askq" style="flex:1;border:0;font-size:17px" placeholder="${$t('Find a task, decision, hypothesis…')}" value="${esc(m.q || '')}" autocomplete="off"><kbd>Esc</kbd></div><div id="askr">${askRes(m.q || '')}</div></div>`;
  }
  el.innerHTML = `<div class="ov" data-a="ovClose">${h}</div>`;
  const f = el.querySelector('#askq,#addTxt,#ntT,#ntmN,#nkX,#noteText,#pjN,#hyIf,#gTitle,#npTitle,#pmText,#eaText,#rjText,#naTitle,#aeText,#exNote,#colTitle'); if (f && !m.focused) { m.focused = true; setTimeout(() => f.focus(), 20); }
}
function askRes(q) {
  q = q.trim().toLowerCase();
  if (!q) return `<div class="res"><div class="hint" style="padding:8px">${$t('Search tasks, knowledge, hypotheses and projects')}</div></div>`;
  const ts = tasks().filter((t) => t.title.toLowerCase().includes(q) || pnx(t.owner).toLowerCase().includes(q)).slice(0, 8);
  const ks = S.d.knowledge.filter((k) => !k.supersededBy && (k.text + ' ' + (k.why || '')).toLowerCase().includes(q)).slice(0, 6);
  const hs = S.d.hypotheses.filter((h) => (h.statement || '').toLowerCase().includes(q)).slice(0, 4);
  const ps = S.d.projects.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 4);
  return `<div class="res">${ps.map((p) => `<button class="trow" data-a="go" data-h="project-${p.id}"><span class="dot" style="--c:${p.color}"></span><span class="tt"><b>${esc(p.name)}</b></span></button>`).join('')}${ts.map(trow).join('')}${hs.map((h) => `<button class="trow" data-a="go" data-h="hyp-${h.id}"><span class="chip">${hcode(h.id)}</span><span class="tt"><b>${stmtHtml(h)}</b></span></button>`).join('')}${ks.map((k) => `<div class="trow" style="cursor:default"><span class="ty ${k.type}">${KT[k.type]}</span><span class="tt"><b>${esc(k.text)}</b></span></div>`).join('')}${!ts.length && !ks.length && !hs.length && !ps.length ? `<div class="hint" style="padding:8px">${$t('Nothing found')}</div>` : ''}</div>`;
}

/* ---------- processes & agreements (docs/02-processes-and-agreements-vision.md) ---------- */
const PCS = () => S.d?.processes || [];
const AGS = () => S.d?.agreements || [];
const pcById = (id) => PCS().find((p) => p.id === id);
const agById = (id) => AGS().find((a) => a.id === id);
const PSECS = ['purpose', 'trigger', 'roles', 'inputs', 'steps', 'output', 'metric', 'exceptions', 'review'];
const SECL = translated({ purpose: 'Purpose', trigger: 'Trigger', roles: 'Roles', inputs: 'Inputs', steps: 'Steps', output: 'Result and definition of done', metric: 'Metric', exceptions: 'Exceptions', review: 'Review frequency', summary: 'Summary' });
const SECHINT = translated({ purpose: 'Why this process exists and what breaks without it.', trigger: 'When it starts: an event, a schedule or a condition.', roles: 'Who does it, who is accountable, who is consulted and who is informed.', inputs: 'What has to be ready at the start.', steps: 'What we do, in order.', output: 'How we know the process is complete.', metric: 'How we know the process works.', exceptions: 'What to do when something goes wrong.', review: 'When the owner reviews the process itself.', summary: 'One or two sentences about the process.' });
const PLEVEL = translated({ org: 'Organization', team: 'Team', project: 'Project', hypothesis: 'Hypothesis' });
const PVIS = translated({ owner: 'Owner only', owner_admin: 'Owner and Admin', all: 'Everyone' });
const AKIND = translated({ add: 'Add', extend: 'Extend', replace: 'Replace', remove: 'Remove' });
const AKCLS = { add: 'add', extend: 'ext', replace: 'rep', remove: 'rem' };
const ATYPE = translated({ partnership: 'Partnership agreement', roles: 'Roles and responsibilities', team_rules: 'Team rules', other: 'Other' });
const AST = translated({ draft: 'Draft', pending: 'Waiting for consent', in_force: 'In force', needs_review: 'Needs a full review', terminated: 'Terminated' });
const astChip = (a) => `<span class="chip ${({ pending: 'amber', in_force: 'green', needs_review: 'red' })[a.status] || ''}">${!a.current && a.status === 'pending' ? $t('First version waiting for consent') : AST[a.status]}</span>`;
const pcOwnerOf = (p) => (p.level === 'hypothesis' ? hyp(p.hypothesis)?.owner : p.level === 'project' ? prj(p.project)?.owner : null);
function approverLabel(p) {
  if (p.level === 'org') return p.visibility === 'owner' ? $t('Organization Owner') : $t('Organization Owner / Admin');
  if (p.level === 'team') return $t('Team Owner / Admin');
  const owner = pcOwnerOf(p);
  if (!owner || !p.approvers.includes(owner)) return $t('Team Owner / Admin');
  return `${esc(pn(owner))} · ${p.level === 'hypothesis' ? $t('responsible for the hypothesis') : $t('project owner')}`;
}
const pcLevelChip = (p) => `<span class="chip ${p.level === 'org' ? 'ink' : ''}">${p.level === 'org' ? ico('org', 12) + ' ' : ''}${PLEVEL[p.level]}</span>${p.project ? tag(p.project) : ''}${p.hypothesis ? `<span class="chip">${hcode(p.hypothesis)}</span>` : ''}${p.level === 'org' ? `<span class="chip" title="${$t('Who sees it and can propose changes')}">${ico(p.visibility === 'all' ? 'users' : 'lock', 12)} ${PVIS[p.visibility]}</span>` : ''}`;
const covBar = (n, total) => `<span class="cov" title="${$t('Completeness by TeamOS Advocate')}">${ico('shield', 13)} <span class="pb"><i style="width:${Math.round((n / total) * 100)}%"></i></span> ${n}/${total}</span>`;
const procBadge = () => PCS().reduce((n, p) => n + p.needsMe, 0);
const agrBadge = () => AGS().filter((a) => a.needsMe).length;
const uncollected = () => { const done = new Set(PCS().flatMap((p) => p.fromKnowledge || [])); return S.d.knowledge.filter((k) => k.type === 'process' && (k.scope === 'team' || personal()) && !k.supersededBy && !done.has(k.id)); };

// Sources the draft can be generated from: shared ones only, since everyone who sees the process sees the draft.
const draftSources = () => (S.d.sources || []).filter((x) => personal() || x.scope === 'team');
const draftOpts = (sel) => `<option value="knowledge" ${sel === 'knowledge' ? 'selected' : ''}>${$t('The whole knowledge base')}</option>${draftSources().map((x) => `<option value="src:${x.id}" ${sel === 'src:' + x.id ? 'selected' : ''}>${esc(x.title)} · ${fds(x.date)}</option>`).join('')}`;
function draftBox(p) {
  if (!p.canPropose || !S.ai) return '';
  const busy = S.draftBusy === p.id;
  return `<div class="note gen">${ico('spark')}<span style="flex:1;min-width:200px"><b>${$t('Generate a draft')}</b><br>${$t('AI fills in what is missing from a meeting, a document or the whole knowledge base. Everything arrives as proposed changes with quotes — nothing changes until it is accepted.')}</span>
   <span class="gen-row"><select class="in" id="genFrom" ${busy ? 'disabled' : ''}>${draftOpts(S.genFrom || 'knowledge')}</select><button class="btn sm pri" data-a="genDraft" data-id="${p.id}" ${busy ? 'disabled' : ''}>${busy ? `<span class="spin"></span> ${$t('Generating…')}` : $t('Generate')}</button></span></div>`;
}
const runDraft = async (id, from) => {
  const body = from === 'knowledge' ? { from: 'knowledge' } : { from: 'source', sourceId: from.slice(4) };
  S.draftBusy = id; render();
  try { const r = await api('POST', T(`/processes/${encodeURIComponent(id)}/draft`), body); putPc(r.process); S.dtab[id] = 'changes'; toast($t('{n} proposed — check them in “Changes”', { n: $p(r.added, 'change') })); }
  catch (e) { toast(e.message); }
  finally { S.draftBusy = null; render(); }
};
function procRow(p) {
  const me = p.needsMe;
  return `<button class="row ${me ? 'me' : ''}" data-a="go" data-h="process-${p.id}">
   <span class="tt"><b>${esc(p.title)}</b><span class="s">${esc(p.summary || p.sections.purpose || '')}</span>
    <span class="chips" style="margin-top:6px">${pcLevelChip(p)}<span class="hint">${$t('Approves:')} ${approverLabel(p)}</span></span></span>
   <span class="rt">${p.status === 'draft' ? `<span class="chip amber">${$t('Draft · waiting for approval')}</span>` : p.status === 'retired' ? `<span class="chip">${$t('Retired')}</span>` : `<span class="chip">v${p.version}</span>`}
    ${p.pending ? `<span class="chip ${me ? 'red' : 'amber'}">${$p(p.pending, 'change')}${me ? ` · ${$t('for you')}` : ''}</span>` : ''}${covBar(p.coverage, 9)}</span></button>`;
}
function pProcesses() {
  const f = (p) => (S.plvl || 'all') === 'all' || p.level === S.plvl;
  const live = PCS().filter((p) => p.status !== 'retired' && f(p)), retired = PCS().filter((p) => p.status === 'retired' && f(p));
  const org = live.filter((p) => p.level === 'org'), team = live.filter((p) => p.level === 'team');
  const byProj = S.d.projects.map((pp) => ({ pp, list: live.filter((p) => ['project', 'hypothesis'].includes(p.level) && p.project === pp.id).sort((a, b) => (a.level === 'hypothesis') - (b.level === 'hypothesis')) })).filter((x) => x.list.length);
  const orphan = live.filter((p) => ['project', 'hypothesis'].includes(p.level) && !prj(p.project));
  const seg = `<span class="seg">${[['all', $t('All')], ...(S.d.org ? [['org', PLEVEL.org]] : []), ['team', PLEVEL.team], ['project', $t('Projects')], ['hypothesis', $t('Hypotheses')]].map(([k, l]) => `<button class="${(S.plvl || 'all') === k ? 'on' : ''}" data-a="plvl" data-v="${k}">${l}</button>`).join('')}</span>`;
  const kn = uncollected();
  return `<div class="dc"><div class="hd"><div><h1>${$t('Processes')}</h1><div class="sub">${$t('How we do the work — on the level of hypotheses, projects, the team and the organization. Anyone proposes changes; the owner of the level approves them.')}</div></div>
   <div class="act"><button class="btn pri" data-a="newProc">${ico('plus')} ${$t('New process')}</button></div></div>
  <div style="margin-bottom:18px">${seg}</div>
  ${kn.length ? `<div class="note">${ico('kn')}<span style="flex:1">${$t('{n} knowledge entries of type “process” are not part of any process document yet.', { n: kn.length })}</span><button class="btn sm" data-a="collectProc">${$t('Collect into a process')}</button></div>` : ''}
  ${org.length ? `<div class="grp">${ico('org', 13)} ${$t('Organization {name}', { name: esc(S.d.org?.name || '') })}</div>${org.map(procRow).join('')}` : ''}
  ${team.length ? `<div class="grp">${$t('Team {name}', { name: esc(teamName(S.d.team)) })}</div>${team.map(procRow).join('')}` : ''}
  ${byProj.map(({ pp, list }) => `<div class="grp">${tag(pp.id)} · ${$t('project and its hypotheses')}</div>${list.map(procRow).join('')}`).join('')}
  ${orphan.length ? `<div class="grp">${$t('Without a project')}</div>${orphan.map(procRow).join('')}` : ''}
  ${!live.length ? `<div class="card empty">${$t('No processes yet. Start with one sentence — the rest grows from meetings.')}<br><button class="btn sm pri" style="margin-top:10px" data-a="newProc">${ico('plus', 13)} ${$t('New process')}</button></div>` : ''}
  ${retired.length ? `<div class="grp">${$t('Retired')}</div>${retired.map(procRow).join('')}` : ''}
  ${!isAdmin() ? `<div class="hint" style="margin-top:12px">${$t('Processes of projects you are not a member of are not shown.')}</div>` : ''}</div>`;
}

// What a change targets, in words.
function targetLabel(p, a, steps = p.sections.steps) {
  if (a.target !== 'steps') return SECL[a.target];
  if (a.kind === 'add') { const i = steps.findIndex((s) => s.id === a.before); return i >= 0 ? $t('Steps · before step {n} “{text}”', { n: i + 1, text: esc(steps[i].text.slice(0, 60)) }) : $t('Steps · at the end'); }
  const i = steps.findIndex((s) => s.id === a.step);
  return i >= 0 ? $t('Step {n}: “{text}”', { n: i + 1, text: esc(steps[i].text.slice(0, 60)) }) : $t('A step that is no longer in the process');
}
const srcLine = (s) => (s?.quote ? `<div class="src">${ico('quote', 12)} ${s.itemTitle ? esc(s.itemTitle) + ': ' : ''}“${esc(s.quote)}”${s.sourceId && srcOf(s.sourceId) ? ` <button class="lnk" data-a="go" data-h="source-${s.sourceId}">${$t('source')}</button>` : ''}</div>` : s?.itemTitle ? `<div class="src">${esc(s.itemTitle)}</div>` : '');
function pProcess(id) {
  const p = pcById(id);
  if (!p) return `<div class="dc"><div class="card empty">${ico('lock')} ${$t('This process is not visible to you.')}<br><br><button class="btn" data-a="go" data-h="processes">${ico('back')} ${$t('Processes')}</button></div></div>`;
  const tab = S.dtab[p.id] || (p.pending ? 'changes' : 'advocate');
  const banner = p.status === 'draft'
    ? `<div class="banner amber">${ico('warn')}<span class="grow">${$t('<b>Draft</b> by {name} from {date}. It takes effect once it is approved: {who}.', { name: esc(pn(p.creator)), date: fds(p.createdAt), who: approverLabel(p) })}</span>${p.canApprove ? `<span class="acts"><button class="btn ok sm" data-a="approveProc" data-id="${p.id}">${ico('check', 14)} ${$t('Approve as v1')}</button>${!p.version ? `<button class="btn sm ghost" data-a="delProc" data-id="${p.id}">${$t('Delete draft')}</button>` : ''}</span>` : p.creator === uid() ? `<span class="acts"><button class="btn sm ghost" data-a="delProc" data-id="${p.id}">${$t('Delete draft')}</button></span>` : ''}</div>`
    : p.status === 'retired' ? `<div class="banner">${ico('lock')}<span class="grow">${$t('The process is retired. It is kept with its history.')}</span>${p.canApprove ? `<span class="acts"><button class="btn sm" data-a="retireProc" data-id="${p.id}" data-v="active">${$t('Use again')}</button></span>` : ''}</div>` : '';
  const can = p.canPropose;
  const secs = PSECS.map((k) => {
    const body = k === 'steps' ? (p.sections.steps.length ? `<ol class="dsteps">${p.sections.steps.map((s) => `<li>${esc(s.text)}${srcLine(s.source)}</li>`).join('')}</ol>` : '') : p.sections[k] ? `<div>${esc(p.sections[k])}</div>` : '';
    return `<div class="sec"><h3>${SECL[k]}${can ? `<button class="lnk" data-a="proposeProc" data-id="${p.id}" data-t="${k}">${body ? $t('Propose a change') : $t('+ Describe')}</button>` : ''}</h3>${body || `<div class="miss">${$t('Not described')}</div>`}</div>`;
  }).join('');
  const orgVis = p.level === 'org' ? `<div class="note">${ico(p.visibility === 'all' ? 'users' : 'lock')}<span style="flex:1">${$t('Visibility: <b>{vis}</b>.', { vis: PVIS[p.visibility] })} ${p.visibility === 'all' ? $t('Members of all teams of the organization see it and propose changes.') : p.visibility === 'owner' ? $t('Only the organization Owner sees it and proposes changes.') : $t('The organization Owner and Admins see it and propose changes.')}</span>
    ${p.canApprove ? `<select class="in" style="width:auto" data-f="pcVis" data-id="${p.id}">${Object.entries(PVIS).map(([k, l]) => `<option value="${k}" ${p.visibility === k ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}</div>` : '';
  return `<div class="dc"><div class="crumb"><button class="lnk" data-a="go" data-h="processes">${ico('back', 13)} ${$t('Processes')}</button> / ${PLEVEL[p.level]}</div>
  <div class="hd"><div><div class="chips" style="margin-bottom:8px">${pcLevelChip(p)}${p.status === 'draft' ? `<span class="chip amber">${$t('Draft')}</span>` : p.status === 'retired' ? `<span class="chip">${$t('Retired')}</span>` : `<span class="chip green">${$t('Active · v{n}', { n: p.version })}</span>`}</div>
   <h1>${esc(p.title)}</h1>${p.summary ? `<div class="sub">${esc(p.summary)}</div>` : ''}<div class="hint" style="margin-top:6px">${$t('Approves changes:')} <b style="color:var(--ink)">${approverLabel(p)}</b>${['hypothesis', 'project'].includes(p.level) ? ` · ${$t('as a fallback — the team Owner/Admin')}` : ''}</div></div>
   <div class="act">${can ? `<button class="btn pri" data-a="proposeProc" data-id="${p.id}">${ico('edit')} ${$t('Propose a change')}</button>` : ''}${p.canApprove ? `<button class="btn ghost" data-a="renameProc" data-id="${p.id}" title="${$t('Rename')}">${ico('edit')}</button>${p.status === 'active' ? `<button class="btn ghost" data-a="retireProc" data-id="${p.id}" data-v="retired">${$t('Retire')}</button>` : ''}` : ''}</div></div>
  ${banner}${orgVis}
  <div class="split">
   <div class="card">${p.coverage < 9 || !p.summary ? draftBox(p) : ''}${p.summary || can ? `<div class="sec"><h3>${SECL.summary}${can ? `<button class="lnk" data-a="proposeProc" data-id="${p.id}" data-t="summary">${p.summary ? $t('Propose a change') : $t('+ Describe')}</button>` : ''}</h3>${p.summary ? `<div>${esc(p.summary)}</div>` : `<div class="miss">${$t('Not described')}</div>`}</div>` : ''}${secs}</div>
   <div class="card"><div class="tabs">
     <button class="${tab === 'changes' ? 'on' : ''}" data-a="dtab" data-id="${p.id}" data-v="changes">${$t('Changes')} <span class="n ${p.pending && p.canApprove ? 'red' : ''}">${p.pending}</span></button>
     <button class="${tab === 'history' ? 'on' : ''}" data-a="dtab" data-id="${p.id}" data-v="history">${$t('Version history')}</button>
     <button class="${tab === 'advocate' ? 'on' : ''}" data-a="dtab" data-id="${p.id}" data-v="advocate">${ico('shield', 14)} ${$t('Advocate')}</button></div>
    ${tab === 'changes' ? changesTab(p) : tab === 'history' ? procHistory(p) : procAdvocate(p)}
   </div></div></div>`;
}
function changesTab(p) {
  const pend = p.amendments.filter((a) => a.status === 'pending');
  const done = p.amendments.filter((a) => a.status !== 'pending').slice(-20).reverse();
  if (!pend.length && !done.length) return `<div class="empty">${$t('No changes yet.')}<br>${$t('Changes appear here when someone proposes them by hand, from the inbox or from the advocate’s advice.')}</div>`;
  const multi = p.canApprove && p.status === 'active' && pend.length > 1;
  const sel = pend.filter((a) => S.dsel[a.id]).length;
  const card = (a) => {
    const isPend = a.status === 'pending';
    return `<div class="draft ${isPend ? '' : 'done'} ${a.advocate ? 'adv' : ''}"><div class="top2">${multi && isPend ? `<input type="checkbox" data-a="dsel" data-id="${a.id}" ${S.dsel[a.id] ? 'checked' : ''} aria-label="${$t('Select')}">` : ''}<span class="kind ${AKCLS[a.kind]}">${AKIND[a.kind]}</span><span class="hint">${targetLabel(p, a)}</span>
      ${!isPend ? `<span class="chip ${a.status === 'accepted' ? 'green' : 'red'}" style="margin-left:auto">${a.status === 'accepted' ? $t('Accepted in v{n}', { n: a.version }) : $t('Rejected')}</span>` : ''}</div>
     ${a.kind !== 'remove' ? `<div class="txt">${esc(a.text)}</div>` : ''}${a.proposedText ? `<div class="hint">${$t('Proposed:')} ${esc(a.proposedText)}</div>` : ''}${a.note ? `<div class="hint">${esc(a.note)}</div>` : ''}
     ${srcLine(a.source)}
     <div class="by">${av(a.by, 18)} ${esc(pn(a.by))} · ${fds(a.at)}${a.advocate ? ` · ${$t('on the advocate’s advice')}` : ''}${a.generated ? ` · ${ico('spark', 12)} ${a.generated === 'source' ? $t('AI draft from a source') : $t('AI draft from the knowledge base')}` : ''}${a.source?.itemId ? ` · ${$t('from the inbox')}` : ''}${a.reason ? ` · ${$t('reason: “{text}”', { text: esc(a.reason) })}` : ''}${a.decidedBy && !isPend ? ` · ${esc(pn(a.decidedBy))}` : ''}</div>
     ${isPend ? (p.canApprove && p.status === 'active' ? `<div class="acts"><button class="btn sm ok" data-a="acceptAm" data-id="${p.id}" data-am="${a.id}">${ico('check', 14)} ${$t('Accept')}</button><button class="btn sm" data-a="editAm" data-id="${p.id}" data-am="${a.id}">${$t('Edit and accept')}</button><button class="btn sm ghost" data-a="rejectAm" data-id="${p.id}" data-am="${a.id}">${$t('Reject')}</button>${a.by === uid() ? `<button class="btn sm ghost" data-a="withdrawAm" data-id="${p.id}" data-am="${a.id}">${$t('Withdraw')}</button>` : ''}</div>` : `<div class="by">${ico('bell', 13)} ${p.status === 'draft' ? $t('Waits until the draft process is approved') : $t('Waiting for a decision: {who}', { who: approverLabel(p) })}${a.by === uid() ? ` <button class="lnk" data-a="withdrawAm" data-id="${p.id}" data-am="${a.id}">${$t('Withdraw')}</button>` : ''}</div>`) : ''}
    </div>`;
  };
  return `${multi ? `<div class="note" style="align-items:center"><span style="flex:1">${$t('Select several changes to accept them as one new version.')}</span><button class="btn sm" data-a="acceptAll" data-id="${p.id}">${$t('Accept all ({n})', { n: pend.length })}</button><button class="btn sm pri" data-a="acceptSel" data-id="${p.id}" ${sel < 2 ? 'disabled' : ''}>${$t('Accept selected ({n})', { n: sel })}</button></div>` : ''}${pend.map(card).join('')}${done.length ? `<div class="grp">${$t('Decided')}</div>${done.map(card).join('')}` : ''}`;
}
function versionNote(p, v) {
  if (v.note === 'created') return $t('Created');
  if (v.note === 'approved') return $t('Draft approved (author: {name})', { name: esc(pn(p.creator)) });
  if (v.note === 'collected') return $t('Collected from knowledge entries');
  const list = (v.amendments || []).map((id) => p.amendments.find((a) => a.id === id)).filter(Boolean);
  return list.map((a) => `${AKIND[a.kind]}: ${a.target === 'steps' ? $t('step') : SECL[a.target].toLowerCase()}${a.text ? ` “${esc(a.text.slice(0, 60))}”` : ''}`).join('; ') || $t('Changes');
}
function procHistory(p) {
  if (!p.versions.length) return `<div class="empty">${$t('No approved versions yet')}</div>`;
  return p.versions.slice().reverse().map((v) => `<div class="ver"><span class="n">v${v.n}</span><span>${versionNote(p, v)}<div class="m">${av(v.by, 16)} ${$t('approved')} · ${esc(pn(v.by))} · ${fds(v.at)} · <button class="lnk" data-a="pver" data-id="${p.id}" data-v="${v.n}">${S.pver === `${p.id}:${v.n}` ? $t('Hide') : $t('Show this version')}</button></div>
    ${S.pver === `${p.id}:${v.n}` ? `<div class="vsnap">${v.summary ? `<div class="hint">${esc(v.summary)}</div>` : ''}${PSECS.filter((k) => (k === 'steps' ? v.sections.steps.length : v.sections[k])).map((k) => `<div><b>${SECL[k]}</b>${k === 'steps' ? `<ol class="dsteps">${v.sections.steps.map((s) => `<li>${esc(s.text)}</li>`).join('')}</ol>` : `<div>${esc(v.sections[k])}</div>`}</div>`).join('')}</div>` : ''}</span></div>`).join('');
}
function advHead(n, total, checked, at, stale) {
  return `<div class="adv-h"><span class="adv-ico">${ico('shield', 18)}</span><span style="flex:1"><b>TeamOS Advocate</b><div class="hint">${at ? $t('Checked v{n} · {date}', { n: checked, date: fds(at) }) : $t('Checklist only — AI review not run yet')}${stale ? ` · <span style="color:var(--amber)">${$t('the document has changed since')}</span>` : ''}. ${$t('The advocate advises but changes nothing itself.')}</div></span><span class="big-n">${n}<span class="hint">/${total}</span></span></div>
  <div class="pb big" style="margin-bottom:14px"><i style="width:${Math.round((n / total) * 100)}%"></i></div>`;
}
const advBtn = (kind, id) => (S.ai ? `<button class="btn sm" data-a="runAdv" data-k="${kind}" data-id="${id}" ${S.advBusy === id ? 'disabled' : ''}>${S.advBusy === id ? `<span class="spin"></span> ${$t('Checking…')}` : `${ico('spark', 13)} ${$t('Check with the advocate')}`}</button>` : `<span class="hint">${$t('AI is off: only the checklist is available.')}</span>`);
const altHtml = (x) => `<div class="alt"><b>${esc(x.title)}</b><div class="pc"><span>+ ${esc(x.pros)}</span><span>− ${esc(x.cons)}</span></div></div>`;
function advRest(adv) {
  return `${adv?.risks?.length ? `<h3 style="margin:16px 0 4px">${$t('Risks')}</h3>${adv.risks.map((r) => `<div class="risk">${esc(r)}</div>`).join('')}` : ''}
  ${adv?.alternatives?.length ? `<h3 style="margin:16px 0 0">${$t('How else it could develop')}</h3>${adv.alternatives.map(altHtml).join('')}` : ''}`;
}
function procAdvocate(p) {
  const adv = p.advocate, dis = p.dismissedNow || [];
  const gaps = PSECS.filter((k) => (k === 'steps' ? !p.sections.steps.length : !p.sections[k]) && !dis.includes(k));
  const can = p.canPropose;
  return `${advHead(p.coverage, 9, adv?.version, adv?.at, adv && adv.version !== p.version)}<div style="margin-bottom:12px">${advBtn('process', p.id)}</div>
  <h3 style="margin-bottom:4px">${$t('What is missing')}</h3>
  ${gaps.length ? gaps.map((k) => { const sug = adv?.version === p.version ? adv.suggestions?.[k] : null; return `<div class="chk"><span class="mk n"></span><span class="body"><b>${SECL[k]}</b><div class="sug">${sug ? `${$t('Suggestion:')} ${esc(sug)}` : SECHINT[k]}</div>
    ${can ? `<div class="acts"><button class="btn sm" data-a="proposeProc" data-id="${p.id}" data-t="${k}" ${sug ? `data-adv="${esc(k)}"` : ''}>${$t('Propose as a change')}</button><button class="btn sm ghost" data-a="dismissAdv" data-k="process" data-id="${p.id}" data-key="${k}">${$t('Not relevant')}</button></div>` : ''}</span></div>`; }).join('') : `<div class="hint">${$t('All sections are described.')}</div>`}
  ${dis.length ? `<div class="hint" style="margin-top:6px">${$t('Deliberately left out:')} ${dis.map((k) => SECL[k] || k).join(', ')}</div>` : ''}${advRest(adv)}`;
}

/* ---------- agreements ---------- */
// A party who left the team keeps their name in the agreement's history.
const agName = (a, w) => (isExt(w) ? `${w.slice(4)} (${$t('ext.')})` : M()[w] ? pn(w) : (a.reviewReason?.party === w && a.reviewReason.name) || (a.history || []).find((h) => h.kind === 'party_left' && h.party === w)?.name || pn(w));
const agParties = (a) => [...new Set([...(a.current?.parties || a.parties), ...(a.pending?.parties || [])])];
function consentMark(a, w) {
  if (!a.pending) return a.current?.consents.some((x) => x.party === w) ? 'y' : 'w';
  const c = a.pending.consents.find((x) => x.party === w);
  return c?.decision === 'accept' ? 'y' : c?.decision === 'reject' ? 'n' : 'w';
}
const avck = (w, s, ck) => `<span class="avw">${av(w, s)}${ck ? `<span class="cmk ${ck}">${ck === 'y' ? '✓' : ck === 'n' ? '✕' : ''}</span>` : ''}</span>`;
const accCount = (a) => a.required.filter((w) => a.pending.consents.some((x) => x.party === w && x.decision === 'accept')).length;
function agrRow(a) {
  const me = a.needsMe;
  return `<button class="row ${me ? 'me' : ''}" data-a="go" data-h="agreement-${a.id}">
   <span class="tt"><b>${esc(a.title)}</b><span class="s">${ATYPE[a.type]} · ${a.current ? $t('v{n} in force since {date}', { n: a.current.n, date: fds(a.current.at) }) : $t('not in force yet')}</span>
    <span class="chips" style="margin-top:6px"><span class="avs">${agParties(a).map((w) => avck(w, 22, consentMark(a, w))).join('')}</span>${a.pending ? `<span class="hint">${$t('{acc} of {total} accepted v{n}', { acc: accCount(a), total: a.required.length, n: a.pending.n })}</span>` : ''}</span></span>
   <span class="rt">${me ? `<span class="chip red">${ico('bell', 12)} ${a.status === 'needs_review' && !a.pending?.review ? $t('Your review is needed') : $t('Your consent is needed')}</span>` : ''}${astChip(a)}</span></button>`;
}
function pAgreements() {
  const all = AGS(), mine = all.filter((a) => a.needsMe);
  const list = (S.agf === 'me' ? mine : all).slice().sort((a, b) => b.needsMe - a.needsMe || (a.terminatedAt ? 1 : 0) - (b.terminatedAt ? 1 : 0));
  return `<div class="dc"><div class="hd"><div><h1>${$t('Agreements')}</h1><div class="sub">${$t('What we agreed on among ourselves. A new version takes effect once <b>every</b> party has accepted it.')}</div></div>
   <div class="act"><button class="btn pri" data-a="newAgr">${ico('plus')} ${$t('New agreement')}</button></div></div>
  ${mine.length ? `<div class="banner red">${ico('bell')}<span class="grow">${$t('<b>Waiting for your response: {n}.</b> Until you respond, the previous version stays in force.', { n: mine.length })}</span></div>` : ''}
  <div style="margin-bottom:16px"><span class="seg"><button class="${S.agf !== 'me' ? 'on' : ''}" data-a="agf" data-v="all">${$t('All ({n})', { n: all.length })}</button><button class="${S.agf === 'me' ? 'on' : ''}" data-a="agf" data-v="me">${$t('Waiting for me ({n})', { n: mine.length })}</button></span></div>
  ${list.map(agrRow).join('') || `<div class="card empty">${S.agf === 'me' ? $t('Nothing is waiting for you') : $t('No agreements yet. Shares between partners, roles, team rules, work with a contractor — anything that needs everyone’s consent.')}</div>`}
  <div class="note" style="margin-top:14px">${ico('lock')}<span>${$t('Only the parties see an agreement. The Owner/Admin role doesn’t change that.')}</span></div></div>`;
}
const clausesHtml = (v, changed = new Set()) => v.clauses.map((x) => `<div class="cl ${changed.has(x.id) ? 'chg' : ''}"><h3>${esc(x.title || '—')}</h3><div>${esc(x.text)}</div>${srcLine(x.source)}</div>`).join('');
function changedClauses(a) {
  if (!a.pending || !a.current) return new Set();
  const old = new Map(a.current.clauses.map((x) => [x.id, x]));
  return new Set(a.pending.clauses.filter((x) => old.get(x.id)?.text !== x.text || old.get(x.id)?.title !== x.title).map((x) => x.id));
}
function diffView(a) {
  const old = new Map(a.current.clauses.map((x) => [x.id, x]));
  const now = new Set(a.pending.clauses.map((x) => x.id));
  const rows = a.pending.clauses.map((x) => {
    const o = old.get(x.id);
    if (!o) return `<div class="cl chg"><h3>${esc(x.title || '—')} <span class="kind add">${$t('New clause')}</span></h3><div>${esc(x.text)}</div>${srcLine(x.source)}</div>`;
    if (o.text === x.text && o.title === x.title) return `<div class="cl"><h3>${esc(x.title || '—')} <span class="hint">${$t('unchanged')}</span></h3><div class="hint">${esc(x.text)}</div></div>`;
    return `<div class="cl"><h3>${esc(x.title || '—')} <span class="kind rep">${$t('Changed')}</span></h3><div class="diff"><div class="dwas"><small>${$t('v{n} · in force now', { n: a.current.n })}</small>${esc(o.text)}</div><div class="dnow"><small>${$t('v{n} · waiting for consent', { n: a.pending.n })}</small>${esc(x.text)}</div></div>${srcLine(x.source)}</div>`;
  }).join('');
  const removed = a.current.clauses.filter((x) => !now.has(x.id)).map((x) => `<div class="cl"><h3>${esc(x.title || '—')} <span class="kind rem">${$t('Removed')}</span></h3><div class="hint" style="text-decoration:line-through">${esc(x.text)}</div></div>`).join('');
  const before = [...a.current.parties].sort().join(), after = [...a.pending.parties].sort().join();
  const partyChg = before !== after ? `<div class="cl"><h3>${$t('Parties')} <span class="kind rep">${$t('Changed')}</span></h3><div class="diff"><div class="dwas"><small>v${a.current.n}</small>${a.current.parties.map((w) => esc(agName(a, w))).join(', ')}</div><div class="dnow"><small>v${a.pending.n}</small>${a.pending.parties.map((w) => esc(agName(a, w))).join(', ')}</div></div></div>` : '';
  return (a.pending.terminate ? `<div class="banner red">${ico('warn')}<span class="grow">${$t('This version terminates the agreement.')}</span></div>` : '') + partyChg + rows + removed + `<div class="hint" style="margin-top:12px">${a.pending.note ? esc(a.pending.note) + ' · ' : ''}${$t('author: {name}, {date}', { name: esc(pn(a.pending.by)), date: fds(a.pending.at) })} · ${$t('When everyone accepts, the agreement is rewritten as v{n}: one complete text.', { n: a.pending.n })}</div>`;
}
function agrHistory(a) {
  const names = (cs) => cs.filter((x) => x.decision === 'accept').map((x) => `${esc(agName(a, x.party))} ${fds(x.at)}`).join(' · ');
  const rows = [];
  if (a.pending) rows.push(`<div class="ver"><span class="n">v${a.pending.n}</span><span>${esc(a.pending.note || $t('New version'))} <span class="chip amber">${$t('waiting for consent')}</span><div class="m">${$t('accepted:')} ${names(a.pending.consents) || $t('nobody yet')}</div></span></div>`);
  for (const v of [a.current, ...a.versions].filter(Boolean)) rows.push(`<div class="ver"><span class="n">v${v.n}</span><span>${esc(v.note || (v.n === 1 ? $t('First version') : $t('New version')))} ${v === a.current ? `<span class="chip green">${a.terminatedAt ? $t('last version') : $t('in force')}</span>` : ''}<div class="m">${$t('accepted:')} ${names(v.consents)} · ${$t('in force from {date}', { date: fds(v.at) })}</div>${v.source?.itemTitle ? `<div class="m">${ico('quote', 12)} ${esc(v.source.itemTitle)}</div>` : ''}</span></div>`);
  const log = (a.history || []).filter((h) => ['rejected', 'counter', 'party_left', 'external', 'withdrawn'].includes(h.kind)).slice(-12).reverse();
  const LOG = { rejected: $t('rejected v{n}'), counter: $t('proposed their own version v{n}'), party_left: $t('left the team'), external: $t('recorded the consent of an external party'), withdrawn: $t('withdrew v{n}') };
  return rows.join('') + (log.length ? `<div class="grp">${$t('Events')}</div>${log.map((h) => `<div class="hint" style="padding:3px 0">${fds(h.at)} · ${esc(h.kind === 'party_left' ? h.name || pn(h.party) : pn(h.by))} ${fill(LOG[h.kind], { n: h.n })}${h.party && h.kind === 'external' ? ` · ${esc(pnx(h.party))}` : ''}${h.note ? `: “${esc(h.note)}”` : ''}</div>`).join('')}` : '');
}
function agrAdvocate(a) {
  const dis = a.dismissedNow || [], adv = a.advocate;
  const party = a.canPropose && agParties(a).includes(uid()) && !(a.status === 'needs_review' && !a.pending?.review);
  return `${advHead(a.coverage, a.checklist.length, adv?.version, adv?.at, adv && adv.version !== a.checkedVersion)}<div style="margin-bottom:12px">${advBtn('agreement', a.id)}</div>
  <div class="hint" style="margin-bottom:8px">${$t('Checklist “{type}” for v{n}', { type: ATYPE[a.type], n: a.checkedVersion })}</div>
  ${a.checklist.filter((x) => x.ok || !dis.includes(x.key)).map((x) => { const ai = adv?.version === a.checkedVersion ? adv.suggestions?.[x.key] : null; const sug = ai ? { title: x.suggestion?.title || x.label, text: ai } : x.suggestion; return `<div class="chk"><span class="mk ${x.ok ? 'y' : 'n'}">${x.ok ? '✓' : ''}</span><span class="body"><b>${esc(x.label)}</b>${!x.ok && sug ? `<div class="sug">${$t('Suggested clause “{title}”:', { title: esc(sug.title) })} ${esc(sug.text)}</div>` : ''}
    ${!x.ok && party ? `<div class="acts">${sug ? `<button class="btn sm" data-a="agrEdit" data-id="${a.id}" data-new="1" data-title="${esc(sug.title)}" data-text="${esc(sug.text)}">${$t('Propose as a change')}</button>` : `<button class="btn sm" data-a="agrEdit" data-id="${a.id}" data-new="1" data-title="${esc(x.label)}">${$t('Add a clause')}</button>`}<button class="btn sm ghost" data-a="dismissAdv" data-k="agreement" data-id="${a.id}" data-key="${x.key}">${$t('We deliberately don’t do this')}</button></div>` : ''}</span></div>`; }).join('')}
  ${dis.length ? `<div class="hint" style="margin-top:6px">${$t('Deliberately left out:')} ${a.checklist.filter((x) => dis.includes(x.key)).map((x) => esc(x.label)).join(', ')}</div>` : ''}${advRest(adv)}
  <div class="disc">${ico('warn', 13)} ${$t('TeamOS records what people agreed on and their consent. This is not legal advice: a formal contract is best made with a lawyer.')}</div>`;
}
function partyRow(a, w) {
  const req = a.required.includes(w);
  let state = '';
  if (a.pending && req) {
    const c = a.pending.consents.find((x) => x.party === w);
    state = c?.decision === 'accept' ? `<span class="chip green">${$t('Accepted {date}', { date: fds(c.at) })}</span>${c.recordedBy ? `<span class="hint" title="${esc(c.note || '')}">${$t('recorded by {name}', { name: esc(pn(c.recordedBy)) })}</span>` : ''}` : c?.decision === 'reject' ? `<span class="chip red">${$t('Rejected')}</span>` : `<span class="chip">${$t('Waiting')}</span>${isExt(w) && a.required.includes(uid()) ? `<button class="btn sm ghost" data-a="extConsent" data-id="${a.id}" data-w="${esc(w)}">${ico('check', 13)} ${$t('Record consent')}</button>` : ''}`;
  } else if (!isExt(w) && !M()[w]) state = `<span class="chip red">${$t('Not on the team')}</span>`;
  else if (a.current?.consents.some((x) => x.party === w)) state = `<span class="hint">${$t('accepted v{n}', { n: a.current.n })}</span>`;
  return `<div class="party">${avck(w, 28, a.pending && req ? consentMark(a, w) : null)}<span class="nm">${esc(isExt(w) ? w.slice(4) : agName(a, w))}${w === uid() ? ` (${$t('you')})` : ''}<small>${isExt(w) ? $t('External party · their consent is recorded by a party') : !M()[w] ? $t('No longer on the team') : ROLE[M()[w].role]}</small></span>${state}</div>`;
}
function pAgreement(id) {
  const a = agById(id);
  if (!a) return `<div class="dc"><div class="card empty">${ico('lock')} ${$t('Only the parties see an agreement.')}<br><br><button class="btn" data-a="go" data-h="agreements">${ico('back')} ${$t('Agreements')}</button></div></div>`;
  const me = uid(), myC = a.myConsent, mustAnswer = a.pending && a.required.includes(me);
  const tab = S.dtab[a.id] || (a.pending && a.current ? 'diff' : 'text');
  let banner = '';
  if (a.terminatedAt) banner = `<div class="banner">${ico('lock')}<span class="grow">${$t('<b>Terminated</b> on {date} with the consent of every party. The history is kept.', { date: fds(a.terminatedAt) })}</span></div>`;
  else if (a.status === 'needs_review' && !a.pending?.review) {
    banner = `<div class="banner red">${ico('warn')}<span class="grow">${$t('<b>{name} is no longer on the team (since {date}).</b> The agreement needs a full review: parties, roles and terms. Until the review is done, v{n} is kept as the record of what was agreed.', { name: esc(a.reviewReason.name || pn(a.reviewReason.party)), date: fds(a.reviewReason.at), n: a.current?.n || 1 })}</span>${agParties(a).includes(me) ? `<span class="acts"><button class="btn sm pri" data-a="agrReview" data-id="${a.id}">${$t('Start the full review')}</button></span>` : ''}</div>`;
  }
  if (a.pending && !a.terminatedAt) {
    const rej = a.pending.consents.filter((x) => x.decision === 'reject');
    banner += `<div class="banner ${rej.length ? 'red' : 'amber'}">${ico(rej.length ? 'warn' : 'bell')}<span class="grow"><b>${a.current ? $t('v{n} is waiting for consent: {acc} of {total} accepted.', { n: a.pending.n, acc: accCount(a), total: a.required.length }) : $t('The first version is waiting for consent: {acc} of {total} accepted.', { acc: accCount(a), total: a.required.length })}</b> ${a.current ? $t('Until everyone accepts, v{n} stays in force. There is no time-out.', { n: a.current.n }) : $t('It takes effect once every party accepts it.')}
      ${rej.map((x) => `<br>${esc(pnx(x.party))}: ${$t('rejected')} — “${esc(x.note || '')}”`).join('')}${a.pending.counterTo ? `<br>${$t('A counter-proposal by {name} to the version by {other}', { name: esc(pn(a.pending.by)), other: esc(pn(a.pending.counterTo)) })}` : ''}</span>
     ${mustAnswer ? (myC?.decision === 'accept' ? `<span class="chip green">${ico('check', 12)} ${$t('You accepted {date}', { date: fds(myC.at) })}</span>` : `<span class="acts"><button class="btn ok sm" data-a="agrAccept" data-id="${a.id}">${ico('check', 14)} ${$t('I agree')}</button><button class="btn sm" data-a="agrEdit" data-id="${a.id}">${$t('My own version')}</button><button class="btn sm ghost" data-a="agrReject" data-id="${a.id}">${$t('Reject')}</button></span>`) : ''}
     ${a.pending.by === me && a.current ? `<span class="acts"><button class="btn sm ghost" data-a="agrWithdraw" data-id="${a.id}">${$t('Withdraw')}</button></span>` : ''}</div>`;
  }
  const tabs = [['text', a.pending && a.current ? $t('In force v{n}', { n: a.current.n }) : a.current ? $t('Text') : $t('Text v{n}', { n: a.pending?.n || 1 })], ...(a.pending && a.current ? [['diff', `v${a.current.n} → v${a.pending.n}`]] : []), ['history', $t('Version history')], ['advocate', `${ico('shield', 14)} ${$t('Advocate')}`]];
  const body = tab === 'diff' && a.pending && a.current ? diffView(a) : tab === 'history' ? agrHistory(a) : tab === 'advocate' ? agrAdvocate(a)
    : `${clausesHtml(a.current || a.pending)}${a.current ? `<div class="hint" style="margin-top:12px">${$t('In force since {date} with the consent of every party.', { date: fds(a.current.at) })}</div>` : ''}`;
  const party = agParties(a).includes(me) && a.canPropose;
  return `<div class="dc"><div class="crumb"><button class="lnk" data-a="go" data-h="agreements">${ico('back', 13)} ${$t('Agreements')}</button> / ${ATYPE[a.type]}</div>
  <div class="hd"><div><div class="chips" style="margin-bottom:8px"><span class="chip">${ATYPE[a.type]}</span>${astChip(a)}${a.current ? `<span class="hint">${$t('v{n} in force', { n: a.current.n })}</span>` : ''}</div><h1>${esc(a.title)}</h1>
   <div class="sub">${$t('Parties:')} ${agParties(a).map((w) => esc(agName(a, w))).join(', ')}</div></div>
   <div class="act">${party && !(a.status === 'needs_review' && !a.pending?.review) ? `<button class="btn" data-a="agrEdit" data-id="${a.id}">${ico('edit')} ${$t('Propose a change')}</button><button class="btn ghost" data-a="agrReview" data-id="${a.id}">${$t('Edit the whole text')}</button>${a.current ? `<button class="btn ghost" data-a="agrTerminate" data-id="${a.id}">${$t('Propose termination')}</button>` : ''}` : ''}</div></div>
  ${banner}
  <div class="split">
   <div class="card"><div class="tabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-a="dtab" data-id="${a.id}" data-v="${k}">${l}</button>`).join('')}</div>${body}</div>
   <div class="col">
    <div class="card"><h2>${ico('users')} ${$t('Parties and consent')}</h2>${agParties(a).map((w) => partyRow(a, w)).join('')}
     ${a.pending ? `<div class="hint" style="margin-top:10px">${$t('Any change to the text resets the consents given so far: people agree to an exact text. The author of a change accepts it automatically.')}</div>` : ''}</div>
    ${a.pending?.source?.quote ? `<div class="card"><h2>${ico('quote')} ${$t('Where this change comes from')}</h2>${srcLine(a.pending.source)}<div class="hint" style="margin-top:6px">${$t('from the inbox, confirmed by {name}, {date}', { name: esc(pn(a.pending.by)), date: fds(a.pending.at) })}</div></div>` : ''}
   </div></div></div>`;
}

// Processes on the project and hypothesis pages.
function docsCardFor(level, id) {
  const list = PCS().filter((p) => p.status !== 'retired' && (level === 'project' ? p.project === id : p.hypothesis === id));
  return `<div class="card dc" style="margin-top:16px"><h2>${ico('proc')} ${$t('Processes')} · ${list.length}<button class="lnk" data-a="newProc" data-level="${level}" data-ref="${id}">${$t('+ Process')}</button></h2>${list.map((p) => `<button class="trow" data-a="go" data-h="process-${p.id}"><span class="tt"><b>${esc(p.title)}</b><span class="mt">${p.level === 'hypothesis' && level === 'project' ? `<span class="chip">${hcode(p.hypothesis)}</span>` : ''}${p.status === 'draft' ? `<span class="chip amber">${$t('Draft')}</span>` : `<span class="chip">v${p.version}</span>`}${p.pending ? `<span class="chip ${p.needsMe ? 'red' : 'amber'}">${$p(p.pending, 'change')}</span>` : ''}${covBar(p.coverage, 9)}</span></span></button>`).join('') || `<div class="empty">${$t('How do you do the work here? Describe it in one sentence — the rest grows from meetings.')}</div>`}</div>`;
}
// The "waiting for me" block of the dashboard.
function docsWaiting() {
  const ag = AGS().filter((a) => a.needsMe), pc = PCS().filter((p) => p.needsMe);
  if (!ag.length && !pc.length) return '';
  return `<div class="card dc"><h2>${ico('bell')} ${$t('Waiting for me')}</h2>${ag.map((a) => `<button class="trow" data-a="go" data-h="agreement-${a.id}">${ico('agr')}<span class="tt"><b>${esc(a.title)}</b><span class="mt">${a.status === 'needs_review' && !a.pending?.review ? $t('Needs a full review') : a.pending ? $t('{acc} of {total} accepted v{n}', { acc: accCount(a), total: a.required.length, n: a.pending.n }) : ''}</span></span><span class="btn sm">${$t('Respond')}</span></button>`).join('')}${pc.map((p) => `<button class="trow" data-a="go" data-h="process-${p.id}">${ico('proc')}<span class="tt"><b>${esc(p.title)}</b><span class="mt">${p.status === 'draft' ? $t('Draft · waiting for approval') : $p(p.pending, 'change')}</span></span><span class="btn sm">${$t('Decide')}</span></button>`).join('')}</div>`;
}

/* ---------- process & agreement modals ---------- */
function procOpts(p) {
  const o = [{ kind: 'add', target: 'steps', before: null, label: $t('Add a step at the end') }];
  p.sections.steps.forEach((s, n) => o.push({ kind: 'add', target: 'steps', before: s.id, label: $t('Add a step before {n}. {text}', { n: n + 1, text: s.text.slice(0, 50) }) }));
  p.sections.steps.forEach((s, n) => o.push({ kind: 'replace', target: 'steps', step: s.id, label: $t('Change step {n}. {text}', { n: n + 1, text: s.text.slice(0, 50) }), text: s.text }));
  p.sections.steps.forEach((s, n) => o.push({ kind: 'remove', target: 'steps', step: s.id, label: $t('Remove step {n}. {text}', { n: n + 1, text: s.text.slice(0, 50) }) }));
  for (const k of ['summary', ...PSECS.filter((x) => x !== 'steps')]) {
    const cur = k === 'summary' ? p.summary : p.sections[k];
    if (cur) { o.push({ kind: 'extend', target: k, label: `${$t('Extend:')} ${SECL[k]}` }); o.push({ kind: 'replace', target: k, label: `${$t('Replace:')} ${SECL[k]}`, text: cur }); o.push({ kind: 'remove', target: k, label: `${$t('Remove:')} ${SECL[k]}` }); }
    else o.push({ kind: 'add', target: k, label: `${$t('Describe:')} ${SECL[k]}` });
  }
  return o;
}
const docField = (id) => document.getElementById(id)?.value ?? '';
function docModal(m, close, cancel) {
  const wrap = (title, body, foot, wide) => `<div class="md dc ${wide ? 'wide' : ''}"><div class="mdh"><h2>${title}</h2>${close}</div>${body}<div class="mdf">${foot}</div></div>`;
  if (m.k === 'doc.newProc') {
    const lv = [['hypothesis', PLEVEL.hypothesis, $t('Approved by whoever is responsible')], ['project', PLEVEL.project, $t('Approved by the project owner')], ['team', PLEVEL.team, $t('Team Owner / Admin')], ...(S.d.org && !personal() ? [['org', PLEVEL.org, $t('Organization Owner / Admin')]] : [])];
    const opts = m.level === 'project' ? S.d.projects.filter((p) => p.status !== 'archived' && (isAdmin() || (p.members || []).includes(uid()) || p.owner === uid())).map((p) => [p.id, p.name])
      : m.level === 'hypothesis' ? S.d.hypotheses.filter((h) => isAdmin() || (prj(h.project)?.members || []).includes(uid()) || prj(h.project)?.owner === uid()).map((h) => [h.id, `${hcode(h.id)} · ${(h.then || '').slice(0, 50)} (${prj(h.project)?.name || '—'})`]) : [];
    const ref = opts.some(([v]) => v === m.ref) ? m.ref : opts[0]?.[0];
    const owner = m.level === 'project' ? prj(ref)?.owner : m.level === 'hypothesis' ? hyp(ref)?.owner : null;
    const active = m.level === 'org' ? Boolean(S.d.org?.role && (m.vis !== 'owner' || S.d.org.role === 'owner')) : m.level === 'team' ? isAdmin() : Boolean(ref) && (owner === uid() || isAdmin());
    return wrap($t('New process'), `<div class="hint" style="margin-bottom:8px">${$t('First choose the level — it defines who approves changes.')}</div>
     <div class="lv">${lv.map(([k, l, d]) => `<button class="${m.level === k ? 'on' : ''}" data-a="mLevel" data-v="${k}"><b>${l}</b>${d}</button>`).join('')}</div>
     ${opts.length ? `<label class="fl">${m.level === 'project' ? $t('Project') : $t('Hypothesis')}<select class="in" id="npRef">${opts.map(([v, t]) => `<option value="${v}" ${ref === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>` : ''}
     ${['project', 'hypothesis'].includes(m.level) && !opts.length ? `<div class="note">${$t('You are not a member of any project.')}</div>` : ''}
     ${m.level === 'org' ? `<label class="fl">${$t('Who sees it and can propose changes')}<select class="in" id="npVis">${Object.entries(PVIS).map(([k, l]) => `<option value="${k}" ${(m.vis || 'all') === k ? 'selected' : ''}>${l}${k === 'all' ? ` — ${$t('members of all teams of the organization')}` : ''}</option>`).join('')}</select></label>` : ''}
     <label class="fl">${$t('Title')}<input class="in" id="npTitle" value="${esc(m.title || '')}" placeholder="${$t('E.g. “Hypothesis retro”')}"></label>
     ${S.ai ? `<label class="fl">${$t('Draft the content with AI from')}<select class="in" id="npGen"><option value="">${$t('Nothing — I’ll describe it myself')}</option>${draftOpts(m.gen || '')}</select></label>` : ''}
     <label class="fl">${$t('In short: what this process is')}<textarea class="in" rows="3" id="npSum" placeholder="${$t('One or two sentences. Details — steps, roles, exceptions — can be added later or come from meetings.')}">${esc(m.summary || '')}</textarea></label>`,
    `<span class="hint" style="margin-right:auto">${active ? $t('You own this level — the process becomes active right away.') : $t('The process stays a draft until it is approved by: {who}.', { who: m.level === 'team' ? $t('Team Owner / Admin') : m.level === 'org' ? $t('Organization Owner / Admin') : owner ? esc(pn(owner)) : '—' })}</span>${cancel}<button class="btn pri" data-a="createProc">${$t('Create')}</button>`);
  }
  if (m.k === 'doc.collect') {
    const kn = uncollected();
    const lvOpts = [['team:', PLEVEL.team], ...S.d.projects.filter((p) => p.status !== 'archived').map((p) => [`project:${p.id}`, `${PLEVEL.project} · ${p.name}`]), ...S.d.hypotheses.map((h) => [`hypothesis:${h.id}`, `${PLEVEL.hypothesis} · ${hcode(h.id)} ${(h.then || '').slice(0, 40)}`])];
    return wrap($t('Collect into a process'), `<p class="hint" style="margin-top:0">${$t('Each entry becomes a step with a link to where it came from. The knowledge entries stay as they are.')}</p>
     <div class="cklist" style="max-height:260px;overflow:auto">${kn.map((k) => `<label><input type="checkbox" class="colK" value="${k.id}" checked> ${esc(k.text)} ${k.project ? tag(k.project) : ''}</label>`).join('')}</div>
     <label class="fl" style="margin-top:12px">${$t('Level')}<select class="in" id="colLv">${lvOpts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></label>
     <label class="fl">${$t('Title')}<input class="in" id="colTitle" placeholder="${$t('E.g. “How we work”')}"></label>`, `${cancel}<button class="btn pri" data-a="collectGo">${$t('Create a process')}</button>`, true);
  }
  if (m.k === 'doc.propose') {
    const p = pcById(m.id), opts = procOpts(p);
    const i = Math.min(Number(m.opt) || 0, opts.length - 1), o = opts[i];
    return wrap($t('Change to “{title}”', { title: esc(p.title) }), `<label class="fl">${$t('What to change')}<select class="in" id="pmOpt" data-f="pmOpt">${opts.map((x, n) => `<option value="${n}" ${n === i ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>
     ${o.kind !== 'remove' ? `<label class="fl">${$t('Text')}<textarea class="in" rows="4" id="pmText" placeholder="${esc(o.target === 'steps' ? $t('Describe the step') : SECHINT[o.target])}">${esc(m.text ?? (o.kind === 'replace' ? o.text || '' : ''))}</textarea></label>` : `<div class="note">${$t('It will be removed once the change is approved.')}</div>`}
     <label class="fl">${$t('Why (optional)')}<input class="in" id="pmNote" value="${esc(m.note || '')}"></label>`,
    `<span class="hint" style="margin-right:auto">${p.canApprove ? $t('You can accept it right away in the “Changes” tab.') : $t('It goes as a draft. Approves: {who}', { who: approverLabel(p) })}</span>${cancel}<button class="btn pri" data-a="proposeGo">${$t('Add the change')}</button>`);
  }
  if (m.k === 'doc.editAm') {
    const p = pcById(m.id), a = p.amendments.find((x) => x.id === m.am);
    return wrap($t('Edit and accept'), `<div class="hint" style="margin-bottom:8px">${AKIND[a.kind]} · ${targetLabel(p, a)}</div><textarea class="in" rows="4" id="eaText">${esc(a.text)}</textarea>`,
      `${cancel}<button class="btn ok" data-a="editAmGo">${ico('check', 14)} ${$t('Accept as v{n}', { n: p.version + 1 })}</button>`);
  }
  if (m.k === 'doc.reject') {
    return wrap(m.agr ? $t('Reject the new version') : $t('Reject the change'), `<label class="fl">${m.agr ? $t('Reason — the author and every party will see it') : $t('Reason — the author will see it')}<textarea class="in" rows="3" id="rjText" placeholder="${$t('E.g. “I think it should be 42 / 42 / 16”')}"></textarea></label>
     ${m.agr ? `<div class="note">${$t('Until every party accepts the new version, the previous one stays in force. You can also propose your own version instead of rejecting.')}</div>` : ''}`,
      `${cancel}<button class="btn pri" data-a="rejectGo">${$t('Reject')}</button>`);
  }
  if (m.k === 'doc.newAgr') {
    const team = m.type === 'team_rules';
    return wrap($t('New agreement'), `<div class="grid g2" style="gap:12px"><label class="fl">${$t('Type')}<select class="in" id="naType" data-f="naType">${Object.entries(ATYPE).map(([k, l]) => `<option value="${k}" ${m.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
     <label class="fl">${$t('Title')}<input class="in" id="naTitle" value="${esc(m.title || '')}"></label></div>
     <div class="hint" style="margin:10px 0 6px;font-weight:600">${$t('Parties — every one of them has to accept')}</div>
     <div class="pchk">${S.d.members.map((x) => `<label><input type="checkbox" class="naP" value="${x.id}" ${x.id === uid() ? 'checked disabled' : team || (m.parties || []).includes(x.id) ? 'checked' : ''}>${av(x.id, 20)} ${esc(x.name)}</label>`).join('')}</div>
     <label class="fl">${$t('External parties (optional, comma-separated)')}<input class="in" id="naExt" value="${esc(m.ext || '')}" placeholder="${$t('Name — a party records their consent')}"></label>
     <label class="fl">${$t('Clauses — one per line, as “Title: text”')}<textarea class="in" rows="6" id="naCl" placeholder="${$t('Shares: Anna — 40%, Bohdan — 40%, Viktor — 20%')}">${esc(m.clauses || '')}</textarea></label>`,
      `<span class="hint" style="margin-right:auto">${$t('After it is created, the advocate shows what is missing.')}</span>${cancel}<button class="btn pri" data-a="createAgr">${$t('Send for consent')}</button>`, true);
  }
  if (m.k === 'doc.agrEdit') {
    const a = agById(m.id), cl = (a.pending || a.current).clauses;
    const cur = m.cid === 'new' ? null : cl.find((x) => x.id === m.cid) || cl[0];
    const others = a.pending && a.pending.consents.some((x) => x.party !== uid());
    return wrap($t('Change to “{title}”', { title: esc(a.title) }), `<label class="fl">${$t('Clause')}<select class="in" id="aeCl" data-f="aeCl">${cl.map((x) => `<option value="${x.id}" ${cur?.id === x.id ? 'selected' : ''}>${esc(x.title || x.text.slice(0, 40))}</option>`).join('')}<option value="new" ${!cur ? 'selected' : ''}>${$t('+ New clause')}</option></select></label>
     <label class="fl">${$t('Clause title')}<input class="in" id="aeTitle" value="${esc(m.title ?? cur?.title ?? '')}"></label>
     <label class="fl">${$t('Text')}<textarea class="in" rows="4" id="aeText">${esc(m.text ?? cur?.text ?? '')}</textarea></label>
     ${cur ? `<div class="hint">${$t('Leave the text empty to remove the clause.')}</div>` : ''}
     <label class="fl">${$t('What changes and why (optional)')}<input class="in" id="aeNote"></label>
     <div class="note">${ico('warn')}<span>${others ? $t('The consents already given will be reset — every party has to accept the new text.') : $t('The change becomes a new version waiting for consent.')} ${a.current ? $t('Until everyone accepts it, v{n} stays in force.', { n: a.current.n }) : ''}</span></div>`,
      `${cancel}<button class="btn pri" data-a="agrEditGo">${$t('Propose')}</button>`);
  }
  if (m.k === 'doc.agrReview') {
    const a = agById(m.id), base = a.pending || a.current;
    const review = a.status === 'needs_review';
    const parties = [...new Set([...base.parties, ...S.d.members.map((x) => x.id)])];
    const left = a.reviewReason?.party;
    return wrap(review ? $t('Full review: {title}', { title: esc(a.title) }) : $t('Edit the whole text: {title}', { title: esc(a.title) }), `${review ? `<div class="note">${ico('warn')}<span>${$t('{name} is no longer on the team. Review the parties and every clause. The new version has to be accepted by every party who stays.', { name: esc(a.reviewReason.name || pn(left)) })}</span></div>` : ''}
     <div class="hint" style="margin-bottom:6px;font-weight:600">${$t('Parties')}</div>
     <div class="pchk">${parties.map((w) => `<label><input type="checkbox" class="arP" value="${esc(w)}" ${base.parties.includes(w) && (M()[w] || isExt(w)) ? 'checked' : ''} ${w === uid() ? 'disabled checked' : ''}>${av(w, 20)} ${esc(agName(a, w))}</label>`).join('')}${left && !M()[left] ? `<label><input type="checkbox" class="arP" value="${esc('ext:' + (a.reviewReason.name || left))}">${$t('{name} — keep as an external party', { name: esc(a.reviewReason.name || left) })}</label>` : ''}</div>
     ${base.clauses.map((x) => `<div class="fl arC" data-id="${x.id}"><input class="in arT" value="${esc(x.title)}" placeholder="${$t('Clause title')}" style="font-weight:600">${left && (x.title + ' ' + x.text).toLowerCase().includes(String(a.reviewReason.name || '').toLowerCase().split(' ')[0] || '\u0000') ? `<span class="chip red" style="align-self:flex-start">${$t('concerns the person who left')}</span>` : ''}<textarea class="in arX" rows="2">${esc(x.text)}</textarea></div>`).join('')}
     <div class="fl arC" data-id=""><input class="in arT" placeholder="${$t('New clause title (optional)')}"><textarea class="in arX" rows="2" placeholder="${$t('New clause text')}"></textarea></div>
     <label class="fl">${$t('What changes and why (optional)')}<input class="in" id="arNote"></label>`,
      `<span class="hint" style="margin-right:auto">${$t('An empty clause is removed.')}</span>${cancel}<button class="btn pri" data-a="agrReviewGo">${$t('Send for consent')}</button>`, true);
  }
  if (m.k === 'doc.ext') {
    return wrap($t('Record the consent of {name}', { name: esc(m.w.slice(4)) }), `<p class="hint" style="margin-top:0">${$t('An external party confirms outside TeamOS. Record how they confirmed this exact version — it is visible to every party.')}</p><label class="fl">${$t('How they confirmed')}<textarea class="in" rows="3" id="exNote" placeholder="${$t('E.g. “Replied by email on 24 Nov: agree with v2”')}"></textarea></label>`,
      `${cancel}<button class="btn pri" data-a="extGo">${$t('Record')}</button>`);
  }
  return '';
}
// After a change the server returns the document's view; replace it in the state.
const putPc = (p) => { const i = S.d.processes.findIndex((x) => x.id === p.id); if (i >= 0) S.d.processes[i] = p; else S.d.processes.push(p); };
const putAg = (a) => { const i = S.d.agreements.findIndex((x) => x.id === a.id); if (i >= 0) S.d.agreements[i] = a; else S.d.agreements.push(a); };
const pcApi = (id, path, body, method = 'POST') => api(method, T(`/processes/${encodeURIComponent(id)}${path}`), body);
const agApi = (id, path, body, method = 'POST') => api(method, T(`/agreements/${encodeURIComponent(id)}${path}`), body);
const closeDoc = () => { S.modal = null; render(); };
const DOC_ACTIONS = {
  plvl: (el) => { S.plvl = el.dataset.v; render(); },
  agf: (el) => { S.agf = el.dataset.v; render(); },
  dtab: (el) => { S.dtab[el.dataset.id] = el.dataset.v; render(); },
  dsel: (el) => { S.dsel[el.dataset.id] = el.checked; render(); },
  pver: (el) => { const k = `${el.dataset.id}:${el.dataset.v}`; S.pver = S.pver === k ? null : k; render(); },
  newProc: (el) => { S.modal = { k: 'doc.newProc', level: el.dataset.level || (S.d.projects.length ? 'project' : 'team'), ref: el.dataset.ref || '' }; render(); },
  mLevel: (el) => { Object.assign(S.modal, { level: el.dataset.v, ref: '', title: docField('npTitle'), summary: docField('npSum'), vis: docField('npVis') || S.modal.vis, gen: docField('npGen') }); modal(); },
  createProc: () => {
    const m = S.modal, title = docField('npTitle').trim();
    if (!title) return toast($t('Name the process'));
    const ref = docField('npRef'), gen = docField('npGen');
    act(async () => {
      const p = await api('POST', T('/processes'), { level: m.level, project: m.level === 'project' ? ref : undefined, hypothesis: m.level === 'hypothesis' ? ref : undefined, visibility: m.level === 'org' ? docField('npVis') : undefined, title, summary: docField('npSum') });
      putPc(p); S.modal = null; S.dtab[p.id] = gen ? 'changes' : 'advocate'; go('process-' + p.id);
      if (gen) setTimeout(() => runDraft(p.id, gen), 0);
      return p;
    }, (p) => (p.status === 'active' ? $t('Process created. The advocate shows what can be added.') : $t('Process created as a draft. Approves: {who}', { who: approverLabel(p).replace(/<[^>]+>/g, '') })));
  },
  collectProc: () => { S.modal = { k: 'doc.collect' }; render(); },
  collectGo: () => {
    const ids = [...document.querySelectorAll('.colK:checked')].map((x) => x.value);
    if (!ids.length) return toast($t('Choose the knowledge entries to collect'));
    const [level, ref] = docField('colLv').split(':');
    act(async () => { const p = await api('POST', T('/processes/collect'), { knowledge: ids, level, project: level === 'project' ? ref : undefined, hypothesis: level === 'hypothesis' ? ref : undefined, title: docField('colTitle').trim() || $t('How we work') }); putPc(p); S.modal = null; go('process-' + p.id); }, $t('Process created'));
  },
  approveProc: (el) => act(async () => { putPc(await pcApi(el.dataset.id, '/approve')); render(); }, $t('The process is approved as v1')),
  delProc: (el) => { if (!confirm($t('Delete this draft process?'))) return; act(async () => { await pcApi(el.dataset.id, '', undefined, 'DELETE'); S.d.processes = S.d.processes.filter((x) => x.id !== el.dataset.id); go('processes'); }, $t('Deleted')); },
  retireProc: (el) => { if (el.dataset.v === 'retired' && !confirm($t('Retire the process? It stays in the history and can be used again.'))) return; act(async () => { putPc(await pcApi(el.dataset.id, '', { status: el.dataset.v }, 'PATCH')); render(); }, $t('Saved')); },
  renameProc: (el) => { const p = pcById(el.dataset.id); const t = prompt($t('Title'), p.title); if (!t || !t.trim() || t.trim() === p.title) return; act(async () => { putPc(await pcApi(p.id, '', { title: t.trim() }, 'PATCH')); render(); }, $t('Saved')); },
  proposeProc: (el) => {
    const p = pcById(el.dataset.id), t = el.dataset.t, opts = procOpts(p);
    let opt = 0; if (t) { const n = opts.findIndex((o) => o.target === t && ['add', 'extend'].includes(o.kind)); if (n >= 0) opt = n; }
    const adv = el.dataset.adv && p.advocate?.suggestions?.[el.dataset.adv];
    S.modal = { k: 'doc.propose', id: p.id, opt, text: adv || undefined, advocate: Boolean(adv) }; render();
  },
  proposeGo: () => {
    const m = S.modal, p = pcById(m.id), o = procOpts(p)[Number(docField('pmOpt')) || 0];
    const text = docField('pmText').trim();
    if (o.kind !== 'remove' && !text) return toast($t('Describe the change'));
    act(async () => { putPc(await pcApi(p.id, '/amendments', { kind: o.kind, target: o.target, step: o.step, before: o.before, text, note: docField('pmNote'), advocate: m.advocate })); S.modal = null; S.dtab[p.id] = 'changes'; render(); }, p.canApprove ? $t('Change added. You can accept it.') : $t('Change added. Waiting for a decision: {who}', { who: approverLabel(p).replace(/<[^>]+>/g, '') }));
  },
  acceptAm: (el) => act(async () => { const p = await pcApi(el.dataset.id, '/amendments/accept', { ids: [el.dataset.am] }); putPc(p); render(); return p; }, (p) => $t('Accepted. “{title}” is now v{n}', { title: p.title, n: p.version })),
  genDraft: (el) => { S.genFrom = docField('genFrom'); runDraft(el.dataset.id, S.genFrom); },
  acceptAll: (el) => { const p = pcById(el.dataset.id); const ids = p.amendments.filter((a) => a.status === 'pending').map((a) => a.id); act(async () => { const x = await pcApi(p.id, '/amendments/accept', { ids }); putPc(x); S.dsel = {}; render(); return x; }, (x) => $t('Accepted. “{title}” is now v{n}', { title: x.title, n: x.version })); },
  acceptSel: (el) => { const p = pcById(el.dataset.id); const ids = p.amendments.filter((a) => a.status === 'pending' && S.dsel[a.id]).map((a) => a.id); act(async () => { const x = await pcApi(p.id, '/amendments/accept', { ids }); putPc(x); S.dsel = {}; render(); return x; }, (x) => $t('Accepted. “{title}” is now v{n}', { title: x.title, n: x.version })); },
  editAm: (el) => { S.modal = { k: 'doc.editAm', id: el.dataset.id, am: el.dataset.am }; render(); },
  editAmGo: () => { const m = S.modal; act(async () => { const p = await pcApi(m.id, '/amendments/accept', { ids: [m.am], edits: { [m.am]: docField('eaText') } }); putPc(p); S.modal = null; render(); return p; }, (p) => $t('Accepted. “{title}” is now v{n}', { title: p.title, n: p.version })); },
  rejectAm: (el) => { S.modal = { k: 'doc.reject', id: el.dataset.id, am: el.dataset.am }; render(); },
  withdrawAm: (el) => act(async () => { putPc(await pcApi(el.dataset.id, `/amendments/${encodeURIComponent(el.dataset.am)}`, undefined, 'DELETE')); render(); }, $t('Withdrawn')),
  rejectGo: () => {
    const m = S.modal, reason = docField('rjText').trim();
    if (m.agr) { if (!reason) return toast($t('Write the reason')); return act(async () => { putAg(await agApi(m.id, '/respond', { decision: 'reject', note: reason })); closeDoc(); }, $t('Rejected. The previous version stays in force, and the parties see your reason.')); }
    act(async () => { putPc(await pcApi(m.id, `/amendments/${encodeURIComponent(m.am)}/reject`, { reason })); closeDoc(); }, $t('Rejected. The author will see the reason.'));
  },
  runAdv: (el) => { if (S.advBusy) return; S.advBusy = el.dataset.id; render(); const kind = el.dataset.k; api('POST', T(`/${kind === 'process' ? 'processes' : 'agreements'}/${encodeURIComponent(el.dataset.id)}/advocate`)).then((x) => { (kind === 'process' ? putPc : putAg)(x); toast($t('The advocate has checked the document')); }).catch((e) => toast(e.message)).finally(() => { S.advBusy = null; render(); }); },
  dismissAdv: (el) => { const kind = el.dataset.k; act(async () => { const x = await api('POST', T(`/${kind === 'process' ? 'processes' : 'agreements'}/${encodeURIComponent(el.dataset.id)}/advocate/dismiss`), { key: el.dataset.key }); (kind === 'process' ? putPc : putAg)(x); render(); }, $t('The advocate won’t show this advice for this version')); },
  // agreements
  newAgr: () => { S.modal = { k: 'doc.newAgr', type: 'partnership' }; render(); },
  createAgr: () => {
    const title = docField('naTitle').trim();
    if (!title) return toast($t('Name the agreement'));
    const clauses = docField('naCl').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf(':'); return i > 0 && i < 80 ? { title: l.slice(0, i).trim(), text: l.slice(i + 1).trim() } : { title: '', text: l }; }).filter((x) => x.text);
    if (!clauses.length) return toast($t('Add at least one clause'));
    const parties = [...document.querySelectorAll('.naP:checked')].map((x) => x.value).concat(docField('naExt').split(',').map((x) => x.trim()).filter(Boolean).map((x) => `ext:${x}`));
    act(async () => { const a = await api('POST', T('/agreements'), { type: docField('naType'), title, parties, clauses }); putAg(a); S.modal = null; S.dtab[a.id] = 'advocate'; go('agreement-' + a.id); }, $t('The agreement was sent to the parties for consent'));
  },
  agrAccept: (el) => act(async () => { const a = await agApi(el.dataset.id, '/respond', { decision: 'accept' }); putAg(a); if (!a.pending) S.dtab[a.id] = 'text'; render(); return a; }, (a) => (a.pending ? $t('You accepted. Waiting for: {names}', { names: a.required.filter((w) => !a.pending.consents.some((x) => x.party === w && x.decision === 'accept')).map(pnx).join(', ') }) : a.terminatedAt ? $t('Everyone accepted — the agreement is terminated') : $t('Everyone accepted — v{n} is in force and rewritten as one complete text', { n: a.current.n }))),
  agrReject: (el) => { S.modal = { k: 'doc.reject', id: el.dataset.id, agr: true }; render(); },
  agrEdit: (el) => { const a = agById(el.dataset.id); const chg = [...changedClauses(a)]; S.modal = { k: 'doc.agrEdit', id: a.id, cid: el.dataset.new ? 'new' : chg[0] || (a.pending || a.current).clauses[0]?.id, title: el.dataset.title, text: el.dataset.text }; render(); },
  agrEditGo: () => {
    const m = S.modal, cid = docField('aeCl'), text = docField('aeText').trim();
    if (cid === 'new' && !text) return toast($t('Write the text of the clause'));
    act(async () => { const a = await agApi(m.id, '/versions', { clause: { id: cid === 'new' ? null : cid, title: docField('aeTitle').trim(), text }, note: docField('aeNote') }); putAg(a); S.modal = null; S.dtab[a.id] = a.current ? 'diff' : 'text'; render(); return a; }, (a) => (a.pending && a.pending.consents.length === 1 ? $t('The change is waiting for consent. You accepted it automatically.') : $t('Saved')));
  },
  agrReview: (el) => { S.modal = { k: 'doc.agrReview', id: el.dataset.id }; render(); },
  agrReviewGo: () => {
    const m = S.modal;
    const clauses = [...document.querySelectorAll('.arC')].map((x) => ({ id: x.dataset.id || undefined, title: x.querySelector('.arT').value.trim(), text: x.querySelector('.arX').value.trim() })).filter((x) => x.text);
    if (!clauses.length) return toast($t('Add at least one clause'));
    const parties = [...document.querySelectorAll('.arP:checked')].map((x) => x.value);
    act(async () => { const a = await agApi(m.id, '/versions', { clauses, parties, note: docField('arNote') }); putAg(a); S.modal = null; S.dtab[a.id] = a.current ? 'diff' : 'text'; render(); return a; }, (a) => (a.pending ? $t('v{n} is waiting for consent: {names}', { n: a.pending.n, names: a.required.map(pnx).join(', ') }) : $t('Saved')));
  },
  agrTerminate: (el) => { if (!confirm($t('Propose to terminate the agreement? It ends only when every party accepts; until then it stays in force.'))) return; act(async () => { putAg(await agApi(el.dataset.id, '/versions', { terminate: true, note: $t('Termination') })); S.dtab[el.dataset.id] = 'diff'; render(); }, $t('Termination is waiting for consent')); },
  agrWithdraw: (el) => { if (!confirm($t('Withdraw your version? The version in force stays as it is.'))) return; act(async () => { putAg(await agApi(el.dataset.id, '/versions/pending', undefined, 'DELETE')); S.dtab[el.dataset.id] = 'text'; render(); }, $t('Withdrawn')); },
  extConsent: (el) => { S.modal = { k: 'doc.ext', id: el.dataset.id, w: el.dataset.w }; render(); },
  extGo: () => { const m = S.modal, note = docField('exNote').trim(); if (!note) return toast($t('Describe how the external party confirmed it')); act(async () => { putAg(await agApi(m.id, '/external-consent', { party: m.w, note })); closeDoc(); }, $t('Consent recorded')); },
};
const DOC_FIELDS = {
  pcVis: (el) => act(async () => { putPc(await pcApi(el.dataset.id, '', { visibility: el.value }, 'PATCH')); render(); }, () => $t('Visibility: {vis}', { vis: PVIS[el.value] })),
  pmOpt: (el) => { S.modal.opt = Number(el.value); S.modal.text = undefined; S.modal.note = docField('pmNote'); modal(); },
  naType: (el) => { Object.assign(S.modal, { type: el.value, title: docField('naTitle'), ext: docField('naExt'), clauses: docField('naCl'), parties: [...document.querySelectorAll('.naP:checked')].map((x) => x.value) }); modal(); },
  aeCl: (el) => { Object.assign(S.modal, { cid: el.value, title: undefined, text: undefined }); modal(); },
};

// Review cards for processes and agreements: step 1 of 2 is confirming it was said and concerns this document.
function docPropCard(p, A) {
  if (p.kind === 'proc') {
    const pc = pcById(p.process);
    if (!pc) return `<div class="hint">${$t('The process is no longer available')}</div>`;
    return `<div class="chips"><span class="kind ${AKCLS[p.akind] || 'add'}">${$t('Process change')}</span> <button class="lnk" data-a="go" data-h="process-${pc.id}">${esc(pc.title)}</button></div><div class="fields"><span>${AKIND[p.akind]} · ${targetLabel(pc, { kind: p.akind, target: p.section, step: p.step, before: p.before })}</span></div>${p.akind !== 'remove' ? `<textarea class="in" rows="2" style="width:100%;margin-top:6px" ${A('p.text')}>${esc(p.text || '')}</textarea>` : ''}<div class="route">${ico('route', 13)} ${$t('After you confirm, it becomes a draft change. Approves: {who}', { who: approverLabel(pc) })}</div>`;
  }
  if (p.kind === 'newproc') {
    const opts = [['team:', PLEVEL.team], ...S.d.projects.filter((x) => x.status !== 'archived').map((x) => [`project:${x.id}`, `${PLEVEL.project} · ${x.name}`]), ...S.d.hypotheses.map((h) => [`hypothesis:${h.id}`, `${PLEVEL.hypothesis} · ${hcode(h.id)} ${(h.then || '').slice(0, 40)}`])];
    const cur = `${p.level}:${p.level === 'hypothesis' ? p.hypothesis : p.level === 'project' ? p.project : ''}`;
    return `<div class="chips"><span class="kind ext">${$t('New process')}</span></div><input class="ttl" ${A('p.title')} value="${esc(p.title || '')}" placeholder="${$t('Title')}"><textarea class="in" rows="2" style="width:100%" ${A('p.summary')} placeholder="${$t('In short: what this process is')}">${esc(p.summary || '')}</textarea>${(p.steps || []).length ? `<ol class="dsteps" style="margin:6px 0 0 18px;font-size:13.5px">${p.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}<div class="fields"><label>${$t('Level')} <select ${A('p.levelRef')}>${opts.map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label></div>`;
  }
  if (p.kind === 'agr') {
    const a = agById(p.agreement);
    if (!a) return `<div class="hint">${$t('The agreement is no longer available')}</div>`;
    const old = p.clause && (a.pending || a.current)?.clauses.find((x) => x.id === p.clause);
    return `<div class="chips"><span class="kind rep">${$t('Agreement change')}</span> <button class="lnk" data-a="go" data-h="agreement-${a.id}">${esc(a.title)}</button></div><div class="fields"><span>${old ? $t('Clause “{title}”', { title: esc(old.title || '—') }) : $t('New clause')}</span>${old ? '' : `<input class="in" style="min-height:28px;font-size:13px" ${A('p.clauseTitle')} value="${esc(p.clauseTitle || '')}" placeholder="${$t('Clause title')}">`}</div>${old ? `<div class="diff"><div class="dwas"><small>${$t('now')}</small>${esc(old.text)}</div><div class="dnow"><small>${$t('proposed')}</small>${esc(p.text)}</div></div>` : ''}<textarea class="in" rows="2" style="width:100%;margin-top:6px" ${A('p.text')}>${esc(p.text || '')}</textarea><div class="route">${ico('route', 13)} ${$t('After you confirm, the new version waits for consent of every party: {names}', { names: esc(agParties(a).map(pnx).join(', ')) })}</div>`;
  }
  return `<div class="chips"><span class="kind ext">${$t('New agreement')}</span> <span class="chip">${ATYPE[p.atype] || ''}</span></div><input class="ttl" ${A('p.title')} value="${esc(p.title || '')}" placeholder="${$t('Title')}">${(p.clauses || []).map((x) => `<div style="font-size:13.5px;margin-top:4px"><b>${esc(x.title)}</b> ${esc(x.text)}</div>`).join('')}<div class="route">${ico('users', 13)} ${$t('Every party has to accept: {names}', { names: esc((p.parties || []).map(pnx).join(', ')) })}</div>`;
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
    const pg = r === 'assistant' ? pAssistant() : r === 'dashboard' ? pDashboard() : r === 'inbox' ? pInbox() : r.startsWith('review-') ? pReview() : r === 'tasks' ? pTasks() : r === 'knowledge' ? pKnowledge() : r.startsWith('knowledge-') ? pKnowledge(r.slice(10)) : r.startsWith('source-') ? pSource(r.slice(7)) : r === 'processes' ? pProcesses() : r.startsWith('process-') ? pProcess(r.slice(8)) : r === 'agreements' ? pAgreements() : r.startsWith('agreement-') ? pAgreement(r.slice(10)) : r === 'vision' ? pVision() : r === 'goals' ? pGoals() : r.startsWith('project-') ? pProject(r.slice(8)) : r.startsWith('hyp-') ? pHyp(r.slice(4)) : r.startsWith('person-') ? pPerson(r.slice(7)) : r === 'members' ? pMembers() : r === 'profile' ? pProfile() : r === 'roadmap' ? pRoadmap() : pDashboard();
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
async function switchTeam(id) { S.tid = id; S.drawer = null; S.goal = null; S.ckc = {}; S.review = null; S.applied = null; S.person = ''; S.proj = ''; S.kproj = ''; await reload(); }

/* ---------- actions ---------- */
const A = {
  navOpen: () => { S.navOpen = true; render(); },
  navClose: () => { S.navOpen = false; S.tmenu = false; render(); },
  go: (el) => { S.tmenu = false; S.navOpen = false; S.modal = null; if (el.dataset.h.startsWith('project-')) S.ptab = 'overview'; if (el.dataset.h.startsWith('source-')) S.srcView = null; go(el.dataset.h); },
  lang: (el) => { void setLang(el.dataset.v); },
  tmenu: () => { S.tmenu = !S.tmenu; render(); },
  team: (el) => { S.tmenu = false; act(() => switchTeam(el.dataset.v)); },
  newTeam: () => { S.tmenu = false; S.modal = { k: 'team', org: S.orgs.find((o) => o.id === S.d?.org?.id && o.role)?.id }; render(); },
  renameOrg: (el) => { const o = S.orgs.find((x) => x.id === el.dataset.id); const name = prompt($t('Organization name'), o?.name || ''); if (!name || !name.trim()) return; act(async () => { await api('PATCH', `/api/orgs/${encodeURIComponent(el.dataset.id)}`, { name: name.trim() }); await reloadMe(); await reload(); }, () => $t('Saved')); },
  goal: (el) => { S.goal = el.dataset.id; S.drawer = null; S.modal = null; render(); },
  period: (el) => { S.period = el.dataset.v; render(); },
  gtab: (el) => { S.gtab = el.dataset.v; if (R() !== 'goals') go('goals'); else render(); },
  toCheckin: (el) => { S.gtab = 'checkin'; S.goal = null; if (el?.dataset?.p) S.period = el.dataset.p; if (R() !== 'goals') go('goals'); else render(); },
  treeGo: () => { S.gtab = 'tree'; S.goal = null; go('goals'); },
  ckAll: (el) => { S.ckAll = el.dataset.v === '1'; render(); },
  ckc: (el) => { S.ckc[el.dataset.k] = el.dataset.v; el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el)); },
  ckSave: (el) => act(async () => {
    const id = el.dataset.k, body = { value: val('ckv-' + id), confidence: S.ckc[id] || krHit(id)?.k.confidence || 'on_track', note: val('ckn-' + id) };
    const g = await api('POST', T(`/goals/${el.dataset.g}/krs/${id}/checkins`), body);
    S.d.goals = GL().map((x) => (x.id === g.id ? g : x)); delete S.ckc[id]; render();
  }, () => $t('Check-in saved')),
  newGoal: (el) => openGoalModal({ level: el?.dataset?.level, project: el?.dataset?.proj, period: el?.dataset?.period }),
  editGoal: (el) => openGoalModal({ id: el.dataset.id, close: el.dataset.close === '1' }),
  delGoal: (el) => { if (!confirm($t('Delete the goal? Goals and hypotheses that contribute to its key results will lose the link.'))) return; act(async () => { await api('DELETE', T(`/goals/${el.dataset.id}`)); S.goal = null; await reload(); }, () => $t('Goal deleted')); },
  krAdd: () => { syncGoalModal(); if (S.modal.krs.length >= 5) return toast($t('No more than 5 KRs — otherwise they are no longer priorities')); S.modal.krs.push(blankKr()); modal(); },
  krDel: (el) => { syncGoalModal(); S.modal.krs.splice(Number(el.dataset.v), 1); if (!S.modal.krs.length) S.modal.krs.push(blankKr()); modal(); },
  goalSave: () => act(saveGoalModal, () => $t('Goal saved')),
  hview: (el) => { S.hview = el.dataset.v; render(); },
  hsort: (el) => { S.hsort = el.dataset.v; render(); },
  aiImp: (el) => { const h = hyp(el.dataset.id); saveHyp(h.id, { priority: { ...prOf(h), impact: Number(el.dataset.v) } }, $t('Priority updated')); },
  ntmGo: () => act(async () => {
    const name = val('ntmN').trim(); if (!name) throw new Error($t('Enter a name'));
    const orgs = S.orgs.filter((o) => o.role); const sel = S.modal.org || orgs[0]?.id || 'new';
    const body = { name };
    if (sel !== 'new') body.orgId = sel; else if (document.getElementById('ntmOrg')) { body.newOrgName = val('ntmOrg').trim(); if (!body.newOrgName) throw new Error($t('Enter the organization name')); }
    const t = await api('POST', '/api/teams', body); S.modal = null; await reloadMe(); await switchTeam(t.id); go('dashboard');
  }, () => $t('Team created')),
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
  open: (el) => { S.drawer = el.dataset.id; S.goal = null; S.modal = null; const t = tasks().find((x) => x.id === S.drawer); if (t?.unread) { t.unread = 0; api('POST', T(`/tasks/${t.id}/read`)).catch(() => {}); } render(); },
  closeD: () => { S.drawer = null; S.goal = null; render(); },
  dash: (el) => { S.dash = el.dataset.v; render(); },
  tasksTab: (el) => { S.tab = el.dataset.v; if (S.tab in S.taskDirs) S.dir = S.taskDirs[S.tab]; go('tasks'); },
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
    if (kind === 'goal') { if (goalById(id)) { S.goal = id; return go('goals'); } S.ptab = 'overview'; return go('project-' + id); }
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
  newNote: (el) => { S.modal = { k: 'note', proj: el.dataset.proj, hyp: el.dataset.hyp || null }; modal(); },
  saveNote: () => act(async () => {
    const m = S.modal;
    await api('POST', T('/knowledge'), { type: 'context', text: val('noteText'), scope: val('noteScope') || 'private', project: m.proj, hypothesis: m.hyp });
    S.modal = null;
    if (!m.hyp) S.ptab = 'kn';
    await reload();
  }, () => $t('Note saved')),
  newKn: (el) => { S.modal = { k: 'kn', proj: el?.dataset?.proj || '', hyp: el?.dataset?.hyp || '' }; modal(); },
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
  pjGo: () => act(async () => {
    const body = { name: val('pjN'), vision: val('pjV'), owner: val('pjO'), members: [...document.querySelectorAll('.pjM:checked')].map((x) => x.value) };
    const p = S.modal.id ? await api('PATCH', T(`/projects/${S.modal.id}`), body) : await api('POST', T('/projects'), body);
    S.modal = null; await reload(); go(`project-${p.id}`);
  }, () => $t('Project saved')),
  delProject: (el) => { if (!confirm($t('Delete the project? Its tasks will stay, without a project.'))) return; act(async () => { await api('DELETE', T(`/projects/${el.dataset.id}`)); S.modal = null; await reload(); go('dashboard'); }, () => $t('Project deleted')); },
  newHyp: (el) => { S.modal = { k: 'hyp', project: el.dataset.id }; modal(); },
  editHyp: (el) => { S.modal = { k: 'hyp', id: el.dataset.id }; modal(); },
  hyGo: () => act(async () => {
    const body = { if: val('hyIf'), then: val('hyThen'), because: val('hyBo'), project: val('hyP'), metric: val('hyM'), target: val('hyT'), current: val('hyC'), from: val('hyF') || null, to: val('hyTo') || null, successCriteria: val('hySc'), killCriteria: val('hyKc'), expectedImpact: val('hyImp') === '' ? null : Number(val('hyImp')) };
    // The KR list belongs to the project the form opened with; moving to another project drops the link on the server.
    if (body.project === (S.modal.id ? hyp(S.modal.id).project : S.modal.project)) body.kr = val('hyKr') || null;
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

Object.assign(A, DOC_ACTIONS);
async function applyReview() {
  const r = S.review; if (!r || r.item.status === 'done') return;
  const sel = r.props.filter((p) => p.on);
  if (!sel.length) return toast($t('Nothing selected'));
  const bad = sel.find((p) => (p.kind === 'task' && !p.title?.trim()) || (p.kind === 'kn' && !p.text?.trim()) || (p.kind === 'hyp' && (!p.if?.trim() || !p.then?.trim())) || (['newproc', 'newagr'].includes(p.kind) && !p.title?.trim()) || (p.kind === 'agr' && !p.text?.trim()) || (p.kind === 'proc' && p.akind !== 'remove' && !p.text?.trim()));
  if (bad) return toast($t('Fill in the empty cards or uncheck them'));
  await act(async () => {
    const res = await api('POST', T(`/inbox/${r.item.id}/apply`), { proposals: r.props, sourceScope: r.sourceScope });
    S.applied = { id: r.item.id, ...res }; scrollTo(0, 0); await reload();
  });
}

const F = {
  dir: (el) => { S.dir = el.value; S.taskDirs[S.tab] = el.value; render(); }, fperson: (el) => { S.person = el.value; render(); }, fproj: (el) => { S.proj = el.value; render(); }, fst: (el) => { S.fst = el.value; render(); },
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
  placementProject: (el) => {
    const select = document.getElementById(el.dataset.target);
    const selected = select.value;
    const keep = !el.value || hyp(selected)?.project === el.value ? selected : '';
    const replacement = document.createElement('div');
    replacement.innerHTML = selHyp(`class="in" id="${el.dataset.target}"`, keep, el.value);
    select.replaceWith(replacement.firstElementChild);
  },
  ntWho: (el) => { if (el.value === '__ext') { const v = askExternal(el, uid()); if (v) { el.insertAdjacentHTML('afterbegin', `<option value="${esc(v)}">${esc(v.slice(4))} (${$t('ext.')})</option>`); el.value = v; } } },
  'p.on': (el) => { prop(el.dataset.p).on = el.checked; S.review.dirty = true; render(); },
  'p.important': (el) => { prop(el.dataset.p).important = el.checked; S.review.dirty = true; },
  pst: (el) => act(async () => { await api('PATCH', T(`/projects/${el.dataset.id}`), { status: el.value }); await reload(); }, () => $t('Project status changed')),
  hst: (el) => {
    const h = hyp(el.dataset.id);
    if (el.value === 'testing' && h.status !== 'testing') {
      const busy = projHyps(h.project).filter((x) => x.status === 'testing' && x.id !== h.id).length;
      if (busy >= WIP_LIMIT && !confirm($t('The project already tests {n} hypotheses (WIP limit {limit}). Finish or stop one first. Start anyway?', { n: busy, limit: WIP_LIMIT }))) { el.value = h.status; return; }
      if (!h.killCriteria && !confirm($t('The hypothesis has no stop criterion. Define in advance when you stop it. Start testing anyway?'))) { el.value = h.status; return; }
    }
    act(async () => { await api('PATCH', T(`/hypotheses/${el.dataset.id}`), { status: el.value }); await reload(); }, () => $t('Hypothesis status: {status}', { status: HST[el.value] }));
  },
  hkr: (el) => saveHyp(el.dataset.id, { kr: el.value || null }, $t('Saved')),
  himp: (el) => saveHyp(el.dataset.id, { expectedImpact: el.value === '' ? null : Number(el.value) }, $t('Saved')),
  torg: (el) => { S.modal.name = val('ntmN'); S.modal.orgName = val('ntmOrg'); S.modal.org = el.value; modal(); },
  'g.level': (el) => { syncGoalModal(); const m = S.modal; m.level = el.value; m.align = ''; if (el.value !== 'team' && m.period.length === 4) m.period = curPeriod(); if (el.value === 'project' && !m.project) m.project = S.d.projects.find((x) => canProjectGoal(x))?.id; modal(); },
  'g.project': (el) => { syncGoalModal(); S.modal.project = el.value; modal(); },
  'g.period': (el) => { syncGoalModal(); S.modal.period = el.value; S.modal.align = ''; modal(); },
  'g.type': (el) => { syncGoalModal(); S.modal.type = el.value; modal(); },
  'g.align': (el) => { syncGoalModal(); S.modal.align = el.value; if (el.value) S.modal.reason = ''; modal(); },
  'g.reason': (el) => { syncGoalModal(); S.modal.reason = el.checked ? el.value : ''; if (S.modal.reason) S.modal.align = ''; modal(); },
  role: (el) => act(async () => { await api('PATCH', T(`/members/${el.dataset.id}`), { role: el.value }); await reload(); }, () => $t('Role changed')),
};
Object.assign(F, DOC_FIELDS);
// Proposal fields: data-f="p.<field>"
function onPropField(el) {
  const p = prop(el.dataset.p); if (!p) return;
  const k = el.dataset.f.slice(2);
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if ((k === 'owner' || k === 'requester') && v === '__ext') { v = askExternal(el, p[k]); if (!v) return; }
  if (k === 'levelRef') { const [level, ref] = v.split(':'); Object.assign(p, { level, project: level === 'project' ? ref : level === 'hypothesis' ? hyp(ref)?.project || null : null, hypothesis: level === 'hypothesis' ? ref : null }); S.review.dirty = true; return; }
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
  if (['project', 'hypothesis', 'due', 'kr'].includes(k)) v = v || null;
  if (v === (t[k] ?? null)) return;
  patchTask(t.id, { [k]: v }, k === 'status' ? $t('Status: {status}', { status: STL[v] }) : k === 'owner' ? $t('{name} will get the task', { name: pnx(v) }) : null);
}

document.addEventListener('click', (e) => { const el = e.target.closest('[data-a]'); if (!el) return; if (el.tagName === 'INPUT' && el.type !== 'button') return; const a = el.dataset.a; if (a === 'ovClose' && e.target !== el) return; if (A[a]) { e.preventDefault(); A[a](el, e); } });
document.addEventListener('change', (e) => { if (e.target.dataset?.r && R().startsWith('hyp-')) { const h = hyp(R().slice(4)); if (h) saveHyp(h.id, { priority: prOf(h) }); return; } const f = e.target.dataset?.f; if (!f) return; if (f.startsWith('p.')) return onPropField(e.target); if (f.startsWith('t.')) return onTaskField(e.target); if (F[f]) F[f](e.target); });
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
  else if (e.key === 'Escape') { if (S.navOpen) { S.navOpen = false; render(); } else if (S.modal) { recReset(); S.modal = null; modal(); } else if (S.drawer || S.goal) { S.drawer = null; S.goal = null; render(); } }
  else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && R().startsWith('review-') && !S.modal) { e.preventDefault(); applyReview(); }
  else if (!typing && !S.modal && !e.metaKey && !e.ctrlKey && ['i', 'I', 'ш', 'Ш'].includes(e.key)) { e.preventDefault(); A.add(); }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'assistant-question') assistantState().draft = e.target.value;
  if (e.target.dataset?.r) onPriorityInput(e.target);
  if (e.target.dataset?.kk === 'title' && S.modal?.k === 'goal') { const w = document.getElementById('kw-' + e.target.dataset.kr); if (w) w.style.display = ACTIVITY.test(e.target.value.trim()) ? '' : 'none'; }
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
