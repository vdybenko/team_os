// File-based storage for TeamOS.
//
// Layout (DATA_DIR, default ./data):
//
//   index.md                              ← entry point: links to every user and every team
//   users/<userId>/
//     index.md                            ← user's entry point: profile + one folder per team
//     profile.json
//     teams/<teamId>/
//       index.md                          ← everything this user holds privately in this team
//       inbox/<itemId>.json               ← inbox item: meta, summary, AI proposals
//       inbox/<itemId>.md                 ← raw source (transcript / email / note) — only the uploader sees it
//       tasks/<taskId>.json               ← private commitments (only one team member involved)
//       knowledge/<id>.md                 ← private knowledge (scope: private)
//   teams/<teamId>/
//     index.md                            ← team's entry point: projects, hypotheses, shared tasks, shared knowledge
//     team.json                           ← name, members + roles, invites
//     vision.md                           ← Team vision
//     projects/<projectId>.json
//     hypotheses/<hypothesisId>.json
//     tasks/<taskId>.json                 ← shared commitments (two or more members involved)
//     knowledge/<id>.md                   ← shared knowledge base (scope: team)
//
// Every write regenerates the index.md files it affects, so a person (or an LLM agent)
// can start from one index.md and reach every file by following links.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');

/* ---------------- low-level helpers ---------------- */

const SAFE_ID = /^[a-zA-Z0-9_-]{1,80}$/;
export function assertId(id, what = 'id') {
  if (typeof id !== 'string' || !SAFE_ID.test(id)) {
    const e = new Error(`Invalid ${what}`); e.status = 400; throw e;
  }
  return id;
}
export const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
export const now = () => new Date().toISOString();

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function writeAtomic(file, content) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
function writeJson(file, obj) { writeAtomic(file, JSON.stringify(obj, null, 2) + '\n'); }
function readText(file) { try { return fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
function rm(file) { try { fs.unlinkSync(file); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
function listFiles(dir, ext) {
  try { return fs.readdirSync(dir).filter((f) => f.endsWith(ext)).sort(); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}
function listDirs(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort(); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}
const rel = (from, to) => path.relative(path.dirname(from), to).split(path.sep).join('/');
const mdEsc = (s) => String(s ?? '').replace(/\r?\n/g, ' ').replace(/([\[\]])/g, '\\$1');

/* ---------------- paths ---------------- */

const P = {
  rootIndex: () => path.join(DATA_DIR, 'index.md'),
  secret: () => path.join(DATA_DIR, '.secret'),
  user: (uid) => path.join(DATA_DIR, 'users', assertId(uid, 'user id')),
  userTeam: (uid, tid) => path.join(P.user(uid), 'teams', assertId(tid, 'team id')),
  team: (tid) => path.join(DATA_DIR, 'teams', assertId(tid, 'team id')),
};

/* ---------------- markdown with JSON-valued front matter ---------------- */
// Front matter values are JSON literals, which are also valid YAML.

function toMd(meta, body) {
  const fm = Object.entries(meta).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
  return `---\n${fm}\n---\n\n${body.trim()}\n`;
}
function fromMd(text) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text || '');
  if (!m) return { meta: {}, body: text || '' };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':'); if (i < 0) continue;
    const k = line.slice(0, i).trim(), raw = line.slice(i + 1).trim();
    try { meta[k] = JSON.parse(raw); } catch { meta[k] = raw; }
  }
  return { meta, body: m[2].trim() };
}

/* ---------------- secret ---------------- */

export function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  let s = readText(P.secret());
  if (!s) { s = crypto.randomBytes(32).toString('hex'); writeAtomic(P.secret(), s); }
  return s.trim();
}

/* ---------------- users ---------------- */

export function getUser(uid) { return readJson(path.join(P.user(uid), 'profile.json')); }
export function listUsers() { return listDirs(path.join(DATA_DIR, 'users')).map(getUser).filter(Boolean); }
export function findUserByEmail(email) {
  const e = String(email).toLowerCase();
  return listUsers().find((u) => (u.emails || [u.email]).map((x) => x.toLowerCase()).includes(e)) || null;
}
export function saveUser(u) {
  u.updatedAt = now();
  writeJson(path.join(P.user(u.id), 'profile.json'), u);
  rebuildUserIndex(u.id);
  rebuildRootIndex();
  return u;
}

/* ---------------- teams ---------------- */

