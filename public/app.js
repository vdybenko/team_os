/* TeamOS v0.1 — client. Vanilla JS, re-renders from state on every change (same approach as the prototype). */
(() => {
'use strict';

/* ---------- helpers ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = () => isoDay(new Date());
const D = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const diff = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const WD = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], WDL = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота'];
const MO = ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв', 'лип', 'серп', 'вер', 'жовт', 'лист', 'груд'];
const MOG = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const fd = (s) => { if (!s) return '—'; const d = D(s); return `${WD[d.getDay()]}, ${d.getDate()} ${MO[d.getMonth()]}`; };
const fds = (s) => { if (!s) return '—'; const d = D(String(s).slice(0, 10)); return `${d.getDate()} ${MO[d.getMonth()]}`; };
const fdt = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${d.getDate()} ${MO[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const I = { dash: 'M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z', inbox: 'M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z', tasks: 'M4 4h16v16H4zM8 12l3 3 5-6', kn: 'M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4zM5 16a4 4 0 0 1 4-4h10', vision: 'M12 3l9 9-9 9-9-9z', users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 20a5 5 0 0 0-4-5', gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12h3M2 12h3M12 2v3M12 19v3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2', search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5', plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18', lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4', file: 'M6 3h9l4 4v14H6zM14 3v5h5', chat: 'M4 5h16v11H9l-5 4z', warn: 'M12 3l10 18H2zM12 10v5M12 18v.5', mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3', note: 'M5 3h14v18H5zM9 8h6M9 12h6M9 16h3', arrow: 'M5 12h14M13 6l6 6-6 6', back: 'M19 12H5M11 6l-6 6 6 6', chev: 'M6 9l6 6 6-6', cmt: 'M4 5h16v11H9l-5 4z', route: 'M5 12h14M13 6l6 6-6 6', spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6', mail: 'M3 6h18v12H3zM3 6l9 7 9-7', drive: 'M8 3h8l6 11-4 7H6l-4-7z', out: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0', link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1' };
const ico = (n, s = 16) => `<svg class="i" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${I[n]}"/></svg>`;
const PALETTE = ['#1f4fd8', '#0b8a5f', '#b4441c', '#7a3fb0', '#a8326e', '#2f7f8f', '#8a6d00'];
const colorFor = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; };

const STL = { open: 'Відкрито', progress: 'В роботі', waiting: 'Очікує', done: 'Готово', cancelled: 'Скасовано' };
const HST = { draft: 'Чернетка', testing: 'Тестуємо', validated: 'Підтверджено', invalidated: 'Спростовано' };
const PST = { active: 'Активний', paused: 'На паузі', done: 'Завершено', archived: 'В архіві' };
const KT = { decision: 'Рішення', agreement: 'Домовленість', fact: 'Факт', process: 'Процес', context: 'Контекст' };
const TASK_SECTION_NAMES = { mine: 'Мої задачи', delegated: 'Делеговані' };
const ROLE = { owner: 'Owner', admin: 'Admin', member: 'Member' };
const ITYPE = { transcript: 'Транскрипт', email: 'Лист', chat: 'Чат', doc: 'Документ', note: 'Нотатка', routed: 'Пропозиція' };
const typeIco = (t) => ({ transcript: 'mic', email: 'mail', doc: 'drive', chat: 'chat', note: 'note', routed: 'route' })[t] || 'file';

/* ---------- API ---------- */
async function api(method, url, body) {
  const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.startsWith('/auth')) { S.me = null; location.hash = 'login'; render(); throw new Error('Потрібно увійти'); }
  if (!r.ok) throw new Error(data.error || (url.startsWith('/auth') ? `Request failed (${r.status}). Please try again.` : `Помилка ${r.status}`));
  return data;
}
const T = (p) => `/api/teams/${encodeURIComponent(S.tid)}${p}`;

/* ---------- state ---------- */
const S = {
  me: null, teams: [], tid: null, d: null, ai: false, cfg: { emailLink: false, dev: false }, loginEmail: '', loginSent: false, loginBusy: false, loginError: '',
  tmenu: false, tab: 'matrix', dir: 'all', person: '', proj: '', fst: 'open', grp: 'person', dash: 'all', itab: 'review',
  knt: 'all', kscope: 'all', kproj: '', klog: false, ptab: 'overview', vEdit: false,
  review: null, applied: null, drawer: null, modal: null, pendingJoin: null, busy: false,
};
const role = () => S.d?.role;
const isAdmin = () => ['owner', 'admin'].includes(role());
const personal = () => S.d?.team.kind === 'personal';
const M = () => Object.fromEntries((S.d?.members || []).map((m) => [m.id, m]));
const isExt = (w) => typeof w === 'string' && w.startsWith('ext:');
const pn = (w) => (!w ? '—' : isExt(w) ? w.slice(4) : M()[w]?.name || 'Колишній учасник');
const pnx = (w) => (isExt(w) ? `${w.slice(4)} (зовн.)` : pn(w));
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

/* ---------- components ---------- */
const dueChip = (t) => {
  if (!t.due) return '<span class="chip">Без дедлайну</span>';
  if (!isOpen(t)) return `<span class="chip">${fd(t.due)}</span>`;
  const n = diff(TODAY(), t.due); const c = n < 0 ? 'red' : n <= 1 ? 'amber' : '';
  const l = n < 0 ? `Прострочено · ${fds(t.due)}` : n === 0 ? 'Сьогодні' : n === 1 ? 'Завтра' : fd(t.due);
  return `<span class="chip ${c}">${l}</span>`;
};
const cmt = (t) => (t.comments.length ? `<span class="cmt ${t.unread ? 'new' : ''}">${ico('cmt', 13)}${t.comments.length}</span>` : '');
const who = (t) => t.owner === uid() && t.requester === uid() ? '<span>собі</span>'
  : t.owner === uid() ? `<span>я → ${esc(pnx(t.requester))}</span>`
  : `${av(t.owner, 18)}<span>${esc(pnx(t.owner))}${t.requester !== uid() ? ' ← ' + esc(pnx(t.requester)) : ''}</span>`;
const trow = (t) => `<button class="trow" data-a="open" data-id="${t.id}"><span class="st ${t.status}" title="${STL[t.status]}"></span><span class="tt"><b>${esc(t.title)}</b><span class="mt">${who(t)}${dueChip(t)}${tag(t.project)}${t.hypothesis ? `<span class="chip">${hcode(t.hypothesis)}</span>` : ''}${cmt(t)}${t.canEdit ? '' : ico('lock', 12)}</span></span></button>`;
const kcard = (t) => `<div class="kc" draggable="${t.canEdit}" data-drag="${t.id}" data-a="open" data-id="${t.id}"><b>${esc(t.title)}</b><div class="mt">${av(t.owner, 18)}${dueChip(t)}${tag(t.project)}${cmt(t)}${t.canEdit ? '' : ico('lock', 12)}</div></div>`;
const memberOpts = (val) => (S.d?.members || []).map((m) => `<option value="${m.id}" ${m.id === val ? 'selected' : ''}>${esc(m.name)}${m.id === uid() ? ' (я)' : ''}</option>`).join('');
const selWho = (attrs, val, ext = true) => `<select ${attrs}>${memberOpts(val)}${ext && isExt(val) ? `<option value="${esc(val)}" selected>${esc(val.slice(4))} (зовн.)</option>` : ''}${ext ? '<option value="__ext">+ Зовнішній контакт…</option>' : ''}</select>`;
const selProj = (attrs, val) => `<select ${attrs}><option value="">Без проєкту</option>${(S.d?.projects || []).filter((p) => p.status !== 'archived' || p.id === val).map((p) => `<option value="${p.id}" ${p.id === val ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`;
const selHyp = (attrs, val, proj) => `<select ${attrs}><option value="">Без гіпотези</option>${(S.d?.hypotheses || []).filter((h) => !proj || h.project === proj).map((h) => `<option value="${h.id}" ${h.id === val ? 'selected' : ''}>${hcode(h.id)} · ${esc((h.then || '').slice(0, 36))}…</option>`).join('')}</select>`;
const stmt = (h) => `<span class="stmt"><em>Якщо</em> ${esc(h.if)}, <em>то</em> ${esc(h.then)}${h.because ? `, <em>бо</em> ${esc(h.because)}` : ''}.</span>`;
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
  const res = await fetch('/api/me', { credentials: 'same-origin' });
  if (res.status === 401) { if (!R().startsWith('join-')) location.hash = 'login'; return render(); }
  const me = await res.json();
  Object.assign(S, { me: me.user, teams: me.teams, ai: me.ai });
  if (S.pendingJoin) { location.hash = 'join-' + S.pendingJoin; return render(); }
  const last = (() => { try { return localStorage.getItem('teamos.team'); } catch { return null; } })();
  const real = S.teams.filter((t) => t.kind !== 'personal');
  S.tid = S.teams.find((t) => t.id === last)?.id || real[0]?.id || S.teams[0]?.id;
  if (!real.length && !last) { location.hash = 'onboarding'; return render(); }
  await reload();
  if (['login', 'onboarding'].includes(R())) location.hash = 'dashboard';
}
async function reloadMe() { const me = await api('GET', '/api/me'); Object.assign(S, { me: me.user, teams: me.teams, ai: me.ai }); }
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

/* ---------- shell ---------- */
function nav() {
  const r = R(), on = (h) => (r === h || r.startsWith(h + '-') ? 'on' : '');
  const team = S.d.team, ib = S.d.inbox.filter((i) => i.status === 'review').length;
  const projs = S.d.projects.filter((p) => p.status !== 'archived');
  return `<button class="teamsw" data-a="tmenu"><span class="logo">${esc(team.kind === 'personal' ? 'Я' : team.name.slice(0, 2).toUpperCase())}</span><span class="lbl">${esc(team.name)}</span><span class="lbl" style="margin-left:auto">${ico('chev', 14)}</span></button>
  ${S.tmenu ? `<div class="tmenu">${S.teams.map((t) => `<button data-a="team" data-v="${t.id}"><span class="logo">${esc(t.kind === 'personal' ? 'Я' : t.name.slice(0, 2).toUpperCase())}</span>${esc(t.name)}${t.id === S.tid ? ' ✓' : ''}</button>`).join('')}<button data-a="newTeam">${ico('plus')}Створити команду</button></div>` : ''}
  <button class="srch" data-a="ask">${ico('search', 15)}<span class="lbl">Пошук</span><kbd>⌘K</kbd></button>
  <button class="nv ${on('dashboard')}" data-a="go" data-h="dashboard">${ico('dash')}<span class="lbl">Дашборд</span></button>
  <button class="nv ${on('inbox') || on('review')}" data-a="go" data-h="inbox">${ico('inbox')}<span class="lbl">Інбокс</span>${ib ? `<span class="bd">${ib}</span>` : ''}</button>
  <button class="nv ${on('tasks')}" data-a="go" data-h="tasks">${ico('tasks')}<span class="lbl">Задачі</span></button>
  <button class="nv ${on('knowledge')}" data-a="go" data-h="knowledge">${ico('kn')}<span class="lbl">Знання</span></button>
  <div class="sect">${personal() ? 'Мій простір' : 'Team Space'}</div>
  <button class="nv ${on('vision')}" data-a="go" data-h="vision">${ico('vision')}<span class="lbl">${personal() ? 'Vision' : 'Team vision'}</span></button>
  ${projs.map((p) => `<button class="nv ${on('project-' + p.id)}" data-a="go" data-h="project-${p.id}"><span class="dot" style="--c:${p.color}"></span><span class="lbl">${esc(p.name)}</span></button>${S.d.hypotheses.filter((h) => h.project === p.id).map((h) => `<button class="nv sub ${r === 'hyp-' + h.id ? 'on' : ''}" data-a="go" data-h="hyp-${h.id}">${hcode(h.id)} · ${HST[h.status]}</button>`).join('')}`).join('')}
  ${isAdmin() ? `<button class="nv" data-a="newProject">${ico('plus')}<span class="lbl">Новий проєкт</span></button>` : ''}
  <div class="spacer"></div>
  ${personal() ? '' : `<button class="nv ${on('members')}" data-a="go" data-h="members">${ico('users')}<span class="lbl">Учасники</span></button>`}
  <button class="nv ${on('profile')}" data-a="go" data-h="profile">${ico('gear')}<span class="lbl">Профіль</span></button>
  <button class="nv ${on('roadmap')}" data-a="go" data-h="roadmap">${ico('route')}<span class="lbl">Roadmap</span></button>
  <div class="me">${av(uid(), 28)}<span class="lbl"><b>${esc(S.me.name)}</b><br><span class="hint">${ROLE[role()]}</span></span><button class="btn ghost sm lbl" style="margin-left:auto" data-a="logout" title="Вийти">${ico('out', 14)}</button></div>`;
}
function top() {
  return `${S.ai ? '' : `<span class="chip amber" title="Налаштуй AI-провайдер на сервері">AI-аналіз вимкнено</span>`}<div class="spacer"></div><button class="btn pri" data-a="add">${ico('plus')}Додати в інбокс <kbd style="background:none;color:inherit;border-color:#fff5">I</kbd></button>`;
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
  const h = new Date().getHours(), hi = h < 12 ? 'Доброго ранку' : h < 18 ? 'Добрий день' : 'Добрий вечір';
  const d = new Date();
  return `<div class="hd"><div><h1>${hi}, ${esc(S.me.name.split(' ')[0])}</h1><div class="sub">${WDL[d.getDay()][0].toUpperCase() + WDL[d.getDay()].slice(1)}, ${d.getDate()} ${MOG[d.getMonth()]}</div></div></div>
  <div class="chips" style="margin-bottom:20px"><button class="chip big" data-a="go" data-h="inbox"><b>${rv.length}</b> чекають review</button>${proc.length ? `<span class="chip big"><span class="spin"></span> <b>${proc.length}</b> аналізується</span>` : ''}<span class="chip big" style="${over ? 'color:var(--red)' : ''}"><b>${over}</b> прострочено</span>${unr.length ? `<span class="chip big" style="color:var(--red)"><b>${unr.length}</b> з новими коментарями</span>` : ''}</div>
  <div class="grid g3">
  <div class="col"><div class="card"><h2>${TASK_SECTION_NAMES.mine} <span class="seg sm" style="margin-left:auto">${[['all', 'Всі'], ['team', 'Команді'], ['ext', 'Зовнішнім']].map(([k, l]) => `<button class="${S.dash === k ? 'on' : ''}" data-a="dash" data-v="${k}">${l}</button>`).join('')}</span></h2>${mf.length ? mf.map(trow).join('') : `<div class="empty">Немає відкритих комітментів.<br><button class="btn sm" style="margin-top:10px" data-a="newTask">${ico('plus', 13)} Нова задача</button></div>`}</div>
  ${unr.length ? `<div class="card"><h2>Нові коментарі</h2>${unr.map((t) => { const c = t.comments.at(-1); return `<button class="trow" data-a="open" data-id="${t.id}">${av(c.author)}<span class="tt"><b>${esc(t.title)}</b><span class="mt">${esc(c.text.slice(0, 120))}</span></span></button>`; }).join('')}</div>` : ''}</div>
  <div class="col"><div class="card"><h2>${TASK_SECTION_NAMES.delegated} <button class="lnk" data-a="tasksTab" data-v="delegated">Усі →</button></h2>${Object.keys(byP).length ? Object.entries(byP).map(([pid, ts]) => { const od = ts.filter((t) => t.due && diff(TODAY(), t.due) < 0).length; const nx = ts.filter((t) => t.due).sort((a, b) => (a.due < b.due ? -1 : 1))[0]; return `<button class="trow" data-a="${isExt(pid) ? 'tasksTab' : 'go'}" data-v="delegated" data-h="person-${esc(pid)}">${av(pid, 32)}<span class="tt"><b>${esc(pnx(pid))}</b><span class="mt"><span>${ts.length} відкритих</span>${od ? `<span class="chip red">${od} прострочено</span>` : ''}${nx ? `<span>найближчий: ${fd(nx.due)}</span>` : ''}</span></span>${ico('arrow', 14)}</button>`; }).join('') : '<div class="empty">Ти ще нічого не делегував.<br>Задачі з’являться після розбору мітингу.</div>'}</div>
  <div class="card"><h2>Інбокс <button class="lnk" data-a="go" data-h="inbox">Відкрити →</button></h2>${rv.length ? rv.slice(0, 5).map((i) => `<button class="trow" data-a="go" data-h="review-${i.id}"><span class="iico">${ico(typeIco(i.type))}</span><span class="tt"><b>${esc(i.title)}</b><span class="mt">${propCount(i)} · ${esc(i.origin)}</span></span><span class="btn sm">Review</span></button>`).join('') : `<div class="empty">Інбокс розібраний.<br><button class="btn sm" style="margin-top:10px" data-a="add">${ico('plus', 13)} Кинути транскрипт</button></div>`}</div></div>
  <div class="col"><div class="card"><h2>Нещодавні знання <button class="lnk" data-a="go" data-h="knowledge">Знання →</button></h2>${dec.map((k) => `<div style="padding:7px 0;border-bottom:1px solid var(--line);font-size:14px"><span class="ty ${k.type}">${KT[k.type]}</span> ${esc(k.text)}<div class="hint">${fds(k.date)} ${tag(k.project)}</div></div>`).join('') || '<div class="empty">Поки порожньо</div>'}</div>
  <div class="card"><h2>Активні гіпотези</h2>${act.map((h) => { const ts = tasks().filter((t) => t.hypothesis === h.id), dn = ts.filter((t) => t.status === 'done').length; return `<button class="trow" data-a="go" data-h="hyp-${h.id}"><span class="tt"><b>${hcode(h.id)} · ${esc(h.then)}</b><span class="mt">${av(h.owner, 18)}${h.to ? `<span>${diff(TODAY(), h.to) >= 0 ? 'ще ' + diff(TODAY(), h.to) + ' дн.' : 'термін минув'}</span>` : ''}<span>${dn}/${ts.length} задач</span>${tag(h.project)}</span></span></button>`; }).join('') || '<div class="empty">Немає гіпотез у статусі «Тестуємо»</div>'}</div></div>
  </div>`;
}
const propCount = (i) => { const c = i.counts || {}; const parts = [['task', 'задач'], ['status', 'статусів'], ['kn', 'знань'], ['hyp', 'гіпотез'], ['project', 'проєктів']].filter(([k]) => c[k]).map(([k, l]) => `${c[k]} ${l}`); return parts.join(' · ') || 'без пропозицій'; };

function pInbox() {
  const it = S.d.inbox, c = (k) => it.filter((i) => i.status === k).length;
  const tabs = [['review', 'Чекають review'], ['processing', 'Обробляються'], ['done', 'Розібрані'], ['ignored', 'Пропущені'], ['failed', 'Помилки']].filter(([k]) => k !== 'failed' || c('failed'));
  const list = it.filter((i) => i.status === S.itab);
  return `<div class="hd"><div><h1>Інбокс</h1><div class="sub">Особистий: сирі джерела бачиш тільки ти. Команді потрапляє лише те, що ти підтвердиш.</div></div><div class="act"><button class="btn pri" data-a="add">${ico('plus')}Додати</button></div></div>
  <div class="seg" style="margin-bottom:14px">${tabs.map(([k, l]) => `<button class="${S.itab === k ? 'on' : ''}" data-a="itab" data-v="${k}">${l} · ${c(k)}</button>`).join('')}</div>
  <div class="card" style="padding:0">${list.length ? list.map((i) => `<div class="irow" data-a="go" data-h="review-${i.id}"><span class="iico">${ico(typeIco(i.type), 18)}</span><span style="flex:1"><b>${esc(i.title)}</b><div class="hint">${ITYPE[i.type] || ''} · ${esc(i.origin)} · ${fd(i.date)}</div></span>${i.status === 'review' ? `<span class="chips"><span class="chip">${propCount(i)}</span></span><span class="btn sm pri">Review ${ico('arrow', 13)}</span>` : i.status === 'processing' ? '<span class="chip amber"><span class="spin"></span> Аналізую…</span>' : i.status === 'failed' ? `<span class="chip red">Помилка</span>` : `<span class="hint">${esc(i.result || '')}</span>`}</div>`).join('') : `<div class="empty">Тут порожньо${S.itab === 'review' ? `<br><button class="btn sm" style="margin-top:10px" data-a="add">${ico('plus', 13)} Додати транскрипт</button>` : ''}</div>`}</div>`;
}

/* ---------- review ---------- */
async function openReview(id, quiet) {
  try {
    const item = await api('GET', T(`/inbox/${encodeURIComponent(id)}`));
    if (quiet && S.review?.item.id === id && S.review.dirty) return;
    S.review = { item, props: structuredClone(item.proposals || []), dirty: false };
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
  if (S.applied?.id === item.id) { const a = S.applied; return `<div class="done-box"><div class="big">Готово</div><p style="font-size:17px;margin:14px 0 4px">${esc(a.lines.join(' · ') || 'Нічого не збережено')}</p><p class="hint">${a.notified.length ? 'Сповіщення отримають: ' + esc(a.notified.join(', ')) : 'Усе збережено'}</p>${a.notes.map((n) => `<p class="hint danger">${esc(n)}</p>`).join('')}<div class="chips" style="justify-content:center;margin-top:18px"><button class="btn pri" data-a="go" data-h="tasks">До задач</button><button class="btn" data-a="go" data-h="knowledge">До знань</button><button class="btn" data-a="go" data-h="inbox">До інбоксу</button></div></div>`; }
  const lines = (item.source || '').split('\n');
  const tsRe = /^\s*\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\s*/;
  const head = `<div class="hd"><div><button class="btn ghost sm" data-a="go" data-h="inbox">${ico('back', 14)} Інбокс</button><h1 style="margin-top:8px">${esc(item.title)}</h1><div class="sub inl">${ITYPE[item.type] || ''} · ${esc(item.origin)} · ${fd(item.date)}${(item.participants || []).filter((p) => p.member_id).map((p) => `<span class="alias">${esc(p.name_in_source)} → ${esc(pn(p.member_id))} ✓</span>`).join('')}</div></div><div class="act">${item.type !== 'routed' && item.status !== 'processing' ? `<button class="btn" data-a="reanalyze">${ico('spark')}Аналізувати ще раз</button>` : ''}${['review', 'ignored'].includes(item.status) ? `<button class="btn" data-a="ignoreItem">${item.status === 'ignored' ? 'Повернути в review' : 'Пропустити'}</button>` : ''}<button class="btn ghost" data-a="delItem" title="Видалити запис">${ico('trash')}</button></div></div>`;
  const src = `<div class="card src" data-keep="src">${(item.summary || []).length ? `<div class="sum"><b>Коротко</b><ul>${item.summary.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}${lines.map((l, i) => { const m = tsRe.exec(l); return `<div class="ln ${m ? '' : 'plain'}" id="ln-${i}">${m ? `<span class="ts">${esc(m[1])}</span>` : ''}<span>${esc(m ? l.slice(m[0].length) : l) || '&nbsp;'}</span></div>`; }).join('')}<p class="hint" style="margin:10px 8px 0">${ico('lock', 13)} Сирий текст бачиш тільки ти.</p></div>`;
  if (item.status === 'processing') return head + `<div class="rv">${src}<div class="card"><div class="empty"><span class="spin"></span><br><br>AI аналізує джерело… зазвичай 20–60 секунд.<br>Можна піти — запис чекатиме в інбоксі.</div></div></div>`;
  const sec = (k, l) => { const ps = props.filter((p) => p.kind === k); return ps.length ? `<div class="sec"><h2>${l}</h2><span class="n">${ps.length}</span></div>${ps.map((p) => propCard(p, lines)).join('')}` : ''; };
  const on = props.filter((p) => p.on).length;
  const closed = item.status === 'done';
  const body = `${item.error ? `<div class="err">${esc(item.error)}</div>` : ''}${closed ? `<div class="lock" style="margin-bottom:12px">${ico('lock')}<span>Запис розібрано: ${esc(item.result || '')}</span></div>` : ''}
  ${sec('task', 'Нові комітменти')}${sec('status', 'Оновлення статусів')}${sec('kn', 'Знання')}${sec('project', 'Нові проєкти')}${sec('hyp', 'Нові гіпотези')}
  ${!props.length ? `<div class="card"><div class="empty">${S.ai ? 'AI не знайшов, що зберегти.' : 'Пропозицій немає.'} Додай вручну:</div></div>` : ''}
  ${closed ? '' : `<div class="chips" style="margin:12px 0"><button class="btn sm" data-a="addProp" data-v="task">${ico('plus', 13)} Задача</button><button class="btn sm" data-a="addProp" data-v="kn">${ico('plus', 13)} Знання</button><button class="btn sm" data-a="addProp" data-v="hyp">${ico('plus', 13)} Гіпотеза</button></div>
  <div class="bar"><b>Обрано ${on} з ${props.length}</b><span class="hint">Наведи на картку — підсвічу цитату зліва</span><button class="btn" data-a="saveDraft">Зберегти чернетку</button><button class="btn pri" data-a="apply" ${on ? '' : 'disabled'}>Застосувати обране <kbd style="background:none;color:inherit;border-color:#fff5">⌘↵</kbd></button></div>`}`;
  return head + `<div class="rv">${src}<div>${body}</div></div>`;
}
function propCard(p, lines) {
  const hl = quoteLines(lines, p.quote).join(',');
  const q = p.quote ? `<div class="ev">“${esc(p.quote)}”${p.ts ? `<span class="ts">${esc(p.ts)}</span>` : ''}</div>` : '';
  const A = (f) => `data-f="${f}" data-p="${p.id}"`;
  let b = '';
  if (p.kind === 'task') {
    b = `<input class="ttl" ${A('p.title')} value="${esc(p.title)}" placeholder="Що зробити" aria-label="Назва задачі"><div class="fields"><label>Виконавець ${selWho(A('p.owner'), p.owner)}</label><label>Постановник ${selWho(A('p.requester'), p.requester)}</label><label>Дедлайн <input type="date" ${A('p.due')} value="${p.due || ''}"></label><label>Проєкт ${selProj(A('p.project'), p.project)}</label><label>Гіпотеза ${selHyp(A('p.hypothesis'), p.hypothesis, p.project)}</label><label><input type="checkbox" ${A('p.important')} ${p.important ? 'checked' : ''}> Важливо</label></div>`;
    if (p.owner && p.owner !== uid() && !isExt(p.owner)) b += `<div class="route">${ico('route', 13)} ${esc(pn(p.owner))} побачить задачу в розділі «${TASK_SECTION_NAMES.mine}»</div>`;
    if (p.requester && p.requester !== uid() && !isExt(p.requester)) b += `<div class="route">${ico('lock', 13)} Статус змінюватиме ${esc(pn(p.requester))} — постановник</div>`;
    if (p.dup) { const d = tasks().find((x) => x.id === p.dup); if (d) b += `<div class="warn">${ico('warn')} Схоже на існуючу задачу «${esc(d.title)}»<span class="seg sm"><button class="${p.merge ? 'on' : ''}" data-a="pset" data-p="${p.id}" data-k="merge" data-v="1">Об’єднати</button><button class="${p.merge ? '' : 'on'}" data-a="pset" data-p="${p.id}" data-k="merge" data-v="0">Створити нову</button></span></div>`; }
  } else if (p.kind === 'status') {
    const t = tasks().find((x) => x.id === p.task);
    if (!t) b = '<div class="hint">Задача більше недоступна</div>';
    else {
      b = `<div style="font-weight:650">«${esc(t.title)}»</div><div class="fields" style="margin-top:6px"><span class="chip">${STL[t.status]}</span> → <select ${A('p.to')}>${Object.entries(STL).map(([k, l]) => `<option value="${k}" ${k === p.to ? 'selected' : ''}>${l}</option>`).join('')}</select>${av(t.owner, 18)} ${esc(pnx(t.owner))}</div>`;
      if (!t.canEdit) b += `<div class="route">${ico('route', 13)} Задачу поставив ${esc(pnx(t.controller))} — пропозиція піде йому на підтвердження</div>`;
    }
  } else if (p.kind === 'kn') {
    b = `<div class="fields" style="margin-bottom:6px"><select ${A('p.type')}>${Object.entries(KT).map(([k, l]) => `<option value="${k}" ${k === p.type ? 'selected' : ''}>${l}</option>`).join('')}</select>${personal() ? '' : `<span class="seg sm"><button class="${p.scope === 'private' ? 'on' : ''}" data-a="pset" data-p="${p.id}" data-k="scope" data-v="private">${ico('lock', 12)} Тільки я</button><button class="${p.scope !== 'private' ? 'on' : ''}" data-a="pset" data-p="${p.id}" data-k="scope" data-v="team">${ico('users', 12)} Команда</button></span>`}<label>Проєкт ${selProj(A('p.project'), p.project)}</label></div><input class="ttl" ${A('p.text')} value="${esc(p.text)}" placeholder="Текст рішення / факту" aria-label="Текст знання"><input class="in" style="width:100%;font-size:13px" ${A('p.why')} value="${esc(p.why || '')}" placeholder="Чому (необов’язково)">`;
    if (p.conflict) { const k = S.d.knowledge.find((x) => x.id === p.conflict); if (k) b += `<div class="warn">${ico('warn')} Суперечить запису від ${fds(k.date)}: «${esc(k.text)}»<span class="seg sm"><button class="${p.res === 'replace' ? 'on' : ''}" data-a="pset" data-p="${p.id}" data-k="res" data-v="replace">Замінити старе</button><button class="${p.res !== 'replace' ? 'on' : ''}" data-a="pset" data-p="${p.id}" data-k="res" data-v="both">Зберегти обидва</button></span></div>`; }
  } else if (p.kind === 'project') {
    b = `<div class="hint">Новий проєкт${isAdmin() ? '' : ' · потрібна роль Admin'}</div><input class="ttl" ${A('p.name')} value="${esc(p.name)}" placeholder="Назва проєкту"><textarea class="in" rows="2" ${A('p.vision')} placeholder="Vision">${esc(p.vision || '')}</textarea>`;
  } else {
    b = `<div class="hint">Нова гіпотеза (чернетка)</div><div class="grid" style="gap:6px;margin:6px 0"><label class="fl">Якщо<input class="in" ${A('p.if')} value="${esc(p.if || '')}"></label><label class="fl">то<input class="in" ${A('p.then')} value="${esc(p.then || '')}"></label><label class="fl">бо<input class="in" ${A('p.because')} value="${esc(p.because || '')}"></label></div><div class="fields"><label>Проєкт ${selProj(A('p.project'), p.project)}</label><label>Відповідальний ${selWho(A('p.owner'), p.owner, false)}</label><label>Метрика <input class="in" style="min-height:28px;font-size:13px" ${A('p.metric')} value="${esc(p.metric || '')}"></label></div>`;
  }
  return `<div class="prop ${p.on ? '' : 'off'}" data-ev="${hl}"><input type="checkbox" ${A('p.on')} ${p.on ? 'checked' : ''} aria-label="Зберегти"><div class="pbody">${b}${q}<div class="pmeta">${p.manual ? '<span class="hint">Додано вручну</span>' : `<span class="conf ${p.conf === 'high' ? '' : 'med'}">${p.conf === 'high' ? 'Висока впевненість' : 'Середня впевненість — перевір'}</span>`}<button class="btn ghost sm" style="margin-left:auto" data-a="delProp" data-p="${p.id}" title="Прибрати">${ico('x', 13)}</button></div></div></div>`;
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
  const views = [['matrix', 'Матриця'], ['kanban', 'Канбан'], ['list', 'Список'], ['delegated', TASK_SECTION_NAMES.delegated]];
  let ts = filteredTasks();
  const people = [...new Set(tasks().flatMap((t) => [t.owner, t.requester]))].filter((w) => w && w !== uid());
  const f = `<div class="chips" style="margin-bottom:16px;align-items:center"><select class="in" data-f="dir" aria-label="Напрям"><option value="all">Усі напрями</option><option value="mine" ${S.dir === 'mine' ? 'selected' : ''}>${TASK_SECTION_NAMES.mine}</option><option value="owed" ${S.dir === 'owed' ? 'selected' : ''}>${TASK_SECTION_NAMES.delegated}</option>${isAdmin() && !personal() ? `<option value="team" ${S.dir === 'team' ? 'selected' : ''}>Між іншими (видно адмінам)</option>` : ''}</select><select class="in" data-f="fperson" aria-label="Людина"><option value="">Усі люди</option>${people.map((p) => `<option value="${esc(p)}" ${S.person === p ? 'selected' : ''}>${esc(pnx(p))}</option>`).join('')}</select><select class="in" data-f="fproj" aria-label="Проєкт"><option value="">Усі проєкти</option>${S.d.projects.map((p) => `<option value="${p.id}" ${S.proj === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>${S.tab === 'list' ? `<select class="in" data-f="fst" aria-label="Статус"><option value="open">Відкриті</option><option value="all" ${S.fst === 'all' ? 'selected' : ''}>Усі статуси</option>${Object.entries(STL).map(([k, l]) => `<option value="${k}" ${S.fst === k ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}${role() === 'member' ? `<span class="hint">${ico('lock', 13)} Ти бачиш лише задачі, де ти виконавець або постановник</span>` : ''}</div>`;
  let body = '';
  if (S.tab === 'matrix') {
    const o = ts.filter(isOpen), Q = [['11', 'Зробити зараз', 'Терміново і важливо'], ['01', 'Запланувати', 'Важливо, не терміново'], ['10', 'Делегувати', 'Терміново, не важливо'], ['00', 'Відкинути', 'Ні те, ні інше']];
    body = `<div class="mx">${Q.map(([k, l, s]) => { const it = o.filter((t) => (urgent(t) ? '1' : '0') + (t.important ? '1' : '0') === k); return `<div class="q q${k}" data-drop="q:${k}"><h3>${l} <small>${s} · ${it.length}</small></h3>${it.map((t) => `<div draggable="${t.canEdit}" data-drag="${t.id}">${trow(t)}</div>`).join('') || '<div class="empty">Перетягни сюди задачу</div>'}</div>`; }).join('')}</div><p class="hint" style="margin-top:12px">Терміновість — з дедлайну (≤ ${urgentDays()} дн.), важливість — прапорець. Перетягувати може лише постановник задачі.</p>`;
  } else if (S.tab === 'kanban') {
    body = `<div class="kb">${['open', 'progress', 'waiting', 'done'].map((s) => { const it = ts.filter((t) => t.status === s); return `<div class="kcol" data-drop="st:${s}"><h3><span class="st ${s}"></span>${STL[s]} <span class="hint">${it.length}</span></h3>${it.map(kcard).join('')}</div>`; }).join('')}</div>`;
  } else if (S.tab === 'list') {
    if (S.fst === 'open') ts = ts.filter(isOpen); else if (S.fst !== 'all') ts = ts.filter((t) => t.status === S.fst);
    const key = (t) => (S.grp === 'person' ? t.owner : S.grp === 'project' ? t.project || '—' : 'all'); const g = {};
    ts.sort((a, b) => ((a.due || '9') < (b.due || '9') ? -1 : 1)).forEach((t) => (g[key(t)] = g[key(t)] || []).push(t));
    body = `<div class="chips" style="margin-bottom:10px;align-items:center"><span class="hint">Групувати:</span><span class="seg sm">${[['person', 'За виконавцем'], ['project', 'За проєктом'], ['none', 'Без групування']].map(([k, l]) => `<button class="${S.grp === k ? 'on' : ''}" data-a="grp" data-v="${k}">${l}</button>`).join('')}</span></div><div class="card" style="padding:4px 6px;overflow-x:auto">${ts.length ? `<table><thead><tr><th>Задача</th><th>Виконавець</th><th>Постановник</th><th>Дедлайн</th><th>Статус</th><th>Проєкт</th><th>Гіпотеза</th><th>Джерело</th></tr></thead><tbody>${Object.entries(g).map(([k, it]) => `${S.grp !== 'none' ? `<tr class="grp"><td colspan="8">${S.grp === 'person' ? esc(pnx(k)) : esc(prj(k)?.name || 'Без проєкту')} · ${it.length}</td></tr>` : ''}${it.map((t) => `<tr data-a="open" data-id="${t.id}"><td><b style="font-weight:600">${esc(t.title)}</b> ${cmt(t)}</td><td>${av(t.owner, 20)} ${esc(pnx(t.owner))}</td><td>${esc(pnx(t.requester))}</td><td>${dueChip(t)}</td><td><span class="st ${t.status}" style="display:inline-block;vertical-align:-2px"></span> ${STL[t.status]}</td><td>${tag(t.project)}</td><td>${t.hypothesis ? hcode(t.hypothesis) : ''}</td><td class="hint">${esc(t.source?.itemTitle || '')}</td></tr>`).join('')}`).join('')}</tbody></table>` : '<div class="empty">Немає задач за цими фільтрами</div>'}</div>`;
  } else {
    const d = tasks().filter((t) => t.requester === uid() && t.owner !== uid()), g = {}; d.forEach((t) => (g[t.owner] = g[t.owner] || []).push(t));
    body = `<div class="grid g2">${Object.entries(g).map(([pid, it]) => { const o = it.filter(isOpen), od = o.filter((t) => t.due && diff(TODAY(), t.due) < 0).length, nc = it.filter((t) => t.unread).length; return `<div class="card"><h2>${av(pid, 28)} ${esc(pnx(pid))}${isExt(pid) ? '' : `<button class="btn sm" style="margin-left:auto" data-a="go" data-h="person-${pid}">1:1 →</button>`}</h2><div class="chips" style="margin-bottom:8px"><span class="chip">${o.length} відкрито</span>${od ? `<span class="chip red">${od} прострочено</span>` : ''}${nc ? `<span class="chip red">${nc} з новими коментарями</span>` : ''}</div>${o.map(trow).join('') || '<div class="empty">Усе закрито</div>'}</div>`; }).join('') || '<div class="empty">Немає делегованих задач</div>'}</div>`;
  }
  return `<div class="hd"><div><h1>Задачі</h1><div class="sub">Комітменти між людьми: хто → кому → що → до коли</div></div><div class="act"><span class="seg">${views.map(([k, l]) => `<button class="${S.tab === k ? 'on' : ''}" data-a="tasksTab" data-v="${k}">${l}</button>`).join('')}</span><button class="btn pri" data-a="newTask">${ico('plus')}Нова задача</button></div></div>${S.tab === 'delegated' ? '' : f}${body}`;
}

/* ---------- knowledge ---------- */
function knCard(k) {
  const sup = k.supersedes && S.d.knowledge.find((x) => x.id === k.supersedes), supBy = k.supersededBy && S.d.knowledge.find((x) => x.id === k.supersededBy);
  const canEdit = k.author === uid() || (isAdmin() && k.scope === 'team');
  return `<div class="kn ${k.supersededBy ? 'sup' : ''}"><div class="km"><span class="ty ${k.type}">${KT[k.type]}</span>${k.scope === 'private' ? `<span>${ico('lock', 12)} Тільки я</span>` : `<span>${ico('users', 12)} Команда</span>`}${tag(k.project)}${canEdit ? `<span style="margin-left:auto" class="inl"><button class="btn ghost sm" data-a="editKn" data-id="${k.id}">Редагувати</button><button class="btn ghost sm" data-a="delKn" data-id="${k.id}" title="Видалити">${ico('trash', 13)}</button></span>` : ''}</div><div class="ktx">${esc(k.text)}</div>${k.why ? `<div class="hint">Чому: ${esc(k.why)}</div>` : ''}${k.quote ? `<div class="ev">“${esc(k.quote)}”</div>` : ''}<div class="km" style="margin-top:6px">${av(k.author, 18)}<span>${esc(pn(k.author))} · ${fds(k.date)}</span><span>Джерело: ${esc(k.source || '—')}</span>${sup ? `<span>замінює «${esc(sup.text)}»</span>` : ''}${supBy ? `<span class="chip red">замінено ${fds(supBy.date)}</span>` : ''}</div></div>`;
}
function pKnowledge() {
  let ks = S.d.knowledge;
  if (S.kscope !== 'all') ks = ks.filter((k) => k.scope === S.kscope); if (S.kproj) ks = ks.filter((k) => k.project === S.kproj);
  const head = `<div class="hd"><div><h1>Знання</h1><div class="sub">Домовленості, рішення і факти — з посиланням на джерело. Командні знання зберігаються як Markdown у папці команди.</div></div><div class="act"><button class="btn pri" data-a="newKn">${ico('plus')}Додати</button></div></div>
  <div class="chips" style="margin-bottom:16px;align-items:center"><span class="seg">${[['all', 'Усі'], ...Object.entries(KT)].map(([k, l]) => `<button class="${S.knt === k && !S.klog ? 'on' : ''}" data-a="knt" data-v="${k}">${l}</button>`).join('')}</span><span class="seg"><button class="${S.klog ? 'on' : ''}" data-a="klog">Decision log</button></span>${personal() ? '' : `<select class="in" data-f="kscope" aria-label="Видимість"><option value="all">Командні й мої</option><option value="team" ${S.kscope === 'team' ? 'selected' : ''}>Тільки командні</option><option value="private" ${S.kscope === 'private' ? 'selected' : ''}>Тільки мої</option></select>`}<select class="in" data-f="kproj" aria-label="Проєкт"><option value="">Усі проєкти</option>${S.d.projects.map((p) => `<option value="${p.id}" ${S.kproj === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>`;
  if (S.klog) { const d = ks.filter((k) => k.type === 'decision').sort((a, b) => (a.date < b.date ? 1 : -1)); return head + (d.length ? `<div class="tl">${d.map(knCard).join('')}</div>` : '<div class="empty">Рішень ще немає</div>'); }
  const list = ks.filter((k) => !k.supersededBy && (S.knt === 'all' || k.type === S.knt)).sort((a, b) => (a.date < b.date ? 1 : -1));
  return head + (list.map(knCard).join('') || '<div class="empty">Поки порожньо. Знання з’являються після розбору мітингів або вручну.</div>');
}

/* ---------- vision ---------- */
function pVision() {
  const ed = isAdmin();
  return `<div class="hd"><div><h1>${personal() ? 'Vision' : 'Team vision'}</h1><div class="sub">${esc(S.d.team.name)} · vision.md у папці команди</div></div><div class="act">${ed ? (S.vEdit ? `<button class="btn" data-a="vCancel">Скасувати</button><button class="btn pri" data-a="vSave">Зберегти</button>` : `<button class="btn" data-a="vEdit">Редагувати</button>`) : `<span class="hint">${ico('lock', 13)} Редагують Owner і Admin</span>`}</div></div>
  <div class="card">${S.vEdit ? `<textarea class="in" id="vText" rows="22" style="font-family:ui-monospace,Menlo,monospace;font-size:14px">${esc(S.d.vision)}</textarea><p class="hint">Markdown: # заголовок, **жирний**, - список</p>` : `<div class="doc mdv">${md(S.d.vision)}</div>`}
  ${S.vEdit ? '' : `<h2 style="margin-top:26px">Проєкти</h2>${S.d.projects.filter((p) => p.status !== 'archived').map((p) => `<p>${tag(p.id)} — ${esc(p.vision || '')}</p>`).join('') || '<p class="hint">Проєктів ще немає</p>'}`}</div>`;
}

/* ---------- project ---------- */
function hypCard(h) { const ts = tasks().filter((t) => t.hypothesis === h.id), dn = ts.filter((t) => t.status === 'done').length; return `<div class="hyp" data-a="go" data-h="hyp-${h.id}"><div class="chips" style="margin-bottom:8px;align-items:center"><b>${hcode(h.id)}</b>${hypChip(h)}${h.from || h.to ? `<span class="hint">${fds(h.from)} – ${fds(h.to)}</span>` : ''}</div>${stmt(h)}<div class="chips" style="margin-top:10px;align-items:center">${av(h.owner, 20)}<span class="hint">${esc(pn(h.owner))}</span>${h.metric ? `<span class="chip">${esc(h.metric)}: ${esc(h.current || '—')} / ${esc(h.target || '—')}</span>` : ''}<span class="chip">${dn}/${ts.length} задач</span></div></div>`; }
function pProject(id) {
  const p = prj(id); if (!p) return '<div class="empty">Проєкт не знайдено</div>';
  const ts = tasks().filter((t) => t.project === id), dn = ts.filter((t) => t.status === 'done').length;
  const hs = S.d.hypotheses.filter((h) => h.project === id), ks = S.d.knowledge.filter((k) => k.project === id && !k.supersededBy);
  const ed = isAdmin();
  let b = '';
  if (S.ptab === 'overview') b = `<div class="grid g2"><div class="card"><h2>Vision ${ed ? `<button class="lnk" data-a="editProject" data-id="${id}">Редагувати</button>` : ''}</h2><p style="margin:0;font-size:16px;white-space:pre-wrap">${esc(p.vision || '—')}</p><div class="chips" style="margin-top:14px;align-items:center"><span class="hint">Owner</span>${av(p.owner)} ${esc(pn(p.owner))}<span class="hint" style="margin-left:10px">Учасники</span><span class="avs">${(p.members || []).map((m) => av(m)).join('')}</span></div></div>
  <div class="card"><h2>Прогрес задач</h2><div style="font:800 36px Archivo,system-ui,sans-serif;font-stretch:112%">${dn}<span class="hint" style="font-size:18px"> / ${ts.length}</span></div><div class="prog"><i style="width:${ts.length ? (dn / ts.length) * 100 : 0}%"></i></div><div class="chips" style="margin-top:10px">${['open', 'progress', 'waiting'].map((s) => `<span class="chip">${STL[s]}: ${ts.filter((t) => t.status === s).length}</span>`).join('')}</div></div></div>
  <div class="card" style="margin-top:16px"><h2>Цілі ${ed ? `<button class="lnk" data-a="editProject" data-id="${id}">Редагувати</button>` : ''}</h2>${(p.goals || []).length ? `<table><thead><tr><th>Ціль</th><th>Метрика</th><th style="text-align:right">Зараз</th><th style="text-align:right">Ціль</th><th>Прогрес</th><th>До</th></tr></thead><tbody>${p.goals.map((g) => { const pc = Number(g.target) ? Math.min(100, (Number(g.current) / Number(g.target)) * 100) : 0; return `<tr style="cursor:default"><td><b style="font-weight:600">${esc(g.goal)}</b></td><td>${esc(g.metric)}</td><td style="text-align:right">${esc(g.current)}</td><td style="text-align:right">${esc(g.target)}</td><td style="width:160px"><div class="prog"><i style="width:${pc || 0}%"></i></div></td><td>${fds(g.by)}</td></tr>`; }).join('')}</tbody></table>` : '<div class="empty">Цілей ще немає</div>'}</div>`;
  else if (S.ptab === 'hyps') b = `<div class="chips" style="margin-bottom:12px"><button class="btn pri" data-a="newHyp" data-id="${id}">${ico('plus')}Нова гіпотеза</button></div><div class="grid g2">${hs.map(hypCard).join('') || '<div class="empty">Гіпотез ще немає</div>'}</div>`;
  else if (S.ptab === 'tasks') b = `<div class="card">${ts.map(trow).join('') || '<div class="empty">Немає задач, які ти бачиш</div>'}</div>`;
  else b = ks.map(knCard).join('') || '<div class="empty">Поки немає знань</div>';
  return `<div class="hd"><div><div class="hint">${personal() ? 'Мій простір' : 'Team Space'} · проєкт</div><h1 style="display:flex;gap:10px;align-items:center"><span class="dot" style="--c:${p.color};width:14px;height:14px"></span>${esc(p.name)} ${prjChip(p)}</h1></div><div class="act">${ed ? `<select class="in" data-f="pst" data-id="${id}" aria-label="Статус проєкту">${Object.entries(PST).map(([k, l]) => `<option value="${k}" ${k === p.status ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}<span class="seg">${[['overview', 'Огляд'], ['hyps', 'Гіпотези · ' + hs.length], ['tasks', 'Задачі · ' + ts.length], ['kn', 'Знання · ' + ks.length]].map(([k, l]) => `<button class="${S.ptab === k ? 'on' : ''}" data-a="ptab" data-v="${k}">${l}</button>`).join('')}</span></div></div>${b}`;
}

/* ---------- hypothesis ---------- */
function pHyp(id) {
  const h = hyp(id); if (!h) return '<div class="empty">Гіпотезу не знайдено</div>';
  const ts = tasks().filter((t) => t.hypothesis === id), ed = isAdmin() || h.owner === uid();
  return `<div class="hd"><div><button class="btn ghost sm" data-a="go" data-h="project-${h.project}">${ico('back', 14)} ${esc(prj(h.project)?.name || 'Проєкт')}</button><div class="chips" style="margin-top:10px;align-items:center"><b>${hcode(id)}</b>${hypChip(h)}</div></div><div class="act">${ed ? `<select class="in" data-f="hst" data-id="${id}" aria-label="Статус">${Object.entries(HST).map(([k, l]) => `<option value="${k}" ${k === h.status ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="btn" data-a="editHyp" data-id="${id}">Редагувати</button><button class="btn ghost" data-a="delHyp" data-id="${id}" title="Видалити">${ico('trash')}</button>` : `<span class="hint">${ico('lock', 13)} Редагує ${esc(pn(h.owner))} або Admin</span>`}</div></div>
  <div class="bigstmt" style="margin-bottom:24px"><em>Якщо</em> ${esc(h.if)}, <em>то</em> ${esc(h.then)}${h.because ? `, <em>бо</em> ${esc(h.because)}` : ''}.</div>
  <div class="chips" style="margin-bottom:22px"><span class="chip big">Відповідальний: <b>${esc(pn(h.owner))}</b></span><span class="chip big">${esc(h.metric || 'Метрика не задана')}: <b>${esc(h.current || '—')}</b> / ${esc(h.target || '—')}</span><span class="chip big">${h.from || h.to ? `${fds(h.from)} – ${fds(h.to)}` : 'Термін не задано'}</span></div>
  <div class="grid g2"><div class="card"><h2>Задачі гіпотези · ${ts.length}<button class="lnk" data-a="newTask" data-proj="${h.project}" data-hyp="${id}">+ Задача</button></h2>${ts.map(trow).join('') || '<div class="empty">Прив’яжи задачі з Review або з картки задачі</div>'}</div>
  <div class="card"><h2>Learnings</h2><div class="inl" style="margin-bottom:10px"><input class="in" id="learnTxt" style="flex:1" placeholder="Що ми дізнались?"><button class="btn sm pri" data-a="addLearn" data-id="${id}">Додати</button></div>${(h.learnings || []).map((l) => `<div style="padding:8px 0;border-bottom:1px solid var(--line)"><div class="hint">${fds(l.at)} · ${esc(pn(l.by))}</div>${esc(l.text)}</div>`).join('') || '<div class="empty">Висновки з’являться тут</div>'}<h3 style="margin:16px 0 6px">Вердикт</h3><div class="hint">${h.verdict ? esc(h.verdict) : h.status === 'testing' ? 'Ще тестуємо' + (h.to ? ' — вердикт після ' + fds(h.to) : '') : h.status === 'draft' ? 'Гіпотеза ще не запущена' : HST[h.status]}</div></div></div>`;
}

/* ---------- person ---------- */
function pPerson(id) {
  const m = M()[id]; if (!m) return '<div class="empty">Людину не знайдено</div>';
  const iOwe = tasks().filter((t) => isOpen(t) && t.owner === uid() && t.requester === id), theyOwe = tasks().filter((t) => isOpen(t) && t.owner === id && t.requester === uid());
  return `<div class="hd"><div style="display:flex;gap:14px;align-items:center">${av(id, 52)}<div><h1>${esc(m.name)}</h1><div class="sub">${ROLE[m.role]} · ${esc(m.email || '')}</div></div></div></div>
  <div class="grid g2"><div class="card"><h2>${TASK_SECTION_NAMES.delegated} для ${esc(m.name)} · ${theyOwe.length}</h2>${theyOwe.map(trow).join('') || '<div class="empty">Нічого</div>'}</div><div class="card"><h2>${TASK_SECTION_NAMES.mine} від ${esc(m.name)} · ${iOwe.length}</h2>${iOwe.map(trow).join('') || '<div class="empty">Нічого</div>'}</div></div>`;
}

/* ---------- members ---------- */
function pMembers() {
  const ad = isAdmin(), own = role() === 'owner';
  const inv = S.d.team.invites || [];
  return `<div class="hd"><div><h1>Учасники</h1><div class="sub">${esc(S.d.team.name)} · ${S.d.members.length} учасників</div></div><div class="act">${own && S.d.members.length > 1 ? `<button class="btn" data-a="transfer">Передати ownership</button>` : ''}${ad ? `<button class="btn pri" data-a="invite">${ico('plus')}Запросити</button>` : ''}</div></div>
  <div class="card" style="padding:4px 6px;overflow-x:auto"><table><thead><tr><th>Людина</th><th>Email</th><th>Роль</th><th style="text-align:right">Відкритих комітментів</th><th></th></tr></thead><tbody>${S.d.members.map((m) => `<tr data-a="go" data-h="person-${m.id}"><td>${av(m.id, 26)} <b style="font-weight:600">${esc(m.name)}</b>${m.id === uid() ? ' <span class="hint">(ти)</span>' : ''}</td><td>${esc(m.email || '')}</td><td>${ad && m.role !== 'owner' && m.id !== uid() ? `<select class="in" data-f="role" data-id="${m.id}" aria-label="Роль"><option value="admin" ${m.role === 'admin' ? 'selected' : ''}>Admin</option><option value="member" ${m.role === 'member' ? 'selected' : ''}>Member</option></select>` : ROLE[m.role]}</td><td style="text-align:right">${tasks().filter((t) => isOpen(t) && t.owner === m.id).length}</td><td style="text-align:right">${m.role !== 'owner' && (ad || m.id === uid()) ? `<button class="btn ghost sm" data-a="removeMember" data-id="${m.id}">${m.id === uid() ? 'Вийти' : 'Видалити'}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
  ${ad ? `<div class="card" style="margin-top:16px"><h2>Посилання-запрошення</h2>${inv.length ? inv.map((i) => `<div class="lnkbox">${ico('link')}<code>${esc(location.origin)}/join/${esc(i.token)}</code><span class="chip">${ROLE[i.role]}</span>${i.email ? `<span class="hint">${esc(i.email)}</span>` : '<span class="hint">багаторазове</span>'}<button class="btn sm" data-a="copyInv" data-v="${esc(i.token)}">Копіювати</button><button class="btn ghost sm" data-a="revokeInv" data-v="${esc(i.token)}">Відкликати</button></div>`).join('') : '<div class="hint">Немає активних запрошень. Створи посилання — і надішли його людям будь-яким каналом. Увійти можна будь-яким Google-акаунтом.</div>'}</div>` : ''}
  <div class="card" style="margin-top:16px"><h2>Хто що бачить</h2><table><tbody style="cursor:default">${[['', 'Owner', 'Admin', 'Member'], ['Запрошувати, міняти ролі', '✓', '✓', '—'], ['Передати ownership', '✓', '—', '—'], ['Бачити спільні задачі між іншими людьми', '✓', '✓', '—'], ['Створювати проєкти, редагувати Team vision', '✓', '✓', '—'], ['Створювати гіпотези', '✓', '✓', 'свої'], ['Змінювати статус задачі', 'лише поставлені ним', 'лише поставлені ним', 'лише поставлені ним'], ['Бачити сирі транскрипти інших', '—', '—', '—']].map((r, ri) => `<tr style="cursor:default">${r.map((c, i) => `<td${i ? ' style="color:var(--mut)"' : ''}>${ri === 0 ? `<b>${c}</b>` : c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/* ---------- profile ---------- */
function pProfile() {
  return `<div class="hd"><div><h1>Профіль</h1><div class="sub">${esc(S.me.email)}</div></div></div>
  <div class="grid g2"><div class="card"><h2>Про мене</h2><div class="grid" style="gap:12px"><label class="fl">Ім’я<input class="in" id="pfName" value="${esc(S.me.name)}"></label><label class="fl">Як мене називають у транскриптах (через кому)<input class="in" id="pfAliases" value="${esc((S.me.aliases || []).join(', '))}" placeholder="Вова, Володя, Volodymyr"></label><p class="hint" style="margin:0">AI використовує ці імена, щоб зрозуміти, хто що пообіцяв.</p><div><button class="btn pri" data-a="saveProfile">Зберегти</button></div></div></div>
  ${isAdmin() && !personal() ? `<div class="card"><h2>Команда</h2><div class="grid" style="gap:12px"><label class="fl">Назва<input class="in" id="tmName" value="${esc(S.d.team.name)}" ${role() === 'owner' ? '' : 'disabled'}></label><label class="fl">Терміново, якщо до дедлайну ≤ (днів)<input class="in" type="number" min="0" max="14" id="tmUrg" value="${urgentDays()}"></label><div><button class="btn pri" data-a="saveTeam">Зберегти</button></div></div></div>` : ''}
  <div class="card"><h2>Де лежать дані</h2><p class="hint" style="margin-top:0">Задачі, проєкти й гіпотези — JSON, знання — Markdown. У кожного користувача своя папка з окремою підпапкою на кожну команду; спільне лежить у папці команди. Точка входу всюди — <code>index.md</code>.</p><pre class="hint" style="font-size:12.5px;white-space:pre-wrap;margin:0">data/users/${esc(S.me.id)}/index.md\ndata/users/${esc(S.me.id)}/teams/${esc(S.tid)}/  (інбокс, приватні задачі й знання)\ndata/teams/${esc(S.tid)}/index.md  (проєкти, гіпотези, спільні задачі й знання)</pre></div></div>`;
}

/* ---------- roadmap ---------- */
function pRoadmap() {
  if (S.roadmap == null) {
    S.roadmap = '';
    api('GET', '/api/roadmap').then((r) => { S.roadmap = r.markdown; render(); }).catch((e) => { S.roadmap = null; toast(e.message); });
    return '<div class="empty"><span class="spin"></span></div>';
  }
  return `<div class="hd"><div><h1>Roadmap</h1><div class="sub">Що плануємо до повної реалізації TeamOS. Джерело — розділ Roadmap у README.md.</div></div></div>
  <div class="card"><div class="doc mdv">${md(S.roadmap) || '<p class="hint">Roadmap порожній</p>'}</div></div>`;
}

/* ---------- login, onboarding, join ---------- */
function loginAccess() {
  const invite = S.pendingJoin ? '<p class="orbit-invite">You’ve been invited to a team. Sign in to join.</p>' : '';
  const emailForm = S.loginSent
    ? `<div class="orbit-sent" role="status"><strong>Check your inbox</strong><p>We sent a one-time link to <b>${esc(S.loginEmail)}</b>. It expires in 15 minutes.</p></div>
       <button class="orbit-text-button" type="button" data-a="emailAgain">Use another email or send again</button>`
    : `<form id="email-login" class="orbit-form"><label for="orbit-email">Sign in to your workspace</label>
       <div class="orbit-fields"><input id="orbit-email" name="email" type="email" value="${esc(S.loginEmail)}" required maxlength="254" autocomplete="email" placeholder="Work email address" aria-label="Work email address" ${S.loginBusy ? 'disabled' : ''}>
       <button type="submit" ${S.loginBusy ? 'disabled' : ''}>${S.loginBusy ? 'Sending…' : 'Email me a link'} ${ico('arrow', 17)}</button></div>
       ${S.loginError ? `<p class="orbit-error" role="alert">${esc(S.loginError)}</p>` : ''}</form>`;
  const local = S.cfg.dev ? `<details class="orbit-local" ${S.cfg.emailLink ? '' : 'open'}><summary>Local development sign-in</summary>
    <label>Email<input id="devEmail" type="email" placeholder="name@example.com" autocomplete="email"></label>
    <label>Name (optional)<input id="devName" autocomplete="name"></label><button type="button" data-a="devLogin">Sign in locally</button></details>` : '';
  return invite + (S.cfg.emailLink ? emailForm : S.cfg.dev ? '' : '<p class="orbit-error" role="status">Email sign-in is temporarily unavailable.</p>') + local;
}
function pLogin() {
  return `<main class="orbit" lang="en"><div class="orbit-frame">
    <header class="orbit-header"><div class="orbit-brand"><span aria-hidden="true">T</span>TeamOS</div></header>
    <div class="orbit-hero"><div class="orbit-copy">
      <h1>A metaverse<br><em>for your business.</em></h1>
      <p>Invite your team and bring the materials you already work with. TeamOS connects documents, goals, and hypotheses to your projects, and captures what people agreed to after each meeting.</p>
      <div id="login-access">${loginAccess()}</div>
    </div><team-knowledge-graph></team-knowledge-graph></div>
  </div></main>`;
}
function pOnboarding() {
  return `<div class="ob"><div style="display:flex;gap:10px;align-items:center;font-weight:800;margin-bottom:28px"><span class="logo">T</span>TeamOS</div><div class="steps"><i class="on"></i><i></i></div><h1>Почнемо з команди</h1><p class="hint" style="font-size:15px">Команд може бути скільки завгодно. Особистий простір є завжди.</p>
  <div class="grid" style="gap:10px;margin:20px 0"><button class="opt ${S.obMode !== 'personal' ? 'on' : ''}" data-a="obMode" data-v="create"><span class="logo">${ico('users')}</span><span><b>Створити команду</b><div class="hint">Ти станеш Owner і зможеш запросити людей посиланням</div></span></button><button class="opt ${S.obMode === 'personal' ? 'on' : ''}" data-a="obMode" data-v="personal"><span class="logo">${ico('lock')}</span><span><b>Тільки для себе</b><div class="hint">Особистий другий мозок, без команди</div></span></button></div>
  ${S.obMode !== 'personal' ? `<label class="fl">Назва команди<input class="in" id="obName" placeholder="Напр.: Linxa Team"></label>` : ''}
  <p class="hint">Отримав посилання-запрошення? Просто відкрий його — і приєднаєшся до команди.</p>
  <div class="mdf" style="justify-content:flex-end;margin-top:28px"><button class="btn pri" data-a="obGo">Далі</button></div></div>`;
}
function pJoin() {
  const tok = R().slice(5);
  if (!S.me) return pLogin();
  if (!S.join || S.join.token !== tok) {
    S.join = { token: tok, loading: true };
    api('GET', `/api/invites/${encodeURIComponent(tok)}`).then((r) => { S.join = { token: tok, ...r }; render(); }).catch((e) => { S.join = { token: tok, error: e.message }; render(); });
  }
  const j = S.join;
  return `<div class="ob"><div style="display:flex;gap:10px;align-items:center;font-weight:800;margin-bottom:28px"><span class="logo">T</span>TeamOS</div>${j.loading ? '<div class="empty"><span class="spin"></span></div>' : j.error ? `<h1>Запрошення недійсне</h1><p class="hint">${esc(j.error)}</p><button class="btn" data-a="joinSkip">На дашборд</button>` : `<h1>Приєднатися до «${esc(j.team.name)}»</h1><div class="inv" style="margin:20px 0">${ico('users', 20)}<span><b>${esc(j.invitedBy)}</b> запросив тебе в команду <b>${esc(j.team.name)}</b> як ${ROLE[j.role]}.</span></div>${j.member ? '<p class="hint">Ти вже учасник цієї команди.</p>' : '<p class="hint">Ти бачитимеш задачі, де ти виконавець або постановник, командні знання, проєкти і гіпотези. Твій інбокс лишається особистим.</p>'}<div class="mdf" style="justify-content:flex-start"><button class="btn pri" data-a="joinGo">${j.member ? 'Відкрити команду' : 'Приєднатися'}</button><button class="btn ghost" data-a="joinSkip">Не зараз</button></div>`}</div>`;
}

/* ---------- drawer ---------- */
function drawer() {
  const el = document.getElementById('drawer');
  const t = S.drawer && tasks().find((x) => x.id === S.drawer);
  if (!t || !S.d) { el.classList.remove('on'); el.setAttribute('aria-hidden', 'true'); el.innerHTML = ''; return; }
  const ce = t.canEdit, ro = ce ? '' : 'disabled';
  const srcOwn = t.source && t.source.owner === uid() && S.d.inbox.some((i) => i.id === t.source.itemId);
  el.innerHTML = `<div class="dw"><div class="dwh"><span class="st ${t.status}"></span>${ce ? `<select class="in" data-f="t.status" aria-label="Статус">${Object.entries(STL).map(([k, l]) => `<option value="${k}" ${k === t.status ? 'selected' : ''}>${l}</option>`).join('')}</select>` : `<span class="chip">${STL[t.status]}</span>`}${t.shared ? `<span class="chip">${ico('users', 12)} спільна</span>` : `<span class="chip">${ico('lock', 12)} приватна</span>`}${ce ? `<button class="btn ghost sm" style="margin-left:auto" data-a="delTask" title="Видалити">${ico('trash')}</button>` : ''}<button class="btn ghost sm" ${ce ? '' : 'style="margin-left:auto"'} data-a="closeD" aria-label="Закрити">${ico('x')}</button></div>
  <textarea class="dwt" rows="2" data-f="t.title" ${ce ? '' : 'readonly'} aria-label="Назва">${esc(t.title)}</textarea>
  ${ce ? '' : `<div class="lock">${ico('lock')}<span>Статус і поля змінює <b>${esc(pnx(t.controller))}</b> — той, хто поставив задачу. Якщо є оновлення, напиши коментар.</span></div>`}
  <div class="kv"><span>Виконавець</span>${ce ? selWho('class="in" data-f="t.owner" aria-label="Виконавець"', t.owner) : `<span>${av(t.owner, 20)} ${esc(pnx(t.owner))}</span>`}
  <span>Постановник</span><span>${av(t.requester, 20)} ${esc(pnx(t.requester))}</span>
  <span>Дедлайн</span><span style="display:flex;gap:8px;align-items:center"><input type="date" class="in" data-f="t.due" value="${t.due || ''}" ${ro} aria-label="Дедлайн">${dueChip(t)}</span>
  <span>Пріоритет</span><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-f="t.important" ${t.important ? 'checked' : ''} ${ro}> Важливо ${urgent(t) && isOpen(t) ? '<span class="chip red">Терміново</span>' : ''}</label>
  <span>Проєкт</span>${selProj(`class="in" data-f="t.project" ${ro} aria-label="Проєкт"`, t.project)}
  <span>Гіпотеза</span>${selHyp(`class="in" data-f="t.hypothesis" ${ro} aria-label="Гіпотеза"`, t.hypothesis, t.project)}</div>
  <label class="fl">Опис<textarea class="in" rows="3" data-f="t.description" ${ce ? '' : 'readonly'}>${esc(t.description || '')}</textarea></label>
  ${t.source ? `<div class="box"><h3>Джерело</h3>${t.source.quote ? `<div class="quote">“${esc(t.source.quote)}”</div>` : ''}<div class="hint" style="margin-top:6px">${esc(t.source.itemTitle)}${t.source.ts ? ' · ' + esc(t.source.ts) : ''} · ${srcOwn ? `<button class="btn ghost sm" data-a="go" data-h="review-${t.source.itemId}">Відкрити</button>` : `${ico('lock', 12)} повний текст бачить лише той, хто його додав`}</div></div>` : ''}
  <div class="box"><h3>Коментарі · ${t.comments.length}</h3>${t.comments.map((c) => `<div class="cm">${av(c.author, 26)}<div><b>${esc(pn(c.author))}</b> <span class="when">${fdt(c.at)}</span><div style="white-space:pre-wrap">${esc(c.text)}</div></div></div>`).join('')}<textarea class="in" id="cmt" rows="2" placeholder="${ce ? 'Коментар…' : 'Напиши, що зроблено або що блокує…'}"></textarea><div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn pri sm" data-a="comment">Надіслати</button></div></div>
  <div class="box"><h3>Історія</h3><div class="hist">${t.history.slice().reverse().map((h) => `<div><b style="color:var(--ink)">${fdt(h.at)}</b> · ${esc(pn(h.by))}: ${esc(h.text)}${h.source ? ` <span>(${esc(h.source)})</span>` : ''}</div>`).join('')}</div></div></div>`;
  el.classList.add('on'); el.setAttribute('aria-hidden', 'false');
}

/* ---------- modals ---------- */
function modal() {
  const el = document.getElementById('modal'), m = S.modal;
  if (!m) { el.innerHTML = ''; return; }
  const close = `<button class="btn ghost sm x" data-a="closeM" aria-label="Закрити">${ico('x')}</button>`;
  let h = '';
  if (m.k === 'add') {
    h = `<div class="md wide"><div class="mdh"><h2>Додати в інбокс</h2>${close}</div><div class="seg" style="margin-bottom:14px">${[['paste', 'Вставити текст'], ['file', 'Файл'], ['note', 'Нотатка']].map(([k, l]) => `<button class="${m.tab === k ? 'on' : ''}" data-a="addTab" data-v="${k}">${l}</button>`).join('')}</div>
    ${m.tab === 'file' ? `<label class="card" style="display:grid;place-items:center;padding:30px;border-style:dashed;cursor:pointer;text-align:center">${ico('file', 26)}<b style="margin-top:8px">${m.fileName ? esc(m.fileName) : 'Обери файл'}</b><span class="hint">.txt .md .vtt .srt</span><input type="file" hidden data-f="addFile" accept=".txt,.md,.vtt,.srt,text/plain,text/markdown"></label>` : `<textarea class="in" id="addTxt" rows="9" placeholder="${m.tab === 'note' ? 'Запиши думку або домовленість — TeamOS розбере її так само, як транскрипт' : 'Встав транскрипт мітингу, уривок чату чи лист…'}">${esc(m.text || '')}</textarea>`}
    <div class="grid g2" style="margin-top:14px;gap:12px"><label class="fl">Назва<input class="in" id="addTitle" value="${esc(m.title || '')}" placeholder="Напр.: Weekly sync — 20 лист"></label><label class="fl">Тип джерела<select class="in" id="addType">${Object.entries(ITYPE).filter(([k]) => k !== 'routed').map(([k, l]) => `<option value="${k}" ${k === (m.tab === 'note' ? 'note' : m.type || 'transcript') ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="fl">Дата зустрічі / листа<input class="in" type="date" id="addDate" value="${m.date || TODAY()}"></label><label class="fl">Команда-контекст<select class="in" data-f="addTeam">${S.teams.map((t) => `<option value="${t.id}" ${t.id === S.tid ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label></div>
    <p class="hint" style="margin:10px 0 0">${S.ai ? `${ico('spark', 13)} AI витягне задачі, оновлення статусів і знання. Нічого не збережеться без твого підтвердження.` : `${ico('warn', 13)} AI-аналіз вимкнено — запис збережеться, а пропозиції додаси вручну.`}</p>
    <div class="mdf"><button class="btn" data-a="closeM">Скасувати</button><button class="btn pri" data-a="addGo">${ico('spark')}${S.ai ? 'Проаналізувати' : 'Зберегти'}</button></div></div>`;
  } else if (m.k === 'task') {
    h = `<div class="md"><div class="mdh"><h2>Нова задача</h2>${close}</div><div class="grid" style="gap:12px"><label class="fl">Що зробити<input class="in" id="ntT" placeholder="Напр.: Підготувати звіт для інвестора"></label><div class="grid g2" style="gap:12px"><label class="fl">Виконавець${selWho('class="in" id="ntO" data-f="ntWho"', m.owner || uid())}</label><label class="fl">Постановник<select class="in" id="ntR" data-f="ntWho"><option value="${uid()}">Я</option>${isExt(m.requester) ? `<option value="${esc(m.requester)}" selected>${esc(m.requester.slice(4))} (зовн.)</option>` : ''}<option value="__ext">+ Зовнішній контакт…</option></select></label><label class="fl">Дедлайн<input type="date" class="in" id="ntD"></label><label class="fl">Проєкт${selProj('class="in" id="ntP"', m.proj || '')}</label><label class="fl">Гіпотеза${selHyp('class="in" id="ntH"', m.hyp || '', m.proj)}</label><label style="display:flex;gap:8px;align-items:center;padding-top:20px"><input type="checkbox" id="ntI" checked> Важливо</label></div><label class="fl">Опис<textarea class="in" id="ntDesc" rows="2"></textarea></label><p class="hint" style="margin:0">Постановник змінює статус. Якщо постановник зовнішній — статус змінюєш ти.</p></div><div class="mdf"><button class="btn" data-a="closeM">Скасувати</button><button class="btn pri" data-a="ntGo">Створити</button></div></div>`;
  } else if (m.k === 'project') {
    const p = m.id ? prj(m.id) : { name: '', vision: '', goals: [], members: [uid()], owner: uid() };
    h = `<div class="md wide"><div class="mdh"><h2>${m.id ? 'Редагувати проєкт' : 'Новий проєкт'}</h2>${close}</div><div class="grid" style="gap:12px"><label class="fl">Назва<input class="in" id="pjN" value="${esc(p.name)}"></label><label class="fl">Vision<textarea class="in" id="pjV" rows="3">${esc(p.vision || '')}</textarea></label><label class="fl">Owner${selWho('class="in" id="pjO"', p.owner, false)}</label><div class="fl">Учасники<div class="cklist" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">${S.d.members.map((x) => `<label><input type="checkbox" class="pjM" value="${x.id}" ${(p.members || []).includes(x.id) ? 'checked' : ''}>${esc(x.name)}</label>`).join('')}</div></div>
    <div class="fl">Цілі (ціль · метрика · зараз · ціль · дата)<div id="pjGoals">${[...(p.goals || []), { id: '', goal: '', metric: '', current: '', target: '', by: '' }].map((g) => goalRow(g)).join('')}</div><button class="btn sm" style="justify-self:start" data-a="addGoal">${ico('plus', 13)} Ще ціль</button></div></div>
    <div class="mdf">${m.id ? `<button class="btn ghost danger" style="margin-right:auto" data-a="delProject" data-id="${m.id}">Видалити</button>` : ''}<button class="btn" data-a="closeM">Скасувати</button><button class="btn pri" data-a="pjGo">${m.id ? 'Зберегти' : 'Створити'}</button></div></div>`;
  } else if (m.k === 'hyp') {
    const x = m.id ? hyp(m.id) : { if: '', then: '', because: '', project: m.project, owner: uid(), metric: '', target: '', current: '', from: '', to: '', verdict: '' };
    h = `<div class="md"><div class="mdh"><h2>${m.id ? 'Редагувати гіпотезу' : 'Нова гіпотеза'}</h2>${close}</div><div class="grid" style="gap:12px"><label class="fl">Якщо… (дія)<input class="in" id="hyIf" value="${esc(x.if)}" placeholder="дати 100 безкоштовних викликів на місяць"></label><label class="fl">то… (результат)<input class="in" id="hyThen" value="${esc(x.then)}" placeholder="≥ 30% перейдуть на платний план"></label><label class="fl">бо… (припущення)<input class="in" id="hyBo" value="${esc(x.because || '')}"></label>
    <div class="grid g2" style="gap:12px"><label class="fl">Проєкт${selProj('class="in" id="hyP"', x.project)}</label><label class="fl">Відповідальний${isAdmin() ? selWho('class="in" id="hyO"', x.owner, false) : `<input class="in" disabled value="${esc(pn(x.owner))}">`}</label><label class="fl">Метрика успіху<input class="in" id="hyM" value="${esc(x.metric || '')}"></label><label class="fl">Ціль<input class="in" id="hyT" value="${esc(x.target || '')}"></label><label class="fl">Поточне значення<input class="in" id="hyC" value="${esc(x.current || '')}"></label><span></span><label class="fl">Початок<input class="in" type="date" id="hyF" value="${x.from || ''}"></label><label class="fl">Кінець<input class="in" type="date" id="hyTo" value="${x.to || ''}"></label></div>
    ${m.id ? `<label class="fl">Вердикт<textarea class="in" id="hyV" rows="2">${esc(x.verdict || '')}</textarea></label>` : ''}</div><div class="mdf"><button class="btn" data-a="closeM">Скасувати</button><button class="btn pri" data-a="hyGo">${m.id ? 'Зберегти' : 'Створити'}</button></div></div>`;
  } else if (m.k === 'kn') {
    const k = m.id ? S.d.knowledge.find((x) => x.id === m.id) : { type: 'decision', text: '', why: '', scope: 'team', project: '' };
    h = `<div class="md"><div class="mdh"><h2>${m.id ? 'Редагувати знання' : 'Додати знання'}</h2>${close}</div><div class="grid" style="gap:12px"><label class="fl">Тип<select class="in" id="nkT">${Object.entries(KT).map(([a, l]) => `<option value="${a}" ${a === k.type ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="fl">Текст<textarea class="in" id="nkX" rows="3">${esc(k.text)}</textarea></label><label class="fl">Чому (необов’язково)<input class="in" id="nkW" value="${esc(k.why || '')}"></label><div class="grid g2" style="gap:12px">${personal() ? '' : `<label class="fl">Видимість<select class="in" id="nkS"><option value="team">Команда</option><option value="private" ${k.scope === 'private' ? 'selected' : ''}>Тільки я</option></select></label>`}<label class="fl">Проєкт${selProj('class="in" id="nkP"', k.project)}</label></div></div><div class="mdf"><button class="btn" data-a="closeM">Скасувати</button><button class="btn pri" data-a="nkGo">Зберегти</button></div></div>`;
  } else if (m.k === 'invite') {
    h = `<div class="md"><div class="mdh"><h2>Запросити в ${esc(S.d.team.name)}</h2>${close}</div><label class="fl">Роль<select class="in" id="invR"><option value="member">Member — бачить свої задачі й командні знання</option><option value="admin">Admin — бачить усе, керує учасниками</option></select></label><label class="fl" style="margin-top:12px">Email (необов’язково — тоді посилання одноразове)<input class="in" id="invE" placeholder="name@company.com"></label><p class="hint">TeamOS не надсилає листів у v0.1 — скопіюй посилання і надішли його сам. Людина може увійти будь-яким Google-акаунтом.</p>${m.link ? `<div class="lnkbox">${ico('link')}<code>${esc(m.link)}</code><button class="btn sm" data-a="copyText" data-v="${esc(m.link)}">Копіювати</button></div>` : ''}<div class="mdf"><button class="btn" data-a="closeM">Готово</button><button class="btn pri" data-a="invGo">Створити посилання</button></div></div>`;
  } else if (m.k === 'transfer') {
    h = `<div class="md"><div class="mdh"><h2>Передати ownership</h2>${close}</div><p class="hint" style="font-size:14.5px">Новий Owner отримає повний контроль, ти станеш Admin.</p><label class="fl">Кому<select class="in" id="trTo">${S.d.members.filter((x) => x.id !== uid()).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label><label class="fl" style="margin-top:12px">Введи назву команди «${esc(S.d.team.name)}» для підтвердження<input class="in" id="trC" data-f="trC" autocomplete="off"></label><div class="mdf"><button class="btn" data-a="closeM">Скасувати</button><button class="btn pri" id="trBtn" data-a="trGo" disabled>Передати</button></div></div>`;
  } else if (m.k === 'team') {
    h = `<div class="md"><div class="mdh"><h2>Нова команда</h2>${close}</div><label class="fl">Назва<input class="in" id="ntmN" placeholder="Напр.: Linxa Team"></label><p class="hint">Ти станеш Owner. Для команди з’явиться окрема папка, а в твоїй папці — підпапка під цю команду.</p><div class="mdf"><button class="btn" data-a="closeM">Скасувати</button><button class="btn pri" data-a="ntmGo">Створити</button></div></div>`;
  } else if (m.k === 'ask') {
    h = `<div class="md wide"><div style="display:flex;gap:10px;align-items:center">${ico('search', 18)}<input class="in" id="askq" data-f="askq" style="flex:1;border:0;font-size:17px" placeholder="Знайти задачу, рішення, гіпотезу…" value="${esc(m.q || '')}" autocomplete="off"><kbd>Esc</kbd></div><div id="askr">${askRes(m.q || '')}</div></div>`;
  }
  el.innerHTML = `<div class="ov" data-a="ovClose">${h}</div>`;
  const f = el.querySelector('#askq,#addTxt,#ntT,#ntmN,#nkX,#pjN,#hyIf'); if (f && !m.focused) { m.focused = true; setTimeout(() => f.focus(), 20); }
}
const goalRow = (g) => `<div class="goal-row" data-goal="${esc(g.id || '')}"><input class="in" placeholder="Ціль" value="${esc(g.goal)}"><input class="in" placeholder="Метрика" value="${esc(g.metric)}"><input class="in" placeholder="Зараз" value="${esc(g.current)}"><input class="in" placeholder="Ціль" value="${esc(g.target)}"><input class="in" type="date" value="${g.by || ''}"><button class="btn ghost sm" data-a="rmGoal" title="Прибрати">${ico('x', 13)}</button></div>`;
function askRes(q) {
  q = q.trim().toLowerCase();
  if (!q) return '<div class="res"><div class="hint" style="padding:8px">Пошук по задачах, знаннях, гіпотезах і проєктах</div></div>';
  const ts = tasks().filter((t) => t.title.toLowerCase().includes(q) || pnx(t.owner).toLowerCase().includes(q)).slice(0, 8);
  const ks = S.d.knowledge.filter((k) => !k.supersededBy && (k.text + ' ' + (k.why || '')).toLowerCase().includes(q)).slice(0, 6);
  const hs = S.d.hypotheses.filter((h) => (h.statement || '').toLowerCase().includes(q)).slice(0, 4);
  const ps = S.d.projects.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 4);
  return `<div class="res">${ps.map((p) => `<button class="trow" data-a="go" data-h="project-${p.id}"><span class="dot" style="--c:${p.color}"></span><span class="tt"><b>${esc(p.name)}</b></span></button>`).join('')}${ts.map(trow).join('')}${hs.map((h) => `<button class="trow" data-a="go" data-h="hyp-${h.id}"><span class="chip">${hcode(h.id)}</span><span class="tt"><b>${esc(h.statement)}</b></span></button>`).join('')}${ks.map((k) => `<div class="trow" style="cursor:default"><span class="ty ${k.type}">${KT[k.type]}</span><span class="tt"><b>${esc(k.text)}</b></span></div>`).join('')}${!ts.length && !ks.length && !hs.length && !ps.length ? '<div class="hint" style="padding:8px">Нічого не знайдено</div>' : ''}</div>`;
}

/* ---------- render ---------- */
function render() {
  const r = R(); const keep = {}; document.querySelectorAll('[data-keep]').forEach((e) => (keep[e.dataset.keep] = e.scrollTop)); const sy = scrollY;
  const app = document.getElementById('app');
  const isLogin = !S.me || r === 'login';
  const existingAccess = isLogin && app.querySelector('#login-access');
  let c;
  if (existingAccess) existingAccess.innerHTML = loginAccess();
  else if (isLogin) c = pLogin();
  else if (r.startsWith('join-')) c = pJoin();
  else if (r === 'onboarding' || !S.d) c = pOnboarding();
  else {
    const pg = r === 'dashboard' ? pDashboard() : r === 'inbox' ? pInbox() : r.startsWith('review-') ? pReview() : r === 'tasks' ? pTasks() : r === 'knowledge' ? pKnowledge() : r === 'vision' ? pVision() : r.startsWith('project-') ? pProject(r.slice(8)) : r.startsWith('hyp-') ? pHyp(r.slice(4)) : r.startsWith('person-') ? pPerson(r.slice(7)) : r === 'members' ? pMembers() : r === 'profile' ? pProfile() : r === 'roadmap' ? pRoadmap() : pDashboard();
    c = `<div class="app"><aside class="side">${nav()}</aside><main class="main"><header class="top">${top()}</header><div class="page">${pg}</div></main></div>`;
  }
  document.documentElement.lang = isLogin ? 'en' : 'uk';
  document.title = isLogin ? 'TeamOS — Sign in' : 'TeamOS';
  if (!existingAccess) app.innerHTML = c;
  document.querySelectorAll('[data-keep]').forEach((e) => { if (keep[e.dataset.keep]) e.scrollTop = keep[e.dataset.keep]; }); scrollTo(0, sy);
  drawer(); modal();
}
let tt; const toast = (m) => { const e = document.getElementById('toast'); e.textContent = m; e.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => e.classList.remove('on'), 3200); };
const prop = (id) => S.review?.props.find((p) => p.id === id);
const val = (id) => document.getElementById(id)?.value ?? '';
const go = (h) => { if (location.hash.slice(1) === h) render(); else location.hash = h; };
function askExternal(sel, prev) {
  const n = prompt('Ім’я зовнішнього контакту (клієнт, партнер):');
  if (!n || !n.trim()) { sel.value = prev || uid(); return null; }
  return `ext:${n.trim()}`;
}
async function patchTask(id, body, okMsg) {
  return act(async () => { const t = await api('PATCH', T(`/tasks/${id}`), body); const i = S.d.tasks.findIndex((x) => x.id === id); if (i >= 0) S.d.tasks[i] = t; render(); return t; }, okMsg);
}
async function switchTeam(id) { S.tid = id; S.drawer = null; S.review = null; S.applied = null; S.person = ''; S.proj = ''; S.kproj = ''; await reload(); }

/* ---------- actions ---------- */
const A = {
  go: (el) => { S.tmenu = false; S.modal = null; if (el.dataset.h.startsWith('project-')) S.ptab = 'overview'; go(el.dataset.h); },
  tmenu: () => { S.tmenu = !S.tmenu; render(); },
  team: (el) => { S.tmenu = false; act(() => switchTeam(el.dataset.v)); },
  newTeam: () => { S.tmenu = false; S.modal = { k: 'team' }; render(); },
  ntmGo: () => act(async () => { const name = val('ntmN').trim(); if (!name) throw new Error('Вкажи назву'); const t = await api('POST', '/api/teams', { name }); S.modal = null; await reloadMe(); await switchTeam(t.id); go('dashboard'); }, 'Команду створено'),
  logout: () => act(async () => { await api('POST', '/auth/logout'); S.me = null; S.d = null; location.hash = 'login'; render(); }),
  emailAgain: () => { S.loginSent = false; S.loginError = ''; render(); document.querySelector('#email-login input')?.focus(); },
  devLogin: () => act(async () => { await api('POST', '/auth/dev', { email: val('devEmail'), name: val('devName') }); await boot(); }),
  obMode: (el) => { S.obMode = el.dataset.v; render(); },
  obGo: () => act(async () => {
    if (S.obMode === 'personal') { S.tid = S.teams.find((t) => t.kind === 'personal')?.id; }
    else { const name = val('obName').trim(); if (!name) throw new Error('Вкажи назву команди'); const t = await api('POST', '/api/teams', { name }); await reloadMe(); S.tid = t.id; }
    await reload(); go('dashboard');
  }),
  joinGo: () => act(async () => { const r = await api('POST', `/api/invites/${encodeURIComponent(S.join.token)}/accept`); S.pendingJoin = null; await reloadMe(); await switchTeam(r.teamId); go('dashboard'); }, 'Ласкаво просимо в команду'),
  joinSkip: async () => { S.pendingJoin = null; await reloadMe(); if (!S.tid) S.tid = S.teams[0]?.id; await reload(); go('dashboard'); },
  open: (el) => { S.drawer = el.dataset.id; S.modal = null; const t = tasks().find((x) => x.id === S.drawer); if (t?.unread) { t.unread = 0; api('POST', T(`/tasks/${t.id}/read`)).catch(() => {}); } render(); },
  closeD: () => { S.drawer = null; render(); },
  dash: (el) => { S.dash = el.dataset.v; render(); },
  tasksTab: (el) => { S.tab = el.dataset.v; go('tasks'); },
  grp: (el) => { S.grp = el.dataset.v; render(); },
  itab: (el) => { S.itab = el.dataset.v; render(); },
  ptab: (el) => { S.ptab = el.dataset.v; render(); },
  knt: (el) => { S.knt = el.dataset.v; S.klog = false; render(); },
  klog: () => { S.klog = !S.klog; render(); },
  ask: () => { S.modal = { k: 'ask', q: '' }; modal(); },
  closeM: () => { S.modal = null; modal(); },
  ovClose: (el, e) => { if (e.target === el) { S.modal = null; modal(); } },
  copyText: (el) => { navigator.clipboard?.writeText(el.dataset.v).then(() => toast('Скопійовано'), () => toast('Не вдалося скопіювати')); },
  copyInv: (el) => { navigator.clipboard?.writeText(`${location.origin}/join/${el.dataset.v}`).then(() => toast('Посилання скопійовано'), () => toast('Не вдалося скопіювати')); },

  /* inbox */
  add: () => { if (!S.d) return; S.modal = { k: 'add', tab: 'paste' }; modal(); },
  addTab: (el) => { const t = document.getElementById('addTxt'); if (t) S.modal.text = t.value; S.modal.title = val('addTitle'); S.modal.tab = el.dataset.v; modal(); },
  addGo: () => act(async () => {
    const m = S.modal; const text = m.tab === 'file' ? m.fileText : val('addTxt');
    if (!text || !text.trim()) throw new Error(m.tab === 'file' ? 'Обери файл' : 'Встав текст');
    const body = { text, title: val('addTitle').trim(), type: val('addType'), date: val('addDate'), origin: m.tab === 'file' ? `Файл · ${m.fileName}` : m.tab === 'note' ? 'Нотатка' : 'Вставлений текст' };
    const tid = m.team || S.tid;
    if (tid !== S.tid) await switchTeam(tid);
    const it = await api('POST', T('/inbox'), body);
    S.modal = null; await reload(); go(`review-${it.id}`);
  }, () => (S.ai ? 'Аналізую… зазвичай 20–60 секунд' : 'Збережено в інбокс')),
  reanalyze: () => act(async () => { await api('POST', T(`/inbox/${S.review.item.id}/reanalyze`)); S.review = null; await reload(); }, 'Аналізую ще раз…'),
  ignoreItem: () => act(async () => { const it = await api('POST', T(`/inbox/${S.review.item.id}/ignore`)); S.review = null; await reload(); go(it.status === 'ignored' ? 'inbox' : `review-${it.id}`); }),
  delItem: () => { if (!confirm('Видалити запис з інбоксу разом із сирим текстом? Уже збережені задачі й знання лишаться.')) return; act(async () => { await api('DELETE', T(`/inbox/${S.review.item.id}`)); S.review = null; await reload(); go('inbox'); }, 'Запис видалено'); },
  pset: (el) => { const p = prop(el.dataset.p); const v = el.dataset.v; p[el.dataset.k] = v === '1' ? true : v === '0' ? false : v; S.review.dirty = true; render(); },
  addProp: (el) => { const k = el.dataset.v; const base = { id: 'pr_m' + Date.now().toString(36), kind: k, on: true, manual: true, quote: '', conf: 'high' }; S.review.props.push(k === 'task' ? { ...base, title: '', owner: uid(), requester: uid(), due: null, project: null, hypothesis: null, important: true } : k === 'kn' ? { ...base, type: 'decision', text: '', why: '', scope: personal() ? 'private' : 'team', project: null } : { ...base, if: '', then: '', because: '', project: S.d.projects[0]?.id || null, owner: uid(), metric: '' }); S.review.dirty = true; render(); },
  delProp: (el) => { S.review.props = S.review.props.filter((p) => p.id !== el.dataset.p); S.review.dirty = true; render(); },
  saveDraft: () => act(async () => { await api('PATCH', T(`/inbox/${S.review.item.id}`), { proposals: S.review.props }); S.review.dirty = false; }, 'Чернетку збережено'),
  apply: () => applyReview(),

  /* tasks */
  newTask: (el) => { S.modal = { k: 'task', proj: el?.dataset?.proj || '', hyp: el?.dataset?.hyp || '' }; S.drawer = null; render(); },
  ntGo: () => act(async () => {
    const t = await api('POST', T('/tasks'), { title: val('ntT'), owner: val('ntO'), requester: val('ntR'), due: val('ntD') || null, project: val('ntP') || null, hypothesis: val('ntH') || null, important: document.getElementById('ntI').checked, description: val('ntDesc') });
    S.modal = null; S.d.tasks.unshift(t); render(); return t;
  }, (t) => (t.owner === uid() ? 'Задачу створено' : `Задачу поставлено: ${pnx(t.owner)} побачить її в розділі «${TASK_SECTION_NAMES.mine}»`)),
  delTask: () => { if (!confirm('Видалити задачу? Це не можна скасувати.')) return; act(async () => { await api('DELETE', T(`/tasks/${S.drawer}`)); S.d.tasks = S.d.tasks.filter((x) => x.id !== S.drawer); S.drawer = null; render(); }, 'Задачу видалено'); },
  comment: () => { const c = val('cmt').trim(); if (!c) return; const t = tasks().find((x) => x.id === S.drawer); act(async () => { const r = await api('POST', T(`/tasks/${t.id}/comments`), { text: c }); Object.assign(t, r); render(); }, t.canEdit ? 'Коментар додано' : `${pnx(t.controller)} побачить коментар на дашборді`); },

  /* knowledge */
  newKn: () => { S.modal = { k: 'kn' }; modal(); },
  editKn: (el) => { S.modal = { k: 'kn', id: el.dataset.id }; modal(); },
  nkGo: () => act(async () => { const body = { type: val('nkT'), text: val('nkX'), why: val('nkW'), scope: val('nkS') || 'private', project: val('nkP') || null }; if (S.modal.id) await api('PATCH', T(`/knowledge/${S.modal.id}`), body); else await api('POST', T('/knowledge'), body); S.modal = null; await reload(); }, 'Збережено'),
  delKn: (el) => { if (!confirm('Видалити запис знань?')) return; act(async () => { await api('DELETE', T(`/knowledge/${el.dataset.id}`)); await reload(); }, 'Видалено'); },

  /* vision */
  vEdit: () => { S.vEdit = true; render(); },
  vCancel: () => { S.vEdit = false; render(); },
  vSave: () => act(async () => { const markdown = val('vText'); await api('PUT', T('/vision'), { markdown }); S.d.vision = markdown; S.vEdit = false; render(); }, 'Vision збережено'),

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
  }, 'Проєкт збережено'),
  delProject: (el) => { if (!confirm('Видалити проєкт? Задачі лишаться без проєкту.')) return; act(async () => { await api('DELETE', T(`/projects/${el.dataset.id}`)); S.modal = null; await reload(); go('dashboard'); }, 'Проєкт видалено'); },
  newHyp: (el) => { S.modal = { k: 'hyp', project: el.dataset.id }; modal(); },
  editHyp: (el) => { S.modal = { k: 'hyp', id: el.dataset.id }; modal(); },
  hyGo: () => act(async () => {
    const body = { if: val('hyIf'), then: val('hyThen'), because: val('hyBo'), project: val('hyP'), metric: val('hyM'), target: val('hyT'), current: val('hyC'), from: val('hyF') || null, to: val('hyTo') || null };
    if (document.getElementById('hyO')) body.owner = val('hyO');
    if (document.getElementById('hyV')) body.verdict = val('hyV');
    const h = S.modal.id ? await api('PATCH', T(`/hypotheses/${S.modal.id}`), body) : await api('POST', T('/hypotheses'), body);
    S.modal = null; await reload(); go(`hyp-${h.id}`);
  }, 'Гіпотезу збережено'),
  delHyp: (el) => { if (!confirm('Видалити гіпотезу?')) return; const h = hyp(el.dataset.id); act(async () => { await api('DELETE', T(`/hypotheses/${el.dataset.id}`)); await reload(); go(`project-${h.project}`); }, 'Гіпотезу видалено'); },
  addLearn: (el) => act(async () => { const text = val('learnTxt').trim(); if (!text) throw new Error('Напиши висновок'); await api('POST', T(`/hypotheses/${el.dataset.id}/learnings`), { text }); await reload(); }, 'Learning додано'),

  /* members */
  invite: () => { S.modal = { k: 'invite' }; modal(); },
  invGo: () => act(async () => { const inv = await api('POST', T('/invites'), { role: val('invR'), email: val('invE') }); S.d = await api('GET', T('/state')); S.modal.link = `${location.origin}/join/${inv.token}`; render(); }, 'Посилання створено'),
  revokeInv: (el) => act(async () => { await api('DELETE', T(`/invites/${encodeURIComponent(el.dataset.v)}`)); await reload(); }, 'Запрошення відкликано'),
  removeMember: (el) => { const self = el.dataset.id === uid(); if (!confirm(self ? 'Вийти з команди?' : `Видалити ${pn(el.dataset.id)} з команди?`)) return; act(async () => { await api('DELETE', T(`/members/${el.dataset.id}`)); if (self) { await reloadMe(); await switchTeam(S.teams[0].id); go('dashboard'); } else await reload(); }, self ? 'Ти вийшов з команди' : 'Учасника видалено'); },
  transfer: () => { S.modal = { k: 'transfer' }; modal(); },
  trGo: () => act(async () => { await api('POST', T('/transfer'), { userId: val('trTo'), confirm: val('trC').trim() }); S.modal = null; await reloadMe(); await reload(); }, 'Ownership передано. Ти — Admin.'),

  /* profile */
  saveProfile: () => act(async () => { S.me = await api('PATCH', '/api/me', { name: val('pfName'), aliases: val('pfAliases').split(',').map((s) => s.trim()).filter(Boolean) }); await reload(); }, 'Профіль збережено'),
  saveTeam: () => act(async () => { const body = { urgentDays: Number(val('tmUrg')) }; if (role() === 'owner') body.name = val('tmName'); await api('PATCH', T(''), body); await reloadMe(); await reload(); }, 'Налаштування збережено'),
};

async function applyReview() {
  const r = S.review; if (!r || r.item.status === 'done') return;
  const sel = r.props.filter((p) => p.on);
  if (!sel.length) return toast('Нічого не обрано');
  const bad = sel.find((p) => (p.kind === 'task' && !p.title?.trim()) || (p.kind === 'kn' && !p.text?.trim()) || (p.kind === 'hyp' && (!p.if?.trim() || !p.then?.trim())));
  if (bad) return toast('Заповни порожні картки або зніми з них галочку');
  await act(async () => {
    const res = await api('POST', T(`/inbox/${r.item.id}/apply`), { proposals: r.props });
    S.applied = { id: r.item.id, ...res }; scrollTo(0, 0); await reload();
  });
}

const F = {
  dir: (el) => { S.dir = el.value; render(); }, fperson: (el) => { S.person = el.value; render(); }, fproj: (el) => { S.proj = el.value; render(); }, fst: (el) => { S.fst = el.value; render(); },
  kscope: (el) => { S.kscope = el.value; render(); }, kproj: (el) => { S.kproj = el.value; render(); },
  addTeam: (el) => { S.modal.team = el.value; },
  addFile: (el) => {
    const f = el.files[0]; if (!f) return;
    if (f.size > 2e6) { toast('Файл завеликий (макс. 2 МБ)'); return; }
    const rd = new FileReader();
    rd.onload = () => { S.modal.fileText = String(rd.result); S.modal.fileName = f.name; S.modal.title = val('addTitle') || f.name.replace(/\.[^.]+$/, ''); modal(); document.getElementById('addTitle').value = S.modal.title; };
    rd.readAsText(f);
  },
  ntWho: (el) => { if (el.value === '__ext') { const v = askExternal(el, uid()); if (v) { el.insertAdjacentHTML('afterbegin', `<option value="${esc(v)}">${esc(v.slice(4))} (зовн.)</option>`); el.value = v; } } },
  'p.on': (el) => { prop(el.dataset.p).on = el.checked; S.review.dirty = true; render(); },
  'p.important': (el) => { prop(el.dataset.p).important = el.checked; S.review.dirty = true; },
  pst: (el) => act(async () => { await api('PATCH', T(`/projects/${el.dataset.id}`), { status: el.value }); await reload(); }, 'Статус проєкту змінено'),
  hst: (el) => act(async () => { await api('PATCH', T(`/hypotheses/${el.dataset.id}`), { status: el.value }); await reload(); }, `Статус гіпотези: ${HST[el.value]}`),
  role: (el) => act(async () => { await api('PATCH', T(`/members/${el.dataset.id}`), { role: el.value }); await reload(); }, 'Роль змінено'),
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
  if (['owner', 'requester', 'project', 'to', 'type'].includes(k)) render();
}
// Task drawer fields: data-f="t.<field>"
function onTaskField(el) {
  const t = tasks().find((x) => x.id === S.drawer); if (!t) return;
  const k = el.dataset.f.slice(2);
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (k === 'owner' && v === '__ext') { v = askExternal(el, t.owner); if (!v) return; }
  if (['project', 'hypothesis', 'due'].includes(k)) v = v || null;
  if (v === t[k]) return;
  patchTask(t.id, { [k]: v }, k === 'status' ? `Статус: ${STL[v]}` : k === 'owner' ? `${pnx(v)} отримає задачу` : null);
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
  } catch (error) { S.loginError = error instanceof TypeError ? 'Could not reach TeamOS. Please try again.' : error.message; }
  finally { S.loginBusy = false; render(); }
});
document.addEventListener('dragstart', (e) => { const c = e.target.closest && e.target.closest('[data-drag]'); if (c) { e.dataTransfer.setData('text/plain', c.dataset.drag); c.classList.add('dragging'); } });
document.addEventListener('dragend', () => document.querySelectorAll('.dragging,.over').forEach((x) => x.classList.remove('dragging', 'over')));
document.addEventListener('dragover', (e) => { const z = e.target.closest && e.target.closest('[data-drop]'); if (z) { e.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', (e) => { const z = e.target.closest && e.target.closest('[data-drop]'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('over'); });
document.addEventListener('drop', (e) => {
  const z = e.target.closest && e.target.closest('[data-drop]'); if (!z) return; e.preventDefault(); z.classList.remove('over');
  const t = tasks().find((x) => x.id === e.dataTransfer.getData('text/plain')); if (!t) return;
  if (!t.canEdit) return toast(`Змінювати може лише постановник — ${pnx(t.controller)}`);
  const [k, v] = z.dataset.drop.split(':');
  if (k === 'q') patchTask(t.id, { urgent: v[0] === '1', important: v[1] === '1' });
  else if (t.status !== v) patchTask(t.id, { status: v }, `Статус: ${STL[v]}`);
});
document.addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
  if (!S.d) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); A.ask(); }
  else if (e.key === 'Escape') { if (S.modal) { S.modal = null; modal(); } else if (S.drawer) { S.drawer = null; render(); } }
  else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && R().startsWith('review-') && !S.modal) { e.preventDefault(); applyReview(); }
  else if (!typing && !S.modal && !e.metaKey && !e.ctrlKey && ['i', 'I', 'ш', 'Ш'].includes(e.key)) { e.preventDefault(); A.add(); }
});
window.addEventListener('hashchange', () => {
  S.tmenu = false;
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
boot().catch((e) => { document.getElementById('app').innerHTML = `<div class="empty">Could not load TeamOS. ${esc(e.message)}</div>`; });
})();