export function getTeam(tid) { return readJson(path.join(P.team(tid), 'team.json')); }
export function listTeams() { return listDirs(path.join(DATA_DIR, 'teams')).map(getTeam).filter(Boolean); }
export function teamsOfUser(uid) { return listTeams().filter((t) => t.members.some((m) => m.userId === uid)); }
export function saveTeam(t) {
  t.updatedAt = now();
  writeJson(path.join(P.team(t.id), 'team.json'), t);
  if (!fs.existsSync(path.join(P.team(t.id), 'vision.md'))) {
    writeAtomic(path.join(P.team(t.id), 'vision.md'), `# ${t.name} — vision\n\n## Місія\n\n_Опишіть, навіщо існує команда._\n\n## Як ми працюємо\n\n_Ритуали, домовленості, принципи._\n`);
  }
  for (const m of t.members) rebuildUserTeamIndex(m.userId, t.id);
  for (const m of t.members) rebuildUserIndex(m.userId);
  rebuildTeamIndex(t.id);
  rebuildRootIndex();
  return t;
}
export function getVision(tid) { return readText(path.join(P.team(tid), 'vision.md')) || ''; }
export function saveVision(tid, md) { writeAtomic(path.join(P.team(tid), 'vision.md'), md.endsWith('\n') ? md : md + '\n'); rebuildTeamIndex(tid); }

/* ---------------- projects & hypotheses (team folder) ---------------- */

function collection(dirFn) {
  return {
    list: (tid) => listFiles(dirFn(tid), '.json').map((f) => readJson(path.join(dirFn(tid), f))).filter(Boolean),
    get: (tid, id) => readJson(path.join(dirFn(tid), `${assertId(id)}.json`)),
    save: (tid, obj) => { obj.updatedAt = now(); writeJson(path.join(dirFn(tid), `${assertId(obj.id)}.json`), obj); rebuildTeamIndex(tid); return obj; },
    remove: (tid, id) => { rm(path.join(dirFn(tid), `${assertId(id)}.json`)); rebuildTeamIndex(tid); },
  };
}
export const projects = collection((tid) => path.join(P.team(tid), 'projects'));
export const hypotheses = collection((tid) => path.join(P.team(tid), 'hypotheses'));

/* ---------------- tasks ---------------- */
// A task lives in the team folder when two or more team members take part in it
// (owner ≠ requester). Otherwise it is private and lives in that one member's folder.

export const isExternal = (who) => typeof who === 'string' && who.startsWith('ext:');
export function taskHolder(task) {
  const people = [...new Set([task.owner, task.requester].filter((x) => x && !isExternal(x)))];
  if (people.length >= 2) return { shared: true };
  return { shared: false, userId: people[0] || task.creator };
}
const sharedTaskDir = (tid) => path.join(P.team(tid), 'tasks');
const privateTaskDir = (uid, tid) => path.join(P.userTeam(uid, tid), 'tasks');

export function listSharedTasks(tid) {
  const d = sharedTaskDir(tid);
  return listFiles(d, '.json').map((f) => readJson(path.join(d, f))).filter(Boolean);
}
export function listPrivateTasks(uid, tid) {
  const d = privateTaskDir(uid, tid);
  return listFiles(d, '.json').map((f) => readJson(path.join(d, f))).filter(Boolean);
}
function taskFile(tid, task) {
  const h = taskHolder(task);
  return path.join(h.shared ? sharedTaskDir(tid) : privateTaskDir(h.userId, tid), `${assertId(task.id)}.json`);
}
export function findTask(tid, id, uid) {
  assertId(id);
  const shared = readJson(path.join(sharedTaskDir(tid), `${id}.json`));
  if (shared) return shared;
  return uid ? readJson(path.join(privateTaskDir(uid, tid), `${id}.json`)) : null;
}
export function saveTask(tid, task, previous) {
  task.updatedAt = now();
  const file = taskFile(tid, task);
  if (previous) {
    const old = taskFile(tid, previous);
    if (old !== file) { rm(old); touchIndexesFor(tid, previous); }
  }
  writeJson(file, task);
  touchIndexesFor(tid, task);
  return task;
}
export function removeTask(tid, task) { rm(taskFile(tid, task)); touchIndexesFor(tid, task); }
function touchIndexesFor(tid, task) {
  const h = taskHolder(task);
  if (h.shared) rebuildTeamIndex(tid); else rebuildUserTeamIndex(h.userId, tid);
}

/* ---------------- knowledge (Markdown) ---------------- */

const sharedKnDir = (tid) => path.join(P.team(tid), 'knowledge');
const privateKnDir = (uid, tid) => path.join(P.userTeam(uid, tid), 'knowledge');

function knToMd(k) {
  const { text, why, quote, ...meta } = k;
  let body = `# ${text}\n`;
  if (why) body += `\n**Чому:** ${why}\n`;
  if (quote) body += `\n> ${String(quote).replace(/\n/g, '\n> ')}\n`;
  return toMd({ ...meta, why: why || undefined, quote: quote || undefined }, body);
}
function knFromMd(text) {
  const { meta, body } = fromMd(text);
  const title = /^#\s+(.+)$/m.exec(body);
  return { ...meta, text: title ? title[1].trim() : body.split('\n')[0] };
}
function listKnIn(dir) { return listFiles(dir, '.md').map((f) => knFromMd(readText(path.join(dir, f)))).filter((k) => k.id); }
export function listSharedKnowledge(tid) { return listKnIn(sharedKnDir(tid)); }
export function listPrivateKnowledge(uid, tid) { return listKnIn(privateKnDir(uid, tid)); }
function knFile(tid, k) { return path.join(k.scope === 'private' ? privateKnDir(k.author, tid) : sharedKnDir(tid), `${assertId(k.id)}.md`); }
export function findKnowledge(tid, id, uid) {
  assertId(id);
  const t = readText(path.join(sharedKnDir(tid), `${id}.md`)) ?? (uid ? readText(path.join(privateKnDir(uid, tid), `${id}.md`)) : null);
  return t ? knFromMd(t) : null;
}
export function saveKnowledge(tid, k, previous) {
  k.updatedAt = now();
  const file = knFile(tid, k);
  if (previous && knFile(tid, previous) !== file) { rm(knFile(tid, previous)); }
  writeAtomic(file, knToMd(k));
  rebuildTeamIndex(tid); rebuildUserTeamIndex(k.author, tid);
  return k;
}
export function removeKnowledge(tid, k) { rm(knFile(tid, k)); rebuildTeamIndex(tid); rebuildUserTeamIndex(k.author, tid); }

/* ---------------- inbox (user folder, per team) ---------------- */

const inboxDir = (uid, tid) => path.join(P.userTeam(uid, tid), 'inbox');
export function listInbox(uid, tid) {
  const d = inboxDir(uid, tid);
  return listFiles(d, '.json').map((f) => readJson(path.join(d, f))).filter(Boolean).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
export function getInboxItem(uid, tid, id) { return readJson(path.join(inboxDir(uid, tid), `${assertId(id)}.json`)); }
export function getInboxSource(uid, tid, id) {
  const t = readText(path.join(inboxDir(uid, tid), `${assertId(id)}.md`));
  return t == null ? '' : fromMd(t).body;
}
export function saveInboxItem(uid, tid, item, sourceText) {
  item.updatedAt = now();
  const d = inboxDir(uid, tid);
  if (sourceText !== undefined) {
    writeAtomic(path.join(d, `${assertId(item.id)}.md`), toMd({ id: item.id, title: item.title, type: item.type, date: item.date, createdAt: item.createdAt }, sourceText));
  }
  writeJson(path.join(d, `${assertId(item.id)}.json`), item);
  rebuildUserTeamIndex(uid, tid);
  return item;
}
export function removeInboxItem(uid, tid, id) {
  rm(path.join(inboxDir(uid, tid), `${assertId(id)}.json`));
  rm(path.join(inboxDir(uid, tid), `${assertId(id)}.md`));
  rebuildUserTeamIndex(uid, tid);
}

/* ---------------- index.md generation ---------------- */

const STATUS = { open: 'Відкрито', progress: 'В роботі', waiting: 'Очікує', done: 'Готово', cancelled: 'Скасовано' };
const HSTATUS = { draft: 'Чернетка', testing: 'Тестуємо', validated: 'Підтверджено', invalidated: 'Спростовано' };
const PSTATUS = { active: 'Активний', paused: 'На паузі', done: 'Завершено', archived: 'В архіві' };

function nameOf(who, users) {
  if (!who) return '—';
  if (isExternal(who)) return `${who.slice(4)} (зовн.)`;
  return users[who]?.name || who;
}
function userMap() { return Object.fromEntries(listUsers().map((u) => [u.id, u])); }

function taskLine(file, dir, t, users) {
  return `- [${mdEsc(t.title)}](${rel(file, path.join(dir, t.id + '.json'))}) — ${STATUS[t.status] || t.status} · ${mdEsc(nameOf(t.owner, users))} → ${mdEsc(nameOf(t.requester, users))}${t.due ? ` · до ${t.due}` : ''}`;
}
function knLine(file, dir, k) {
  return `- [${mdEsc(k.text)}](${rel(file, path.join(dir, k.id + '.md'))}) — ${k.type}${k.supersededBy ? ' · замінено' : ''} · ${k.date || ''}`;
}

export function rebuildTeamIndex(tid) {
  const team = getTeam(tid); if (!team) return;
  const dir = P.team(tid), file = path.join(dir, 'index.md'), users = userMap();
  const prj = projects.list(tid), hyp = hypotheses.list(tid), tasks = listSharedTasks(tid), kn = listSharedKnowledge(tid);
  const L = [];
  L.push(`# ${team.name}`, '', `> Точка входу в спільний простір команди. Згенеровано автоматично ${now()} — не редагуйте вручну.`, '');
  L.push(`- [team.json](team.json) — налаштування, учасники, ролі`, `- [vision.md](vision.md) — Team vision`, '');
  L.push('## Учасники', '');
  for (const m of team.members) L.push(`- ${mdEsc(users[m.userId]?.name || m.userId)} (${m.role}) — особиста папка: [${m.userId}](${rel(file, path.join(P.userTeam(m.userId, tid), 'index.md'))})`);
  L.push('', `## Проєкти (${prj.length})`, '');
  for (const p of prj) {
    L.push(`- [${mdEsc(p.name)}](${rel(file, path.join(dir, 'projects', p.id + '.json'))}) — ${PSTATUS[p.status] || p.status}`);
    for (const h of hyp.filter((h) => h.project === p.id)) L.push(`  - гіпотеза [${mdEsc(h.statement || h.if)}](${rel(file, path.join(dir, 'hypotheses', h.id + '.json'))}) — ${HSTATUS[h.status] || h.status}`);
  }
  const orphan = hyp.filter((h) => !prj.some((p) => p.id === h.project));
  if (orphan.length) { L.push('', '### Гіпотези без проєкту', ''); for (const h of orphan) L.push(`- [${mdEsc(h.statement || h.if)}](hypotheses/${h.id}.json) — ${HSTATUS[h.status]}`); }
  L.push('', `## Спільні задачі (${tasks.length})`, '');
  for (const s of Object.keys(STATUS)) {
    const ts = tasks.filter((t) => t.status === s); if (!ts.length) continue;
    L.push(`### ${STATUS[s]}`, ''); for (const t of ts) L.push(taskLine(file, path.join(dir, 'tasks'), t, users)); L.push('');
  }
  L.push(`## Спільна база знань (${kn.length})`, '');
  for (const k of kn.sort((a, b) => (a.date < b.date ? 1 : -1))) L.push(knLine(file, path.join(dir, 'knowledge'), k));
  writeAtomic(file, L.join('\n') + '\n');
}

export function rebuildUserTeamIndex(uid, tid) {
  const team = getTeam(tid); if (!team || !getUser(uid)) return;
  const dir = P.userTeam(uid, tid), file = path.join(dir, 'index.md'), users = userMap();
  const inbox = listInbox(uid, tid), tasks = listPrivateTasks(uid, tid), kn = listPrivateKnowledge(uid, tid);
  const L = [];
  L.push(`# ${users[uid]?.name || uid} · ${team.name}`, '', `> Особиста папка в команді. Бачить лише власник. Згенеровано автоматично ${now()}.`, '');
  L.push(`- Спільний простір команди: [${mdEsc(team.name)}](${rel(file, path.join(P.team(tid), 'index.md'))})`, '');
  L.push(`## Інбокс (${inbox.length})`, '');
  for (const i of inbox) L.push(`- [${mdEsc(i.title)}](inbox/${i.id}.json) — ${i.status} · ${i.date || ''}${fs.existsSync(path.join(dir, 'inbox', i.id + '.md')) ? ` · [джерело](inbox/${i.id}.md)` : ''}`);
  L.push('', `## Приватні задачі (${tasks.length})`, '');
  for (const t of tasks) L.push(taskLine(file, path.join(dir, 'tasks'), t, users));
  L.push('', `## Приватні знання (${kn.length})`, '');
  for (const k of kn) L.push(knLine(file, path.join(dir, 'knowledge'), k));
  writeAtomic(file, L.join('\n') + '\n');
}

export function rebuildUserIndex(uid) {
  const u = getUser(uid); if (!u) return;
  const file = path.join(P.user(uid), 'index.md');
  const L = [`# ${u.name}`, '', `> Точка входу в усі файли користувача. Згенеровано автоматично ${now()}.`, '', `- [profile.json](profile.json) — ${mdEsc(u.email)}`, '', '## Команди', ''];
  for (const t of teamsOfUser(uid)) {
    const role = t.members.find((m) => m.userId === uid)?.role;
    L.push(`- **${mdEsc(t.name)}** (${t.kind === 'personal' ? 'особистий простір' : role}) — мої файли: [teams/${t.id}](teams/${t.id}/index.md) · спільне: [${t.id}](${rel(file, path.join(P.team(t.id), 'index.md'))})`);
  }
  writeAtomic(file, L.join('\n') + '\n');
}

export function rebuildRootIndex() {
  const file = P.rootIndex();
  const L = ['# TeamOS data', '', `> Корінь сховища. Згенеровано автоматично ${now()}.`, '', '## Команди', ''];
  for (const t of listTeams()) L.push(`- [${mdEsc(t.name)}](teams/${t.id}/index.md)${t.kind === 'personal' ? ' — особистий простір' : ''}`);
  L.push('', '## Користувачі', '');
  for (const u of listUsers()) L.push(`- [${mdEsc(u.name)}](users/${u.id}/index.md)`);
  writeAtomic(file, L.join('\n') + '\n');
}
