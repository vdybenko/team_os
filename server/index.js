import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as store from './store.js';
import { mountAuthRoutes, sessionMiddleware, requireUser, magicLinkConfigured } from './auth.js';
import { normalizeEmail } from './magic-link.js';
import { analyze, aiConfigured, errorMessage, AI_PROVIDER, MODEL } from './ai.js';
import { knowledgeEvidence } from './evidence.js';
import { askAssistant } from './assistant.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_LOCAL_PROXY === '1') app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '5mb' }));
app.use(sessionMiddleware);
mountAuthRoutes(app);

/* ================= helpers ================= */

const { isExternal } = store;
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };
const route = (fn) => async (req, res) => {
  try { const out = await fn(req, res); if (!res.headersSent) res.json(out ?? { ok: true }); }
  catch (e) {
    const s = e.status || (e.$metadata ? 503 : 500);
    if (s >= 500) console.error(e);
    res.status(s).json({ error: e.$metadata ? 'Сховище S3 тимчасово недоступне.' : e.message || 'Server error' });
  }
};
const str = (v, max = 2000) => (v == null ? '' : String(v).trim().slice(0, max));
const dateOrNull = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const today = () => new Date().toISOString().slice(0, 10);
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

const TASK_ST = ['open', 'progress', 'waiting', 'done', 'cancelled'];
const HYP_ST = ['draft', 'testing', 'validated', 'invalidated'];
const PRJ_ST = ['active', 'paused', 'done', 'archived'];
const KN_TYPES = ['decision', 'agreement', 'fact', 'process', 'context'];
const ROLES = ['owner', 'admin', 'member'];
const STL = { open: 'Відкрито', progress: 'В роботі', waiting: 'Очікує', done: 'Готово', cancelled: 'Скасовано' };
const COLORS = ['#1f4fd8', '#0b8a5f', '#b4441c', '#7a3fb0', '#a8326e', '#2f7f8f', '#8a6d00'];

function ctx(req) {
  const team = store.getTeam(req.params.tid) || fail(404, 'Команду не знайдено');
  const m = team.members.find((x) => x.userId === req.user.id) || fail(403, 'Ти не учасник цієї команди');
  return { team, tid: team.id, me: req.user, uid: req.user.id, role: m.role, admin: ['owner', 'admin'].includes(m.role) };
}
const isMember = (team, uid) => team.members.some((m) => m.userId === uid);
const nameOf = (who) => (isExternal(who) ? who.slice(4) : store.getUser(who)?.name || '—');

// People reference: a member id, or "ext:Name" for an external contact.
function person(team, v, field) {
  if (typeof v !== 'string' || !v) return null;
  if (isExternal(v)) { const n = str(v.slice(4), 120); return n ? `ext:${n}` : null; }
  if (!isMember(team, v)) fail(400, `${field}: людина не з команди`);
  return v;
}

/* ---------- task permissions (spec §5.2) ---------- */
// Status and fields are changed only by whoever set the task (the requester).
// When the requester is external, the member who created the task controls it.
const controller = (t) => (t.requester && !isExternal(t.requester) ? t.requester : t.creator);
const canEditTask = (c, t) => controller(t) === c.uid;
const canSeeTask = (c, t) => [t.owner, t.requester, t.creator].includes(c.uid) || (c.admin && store.taskHolder(t).shared);
async function visibleTasks(c) {
  return (await store.listTasksFor(c.tid, c.uid)).filter((t) => canSeeTask(c, t));
}
async function getTaskFor(c, id) {
  const t = await store.findTask(c.tid, id, c.uid);
  if (!t || !canSeeTask(c, t)) fail(404, 'Задачу не знайдено');
  return t;
}
const hist = (t, by, text, source) => t.history.push({ at: store.now(), by, text, ...(source ? { source } : {}) });

function taskView(c, t) {
  return {
    ...t,
    canEdit: canEditTask(c, t),
    controller: controller(t),
    shared: store.taskHolder(t).shared,
    unread: t.comments.filter((x) => x.author !== c.uid && !(x.readBy || []).includes(c.uid)).length,
  };
}

async function createTask(c, input, extra = {}) {
  const owner = person(c.team, input.owner ?? c.uid, 'Виконавець') || c.uid;
  const requester = person(c.team, input.requester ?? c.uid, 'Постановник') || c.uid;
  if (isExternal(owner) && isExternal(requester)) fail(400, 'Хоча б одна сторона має бути з команди');
  const title = str(input.title, 300) || fail(400, 'Напиши, що треба зробити');
  const t = {
    id: extra.id || store.newId('t'), title, description: str(input.description, 10000),
    owner, requester, creator: c.uid,
    due: dateOrNull(input.due), important: Boolean(input.important), urgent: null,
    status: TASK_ST.includes(input.status) ? input.status : 'open',
    project: validProject(c, input.project), hypothesis: validHyp(c, input.hypothesis),
    source: extra.source || null, comments: [], history: [], createdAt: store.now(),
  };
  if (extra.id) {
    const existing = await store.findTask(c.tid, t.id, store.taskHolder(t).userId || c.uid);
    if (existing) return existing;
  }
  hist(t, c.uid, extra.historyText || 'Створено вручну', extra.source?.itemTitle);
  return store.saveTask(c.tid, t);
}
const validProject = (c, id) => (id && typeof id === 'string' && store.projects.get(c.tid, id) ? id : null);
const validHyp = (c, id) => (id && typeof id === 'string' && store.hypotheses.get(c.tid, id) ? id : null);

function updateTask(c, t, body, sourceNote, reviewId) {
  if (!canEditTask(c, t)) fail(403, `Статус і поля змінює ${nameOf(controller(t))} — той, хто поставив задачу. Напиши коментар.`);
  if (reviewId && t.history.some((change) => change.reviewId === reviewId)) return t;
  const prev = structuredClone(t);
  const by = c.uid;
  if (body.title !== undefined) t.title = str(body.title, 300) || t.title;
  if (body.description !== undefined) t.description = str(body.description, 10000);
  if (body.status !== undefined && body.status !== t.status) {
    if (!TASK_ST.includes(body.status)) fail(400, 'Невідомий статус');
    hist(t, by, `${STL[t.status]} → ${STL[body.status]}`, sourceNote);
    if (reviewId) t.history.at(-1).reviewId = reviewId;
    t.status = body.status;
  }
  if (body.owner !== undefined && body.owner !== t.owner) {
    const o = person(c.team, body.owner, 'Виконавець') || fail(400, 'Вкажи виконавця');
    if (isExternal(o) && isExternal(t.requester)) fail(400, 'Хоча б одна сторона має бути з команди');
    hist(t, by, `виконавець: ${nameOf(t.owner)} → ${nameOf(o)}`); t.owner = o;
  }
  if (body.due !== undefined && (dateOrNull(body.due) || null) !== t.due) { t.due = dateOrNull(body.due); t.urgent = null; hist(t, by, `дедлайн → ${t.due || 'без дедлайну'}`); }
  if (body.important !== undefined) t.important = Boolean(body.important);
  if (body.urgent !== undefined) t.urgent = body.urgent === null ? null : Boolean(body.urgent);
  if (body.project !== undefined) { t.project = validProject(c, body.project); if (t.hypothesis && store.hypotheses.get(c.tid, t.hypothesis)?.project !== t.project) t.hypothesis = null; }
  if (body.hypothesis !== undefined) t.hypothesis = validHyp(c, body.hypothesis);
  return store.saveTask(c.tid, t, prev);
}

/* ---------- knowledge ---------- */
const canSeeKn = (c, k) => k.scope === 'team' || k.author === c.uid;
const canEditKn = (c, k) => k.author === c.uid || (c.admin && k.scope === 'team');
const visibleKnowledge = (c) => store.listKnowledgeFor(c.tid, c.uid);
async function createKnowledge(c, input, extra = {}) {
  const k = {
    id: extra.id || store.newId('k'), type: KN_TYPES.includes(input.type) ? input.type : 'fact',
    text: str(input.text, 1000) || fail(400, 'Напиши текст'), why: str(input.why, 2000) || null,
    scope: input.scope === 'private' || c.team.kind === 'personal' ? 'private' : 'team',
    project: validProject(c, input.project), author: c.uid, date: dateOrNull(input.date) || today(),
    source: extra.source || 'Додано вручну', sourceItem: extra.sourceItem || null, quote: extra.quote || null,
    supersedes: null, supersededBy: null, createdAt: store.now(),
  };
  if (extra.id) {
    const existing = await store.findKnowledge(c.tid, k.id, c.uid);
    if (existing) return existing;
  }
  return store.saveKnowledge(c.tid, k);
}

/* ---------- projects & hypotheses ---------- */
function projectInput(c, body, p = {}) {
  if (body.name !== undefined) p.name = str(body.name, 120) || fail(400, 'Назва проєкту обов’язкова');
  if (body.vision !== undefined) p.vision = str(body.vision, 5000);
  if (body.status !== undefined) { if (!PRJ_ST.includes(body.status)) fail(400, 'Невідомий статус'); p.status = body.status; }
  if (body.owner !== undefined) p.owner = person(c.team, body.owner, 'Owner') || c.uid;
  if (body.color !== undefined && /^#[0-9a-f]{6}$/i.test(body.color)) p.color = body.color;
  if (Array.isArray(body.members)) p.members = body.members.filter((u) => isMember(c.team, u));
  if (Array.isArray(body.goals)) p.goals = body.goals.slice(0, 20).map((g) => ({ id: g.id || store.newId('g'), goal: str(g.goal, 300), metric: str(g.metric, 200), target: str(g.target, 50), current: str(g.current, 50), by: dateOrNull(g.by) })).filter((g) => g.goal);
  return p;
}
const canEditHyp = (c, h) => c.admin || h.owner === c.uid;
const stmt = (h) => `Якщо ${h.if}, то ${h.then}${h.because ? `, бо ${h.because}` : ''}`;
function hypInput(c, body, h = {}) {
  for (const k of ['if', 'then', 'because']) if (body[k] !== undefined) h[k] = str(body[k], 1000);
  if (body.project !== undefined) h.project = validProject(c, body.project) || fail(400, 'Гіпотеза має належати проєкту');
  if (body.owner !== undefined) h.owner = c.admin ? person(c.team, body.owner, 'Відповідальний') || c.uid : c.uid;
  for (const k of ['metric', 'target', 'current', 'verdict']) if (body[k] !== undefined) h[k] = str(body[k], 500);
  for (const k of ['from', 'to']) if (body[k] !== undefined) h[k] = dateOrNull(body[k]);
  if (body.status !== undefined) { if (!HYP_ST.includes(body.status)) fail(400, 'Невідомий статус'); h.status = body.status; }
  if (!h.if || !h.then) fail(400, 'Заповни «Якщо…» і «то…»');
  h.statement = stmt(h);
  return h;
}

/* ================= API: me & teams ================= */

app.get('/api/me', requireUser, route((req) => ({
  user: req.user,
  teams: store.teamsOfUser(req.user.id).map((t) => ({ id: t.id, name: t.name, kind: t.kind, role: t.members.find((m) => m.userId === req.user.id).role })),
  ai: aiConfigured(), model: MODEL,
})));

app.patch('/api/me', requireUser, route((req) => {
  const u = req.user;
  if (req.body.name !== undefined) u.name = str(req.body.name, 120) || u.name;
  if (Array.isArray(req.body.aliases)) u.aliases = req.body.aliases.map((a) => str(a, 60)).filter(Boolean).slice(0, 30);
  store.saveUser(u);
  return u;
}));

app.post('/api/teams', requireUser, route((req) => {
  const name = str(req.body.name, 120) || fail(400, 'Назва команди обов’язкова');
  return store.saveTeam({ id: store.newId('team'), kind: 'team', name, members: [{ userId: req.user.id, role: 'owner', joinedAt: store.now() }], invites: [], settings: { urgentDays: 2 }, createdAt: store.now() });
}));

// Everything the signed-in member may see in a team, in one payload.
app.get('/api/teams/:tid/state', requireUser, route(async (req) => {
  const c = ctx(req);
  const members = c.team.members.map((m) => { const u = store.getUser(m.userId) || {}; return { id: m.userId, role: m.role, joinedAt: m.joinedAt, name: u.name || m.userId, email: u.email, picture: u.picture, aliases: u.aliases || [] }; });
  const [tasks, knowledge] = await Promise.all([visibleTasks(c), visibleKnowledge(c)]);
  return {
    team: { id: c.team.id, name: c.team.name, kind: c.team.kind, settings: c.team.settings || { urgentDays: 2 }, invites: c.admin ? c.team.invites : [] },
    role: c.role, members,
    projects: store.projects.list(c.tid),
    hypotheses: store.hypotheses.list(c.tid),
    tasks: tasks.map((t) => taskView(c, t)),
    knowledge,
    inbox: store.listInbox(c.uid, c.tid).map(({ proposals, ...i }) => ({ ...i, counts: countProps(proposals) })),
    vision: store.getVision(c.tid),
  };
}));
const countProps = (ps = []) => ps.reduce((a, p) => ((a[p.kind] = (a[p.kind] || 0) + 1), a), {});

/* ---------- assistant chats ---------- */
const assistantRequests = new Set();
const chatRoute = '/api/teams/:tid/assistant/chats';
app.use(chatRoute, (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
app.get(chatRoute, requireUser, route((req) => {
  const { uid, tid } = ctx(req);
  return store.listAssistantChats(uid, tid);
}));
app.get(chatRoute + '/:cid', requireUser, route((req) => {
  const { uid, tid } = ctx(req);
  return store.getAssistantChat(uid, tid, req.params.cid) || fail(404, 'Чат не знайдено');
}));
app.post(chatRoute + '/:cid/messages', requireUser, route(async (req) => {
  const c = ctx(req);
  const cid = store.assertId(req.params.cid, 'chat id');
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!question || question.length > 2000) fail(400, 'Введи запитання до 2 000 символів.');
  const id = store.assertId(req.body?.id, 'message id');
  const chat = store.getAssistantChat(c.uid, c.tid, cid) || {
    id: cid, title: question.length > 72 ? question.slice(0, 71) + '…' : question, turns: [],
  };
  const existing = chat.turns.find((turn) => turn.id === id);
  if (existing) {
    if (existing.question !== question) fail(409, 'Цей ідентифікатор повідомлення вже використано.');
    return chat;
  }
  if (!aiConfigured()) fail(503, 'AI-асистент тимчасово недоступний.');
  const lock = `${c.uid}/${c.tid}`;
  if (assistantRequests.has(lock)) fail(409, 'Зачекай на відповідь на попереднє запитання.');
  assistantRequests.add(lock);
  try {
    const [tasks, knowledge] = await Promise.all([visibleTasks(c), visibleKnowledge(c)]);
    let reply;
    try {
      reply = await askAssistant({
        question, turns: chat.turns, team: c.team.name, viewerId: c.uid, today: today(), tasks, knowledge,
        projects: store.projects.list(c.tid), hypotheses: store.hypotheses.list(c.tid), nameOf,
      });
    } catch (error) { fail(502, errorMessage(error)); }
    ctx(req);
    chat.turns.push({ id, question, ...reply, createdAt: store.now() });
    return store.saveAssistantChat(c.uid, c.tid, chat);
  } finally { assistantRequests.delete(lock); }
}));

app.patch('/api/teams/:tid', requireUser, route((req) => {
  const c = ctx(req); if (!c.admin) fail(403, 'Лише Owner або Admin');
  if (req.body.name !== undefined) { if (c.role !== 'owner') fail(403, 'Перейменовує лише Owner'); c.team.name = str(req.body.name, 120) || c.team.name; }
  if (req.body.urgentDays !== undefined) c.team.settings = { ...(c.team.settings || {}), urgentDays: Math.max(0, Math.min(14, Number(req.body.urgentDays) || 2)) };
  return store.saveTeam(c.team);
}));

app.put('/api/teams/:tid/vision', requireUser, route((req) => {
  const c = ctx(req); if (!c.admin) fail(403, 'Team vision редагують Owner і Admin');
  store.saveVision(c.tid, str(req.body.markdown, 100000));
}));

/* ---------- members & invites ---------- */

app.post('/api/teams/:tid/invites', requireUser, route((req) => {
  const c = ctx(req); if (!c.admin) fail(403, 'Запрошувати можуть Owner і Admin');
  if (c.team.kind === 'personal') fail(400, 'В особистий простір не запрошують. Створи команду.');
  const suppliedEmail = str(req.body.email, 255);
  const email = normalizeEmail(suppliedEmail);
  if (suppliedEmail && !email) fail(400, 'Вкажи дійсну адресу електронної пошти для запрошення');
  const inv = { token: crypto.randomBytes(12).toString('base64url'), role: req.body.role === 'admin' ? 'admin' : 'member', email, createdBy: c.uid, createdAt: store.now() };
  c.team.invites.push(inv); store.saveTeam(c.team);
  return inv;
}));
app.delete('/api/teams/:tid/invites/:token', requireUser, route((req) => {
  const c = ctx(req); if (!c.admin) fail(403, 'Лише Owner або Admin');
  c.team.invites = c.team.invites.filter((i) => i.token !== req.params.token); store.saveTeam(c.team);
}));
function findInvite(token) {
  for (const t of store.listTeams()) { const inv = (t.invites || []).find((i) => i.token === token); if (inv) return { team: t, inv }; }
  return null;
}
function inviteForUser(req) {
  const found = findInvite(String(req.params.token)) || fail(404, 'Запрошення не знайдено або відкликано');
  const invitedEmail = normalizeEmail(found.inv.email);
  if (found.inv.email && (!invitedEmail || invitedEmail !== normalizeEmail(req.user.email))) {
    fail(403, 'Це запрошення надіслано на іншу адресу. Увійди з адресою, яку вказав власник команди.');
  }
  return found;
}
app.get('/api/invites/:token', requireUser, route((req) => {
  const f = inviteForUser(req);
  return { team: { id: f.team.id, name: f.team.name }, role: f.inv.role, invitedBy: nameOf(f.inv.createdBy), member: isMember(f.team, req.user.id) };
}));
app.post('/api/invites/:token/accept', requireUser, route((req) => {
  const f = inviteForUser(req);
  if (!isMember(f.team, req.user.id)) f.team.members.push({ userId: req.user.id, role: f.inv.role, joinedAt: store.now(), invitedBy: f.inv.createdBy });
  // An invite tied to an email is single-use; an open link stays until revoked.
  if (f.inv.email) f.team.invites = f.team.invites.filter((i) => i.token !== f.inv.token);
  store.saveTeam(f.team);
  return { teamId: f.team.id };
}));

app.patch('/api/teams/:tid/members/:uid', requireUser, route((req) => {
  const c = ctx(req); if (!c.admin) fail(403, 'Ролі змінюють Owner і Admin');
  const m = c.team.members.find((x) => x.userId === req.params.uid) || fail(404, 'Учасника не знайдено');
  if (m.role === 'owner') fail(400, 'Роль Owner змінюється лише через передачу ownership');
  if (!['admin', 'member'].includes(req.body.role)) fail(400, 'Невідома роль');
  m.role = req.body.role; store.saveTeam(c.team);
}));
app.delete('/api/teams/:tid/members/:uid', requireUser, route((req) => {
  const c = ctx(req);
  const self = req.params.uid === c.uid;
  if (!c.admin && !self) fail(403, 'Видаляти учасників можуть Owner і Admin');
  const m = c.team.members.find((x) => x.userId === req.params.uid) || fail(404, 'Учасника не знайдено');
  if (m.role === 'owner') fail(400, 'Owner не може вийти — спершу передай ownership');
  c.team.members = c.team.members.filter((x) => x !== m); store.saveTeam(c.team);
}));
app.post('/api/teams/:tid/transfer', requireUser, route((req) => {
  const c = ctx(req); if (c.role !== 'owner') fail(403, 'Передати ownership може лише Owner');
  if (str(req.body.confirm) !== c.team.name) fail(400, 'Назва команди не збігається');
  const to = c.team.members.find((x) => x.userId === req.body.userId && x.userId !== c.uid) || fail(400, 'Обери учасника');
  to.role = 'owner'; c.team.members.find((x) => x.userId === c.uid).role = 'admin';
  store.saveTeam(c.team);
}));

/* ================= API: projects & hypotheses ================= */

app.post('/api/teams/:tid/projects', requireUser, route((req) => {
  const c = ctx(req); if (!c.admin) fail(403, 'Проєкти створюють Owner і Admin');
  const n = store.projects.list(c.tid).length;
  const p = projectInput(c, { owner: c.uid, status: 'active', members: [c.uid], goals: [], vision: '', ...req.body }, { id: store.newId('p'), color: COLORS[n % COLORS.length], creator: c.uid, createdAt: store.now() });
  if (!p.name) fail(400, 'Назва проєкту обов’язкова');
  return store.projects.save(c.tid, p);
}));
app.patch('/api/teams/:tid/projects/:pid', requireUser, route((req) => {
  const c = ctx(req); if (!c.admin) fail(403, 'Проєкти редагують Owner і Admin');
  const p = store.projects.get(c.tid, req.params.pid) || fail(404, 'Проєкт не знайдено');
  return store.projects.save(c.tid, projectInput(c, req.body, p));
}));
app.delete('/api/teams/:tid/projects/:pid', requireUser, route((req) => {
  const c = ctx(req); if (!c.admin) fail(403, 'Лише Owner або Admin');
  store.projects.get(c.tid, req.params.pid) || fail(404, 'Проєкт не знайдено');
  if (store.hypotheses.list(c.tid).some((h) => h.project === req.params.pid)) fail(400, 'Спершу видали або перенеси гіпотези проєкту');
  store.projects.remove(c.tid, req.params.pid);
}));

app.post('/api/teams/:tid/hypotheses', requireUser, route((req) => {
  const c = ctx(req);
  const h = hypInput(c, { status: 'draft', owner: c.uid, metric: '', target: '', current: '', ...req.body }, { id: store.newId('h'), creator: c.uid, learnings: [], createdAt: store.now() });
  if (!h.project) fail(400, 'Гіпотеза має належати проєкту');
  return store.hypotheses.save(c.tid, h);
}));
app.patch('/api/teams/:tid/hypotheses/:hid', requireUser, route((req) => {
  const c = ctx(req);
  const h = store.hypotheses.get(c.tid, req.params.hid) || fail(404, 'Гіпотезу не знайдено');
  if (!canEditHyp(c, h)) fail(403, 'Гіпотезу редагує її відповідальний або Owner/Admin');
  const prevSt = h.status;
  hypInput(c, req.body, h);
  if (prevSt !== h.status) (h.history ||= []).push({ at: store.now(), by: c.uid, text: `${prevSt} → ${h.status}` });
  return store.hypotheses.save(c.tid, h);
}));
app.post('/api/teams/:tid/hypotheses/:hid/learnings', requireUser, route((req) => {
  const c = ctx(req);
  const h = store.hypotheses.get(c.tid, req.params.hid) || fail(404, 'Гіпотезу не знайдено');
  const text = str(req.body.text, 2000) || fail(400, 'Напиши висновок');
  h.learnings.unshift({ id: store.newId('l'), at: store.now(), by: c.uid, text });
  return store.hypotheses.save(c.tid, h);
}));
app.delete('/api/teams/:tid/hypotheses/:hid', requireUser, route((req) => {
  const c = ctx(req);
  const h = store.hypotheses.get(c.tid, req.params.hid) || fail(404, 'Гіпотезу не знайдено');
  if (!canEditHyp(c, h)) fail(403, 'Немає прав');
  store.hypotheses.remove(c.tid, h.id);
}));

/* ================= API: tasks ================= */

app.post('/api/teams/:tid/tasks', requireUser, route(async (req) => {
  const c = ctx(req); return taskView(c, await createTask(c, req.body));
}));
app.patch('/api/teams/:tid/tasks/:id', requireUser, route(async (req) => {
  const c = ctx(req); return taskView(c, await updateTask(c, await getTaskFor(c, req.params.id), req.body));
}));
app.delete('/api/teams/:tid/tasks/:id', requireUser, route(async (req) => {
  const c = ctx(req); const t = await getTaskFor(c, req.params.id);
  if (!canEditTask(c, t)) fail(403, 'Видалити може лише постановник');
  await store.removeTask(c.tid, t);
}));
app.post('/api/teams/:tid/tasks/:id/comments', requireUser, route(async (req) => {
  const c = ctx(req); const t = await getTaskFor(c, req.params.id);
  const text = str(req.body.text, 5000) || fail(400, 'Порожній коментар');
  t.comments.push({ id: store.newId('c'), author: c.uid, text, at: store.now(), readBy: [c.uid] });
  return taskView(c, await store.saveTask(c.tid, t));
}));
app.post('/api/teams/:tid/tasks/:id/read', requireUser, route(async (req) => {
  const c = ctx(req); const t = await getTaskFor(c, req.params.id);
  let changed = false;
  for (const x of t.comments) if (!(x.readBy ||= []).includes(c.uid)) { x.readBy.push(c.uid); changed = true; }
  if (changed) await store.saveTask(c.tid, t);
}));

/* ================= API: knowledge ================= */

app.post('/api/teams/:tid/knowledge', requireUser, route((req) => createKnowledge(ctx(req), req.body)));
app.patch('/api/teams/:tid/knowledge/:id', requireUser, route(async (req) => {
  const c = ctx(req);
  const k = await store.findKnowledge(c.tid, req.params.id, c.uid);
  if (!k || !canSeeKn(c, k)) fail(404, 'Не знайдено');
  if (!canEditKn(c, k)) fail(403, 'Редагує автор або Owner/Admin');
  const prev = { ...k };
  if (req.body.text !== undefined) k.text = str(req.body.text, 1000) || k.text;
  if (req.body.why !== undefined) k.why = str(req.body.why, 2000) || null;
  if (req.body.type !== undefined && KN_TYPES.includes(req.body.type)) k.type = req.body.type;
  if (req.body.scope !== undefined && c.team.kind !== 'personal') k.scope = req.body.scope === 'private' ? 'private' : 'team';
  if (req.body.project !== undefined) k.project = validProject(c, req.body.project);
  return store.saveKnowledge(c.tid, k, prev);
}));
app.delete('/api/teams/:tid/knowledge/:id', requireUser, route(async (req) => {
  const c = ctx(req);
  const k = await store.findKnowledge(c.tid, req.params.id, c.uid);
  if (!k || !canSeeKn(c, k)) fail(404, 'Не знайдено');
  if (!canEditKn(c, k)) fail(403, 'Видаляє автор або Owner/Admin');
  await store.removeKnowledge(c.tid, k);
}));

/* ================= API: inbox ================= */

const INBOX_TYPES = ['transcript', 'email', 'chat', 'doc', 'note'];
const applying = new Set();
const inboxKey = (uid, tid, iid) => `${uid}/${tid}/${iid}`;
app.use('/api/teams/:tid/inbox/:iid', (req, res, next) => {
  if (req.user && req.method !== 'GET' && req.method !== 'HEAD' && applying.has(inboxKey(req.user.id, req.params.tid, req.params.iid))) {
    return res.status(409).json({ error: 'Цей запис уже зберігається. Спробуй ще раз за мить.' });
  }
  next();
});

function replaceProposals(item, proposals) {
  if (!Array.isArray(proposals)) return;
  const completed = item.proposals.filter((p) => p.appliedKind);
  const ids = new Set(completed.map((p) => p.id));
  item.proposals = [...completed, ...sanitizeProposals(proposals).filter((p) => !ids.has(p.id))];
}

app.post('/api/teams/:tid/inbox', requireUser, route((req) => {
  const c = ctx(req);
  const text = str(req.body.text, 400000) || fail(400, 'Встав текст або обери файл');
  const type = INBOX_TYPES.includes(req.body.type) ? req.body.type : 'transcript';
  const date = dateOrNull(req.body.date) || today();
  const item = {
    id: store.newId('i'), owner: c.uid, type, title: str(req.body.title, 200) || `${type === 'note' ? 'Нотатка' : 'Запис'} — ${date}`,
    date, origin: str(req.body.origin, 100) || 'Вставлений текст', status: 'processing',
    summary: [], participants: [], proposals: [], error: null, createdAt: store.now(),
  };
  store.saveInboxItem(c.uid, c.tid, item, text);
  runAnalysis(c, item.id);
  return item;
}));

app.get('/api/teams/:tid/inbox/:iid', requireUser, route((req) => {
  const c = ctx(req);
  const item = store.getInboxItem(c.uid, c.tid, req.params.iid) || fail(404, 'Запис не знайдено (інбокс особистий)');
  return { ...item, source: store.getInboxSource(c.uid, c.tid, item.id) };
}));

app.patch('/api/teams/:tid/inbox/:iid', requireUser, route((req) => {
  const c = ctx(req);
  const item = store.getInboxItem(c.uid, c.tid, req.params.iid) || fail(404, 'Запис не знайдено');
  if (req.body.title !== undefined) item.title = str(req.body.title, 200) || item.title;
  replaceProposals(item, req.body.proposals);
  store.saveInboxItem(c.uid, c.tid, item);
  return item;
}));

app.post('/api/teams/:tid/inbox/:iid/ignore', requireUser, route((req) => {
  const c = ctx(req);
  const item = store.getInboxItem(c.uid, c.tid, req.params.iid) || fail(404, 'Запис не знайдено');
  item.status = item.status === 'ignored' ? 'review' : 'ignored';
  return store.saveInboxItem(c.uid, c.tid, item);
}));

app.post('/api/teams/:tid/inbox/:iid/reanalyze', requireUser, route((req) => {
  const c = ctx(req);
  const item = store.getInboxItem(c.uid, c.tid, req.params.iid) || fail(404, 'Запис не знайдено');
  if (item.type === 'routed') fail(400, 'Цей запис не має джерела для аналізу');
  if (item.status !== 'done' && item.proposals.some((p) => p.appliedKind)) fail(409, 'Спершу заверши збереження цього запису.');
  item.status = 'processing'; item.error = null; store.saveInboxItem(c.uid, c.tid, item);
  runAnalysis(c, item.id);
  return item;
}));

app.delete('/api/teams/:tid/inbox/:iid', requireUser, route((req) => {
  const c = ctx(req);
  store.getInboxItem(c.uid, c.tid, req.params.iid) || fail(404, 'Запис не знайдено');
  store.removeInboxItem(c.uid, c.tid, req.params.iid);
}));

app.post('/api/teams/:tid/inbox/:iid/apply', requireUser, route(async (req) => {
  const c = ctx(req);
  const item = store.getInboxItem(c.uid, c.tid, req.params.iid) || fail(404, 'Запис не знайдено');
  if (!['review', 'partial'].includes(item.status)) fail(400, 'Цей запис уже розібрано');
  const key = inboxKey(c.uid, c.tid, item.id);
  applying.add(key);
  try {
    replaceProposals(item, req.body.proposals);
    store.saveInboxItem(c.uid, c.tid, item);
    const res = await applyProposals(c, item);
    item.status = 'done';
    item.result = res.lines.join(' · ') || 'Нічого не збережено';
    item.appliedAt = store.now();
    store.saveInboxItem(c.uid, c.tid, item);
    return res;
  } finally { applying.delete(key); }
}));

/* ---------- analysis ---------- */

async function analysisContext(c) {
  const members = c.team.members.map((m) => { const u = store.getUser(m.userId) || {}; return { id: m.userId, name: u.name, emails: u.emails, aliases: u.aliases || [], role: m.role }; });
  const prj = store.projects.list(c.tid);
  const [tasks, knowledge] = await Promise.all([visibleTasks(c), visibleKnowledge(c)]);
  return {
    members,
    projects: prj.map((p) => ({ id: p.id, name: p.name, vision: p.vision?.slice(0, 300), status: p.status })),
    hypotheses: store.hypotheses.list(c.tid).map((h) => ({ id: h.id, project_id: h.project, statement: h.statement, status: h.status })),
    open_tasks: tasks.filter((t) => !['done', 'cancelled'].includes(t.status)).slice(0, 200)
      .map((t) => ({ id: t.id, title: t.title, owner: t.owner, requester: t.requester, status: t.status, due: t.due })),
    existing_knowledge: knowledge.filter((k) => !k.supersededBy).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 60)
      .map((k) => ({ id: k.id, type: k.type, text: k.text, date: k.date })),
  };
}

const running = new Set();
async function runAnalysis(c, iid) {
  const key = `${c.uid}/${c.tid}/${iid}`;
  if (running.has(key)) return;
  running.add(key);
  const item = store.getInboxItem(c.uid, c.tid, iid);
  try {
    if (!aiConfigured()) {
      Object.assign(item, { status: 'review', summary: [], proposals: [], error: 'AI-аналіз не налаштовано. Додай пропозиції вручну або налаштуй провайдер і запусти аналіз ще раз.' });
      return store.saveInboxItem(c.uid, c.tid, item);
    }
    const context = await analysisContext(c);
    const text = store.getInboxSource(c.uid, c.tid, iid);
    const out = await analyze({ text, title: item.title, type: item.type, date: item.date, uploader: { id: c.uid, name: c.me.name }, context });
    const fresh = store.getInboxItem(c.uid, c.tid, iid); if (!fresh) return;
    Object.assign(fresh, { status: 'review', error: null, summary: out.summary || [], participants: out.participants || [], proposals: toProposals(c, out, context, text), analyzedAt: store.now() });
    store.saveInboxItem(c.uid, c.tid, fresh);
  } catch (e) {
    console.error('[analyze]', e);
    const fresh = store.getInboxItem(c.uid, c.tid, iid);
    if (fresh) { fresh.status = 'failed'; fresh.error = e.$metadata ? 'Сховище S3 тимчасово недоступне.' : errorMessage(e); store.saveInboxItem(c.uid, c.tid, fresh); }
  } finally { running.delete(key); }
}

function toProposals(c, out, context, source) {
  const mem = new Set(context.members.map((m) => m.id));
  const prj = new Set(context.projects.map((p) => p.id));
  const hyp = new Map(context.hypotheses.map((h) => [h.id, h]));
  const tsk = new Map(context.open_tasks.map((t) => [t.id, t]));
  const kn = new Set(context.existing_knowledge.map((k) => k.id));
  const who = (id, ext, dflt) => (id && mem.has(id) ? id : ext ? `ext:${str(ext, 120)}` : dflt);
  const pid = () => store.newId('pr');
  const ev = (x) => ({ quote: str(x.evidence_quote, 1000), ts: str(x.evidence_timestamp, 20) || null, conf: x.confidence === 'high' ? 'high' : 'medium' });
  const P = [];
  for (const x of out.commitments || []) {
    let owner = who(x.owner_member_id, x.owner_external_name, c.uid), requester = who(x.requester_member_id, x.requester_external_name, c.uid);
    if (isExternal(owner) && isExternal(requester)) requester = c.uid;
    const project = prj.has(x.project_id) ? x.project_id : null;
    const hypothesis = hyp.has(x.hypothesis_id) && (!project || hyp.get(x.hypothesis_id).project_id === project) ? x.hypothesis_id : null;
    const dup = tsk.has(x.duplicate_of_task_id) ? x.duplicate_of_task_id : null;
    P.push({ id: pid(), kind: 'task', on: x.confidence === 'high', ...ev(x), title: str(x.title, 300), owner, requester, due: dateOrNull(x.due), project, hypothesis, important: Boolean(x.important), dup, merge: Boolean(dup) });
  }
  for (const x of out.status_updates || []) {
    const t = tsk.get(x.task_id); if (!t || t.status === x.new_status || !TASK_ST.includes(x.new_status)) continue;
    P.push({ id: pid(), kind: 'status', on: x.confidence === 'high', ...ev(x), task: t.id, to: x.new_status });
  }
  const paragraph = (text) => text.replace(/\s+/g, ' ').trim();
  const groundQuote = knowledgeEvidence(source);
  const seenChunks = new Set(context.existing_knowledge.map((k) => paragraph(k.text).toLowerCase()));
  for (const x of out.knowledge || []) {
    const evidence = ev(x);
    const text = str(paragraph(str(x.text)), 1000);
    const signature = text.toLowerCase();
    if (!text || seenChunks.has(signature)) continue;
    const quote = groundQuote(evidence.quote);
    if (!quote) continue;
    seenChunks.add(signature);
    const conflict = kn.has(x.conflicts_with_id) ? x.conflicts_with_id : null;
    P.push({ id: pid(), kind: 'kn', on: x.confidence === 'high', ...evidence, quote, type: KN_TYPES.includes(x.type) ? x.type : 'fact', text, why: str(x.why, 2000), scope: c.team.kind === 'personal' ? 'private' : x.scope === 'private' ? 'private' : 'team', project: prj.has(x.project_id) ? x.project_id : null, conflict, res: conflict ? 'replace' : null });
  }
  for (const x of out.new_projects || []) P.push({ id: pid(), kind: 'project', on: false, ...ev(x), name: str(x.name, 120), vision: str(x.vision, 2000) });
  for (const x of out.new_hypotheses || []) P.push({ id: pid(), kind: 'hyp', on: false, ...ev(x), project: prj.has(x.project_id) ? x.project_id : null, if: str(x.if, 1000), then: str(x.then, 1000), because: str(x.because, 1000), metric: str(x.metric, 300), owner: x.owner_member_id && mem.has(x.owner_member_id) ? x.owner_member_id : c.uid });
  return P.filter((p) => p.quote);
}

const PROP_KEYS = ['id', 'kind', 'on', 'quote', 'ts', 'conf', 'title', 'owner', 'requester', 'due', 'project', 'hypothesis', 'important', 'dup', 'merge', 'task', 'to', 'type', 'text', 'why', 'scope', 'conflict', 'res', 'name', 'vision', 'if', 'then', 'because', 'metric', 'from', 'manual'];
function sanitizeProposals(ps) {
  const used = new Set();
  return ps.slice(0, 300).filter((p) => p && ['task', 'status', 'kn', 'project', 'hyp'].includes(p.kind)).map((p) => {
    const o = pick(p, PROP_KEYS);
    o.id = typeof o.id === 'string' && /^[\w-]{1,80}$/.test(o.id) && !used.has(o.id) ? o.id : store.newId('pr');
    used.add(o.id);
    o.on = Boolean(o.on);
    for (const k of ['title', 'text', 'why', 'name', 'vision', 'if', 'then', 'because', 'metric', 'quote']) if (o[k] != null) o[k] = str(o[k], 2000);
    return o;
  });
}

/* ---------- apply reviewed proposals ---------- */

async function applyProposals(c, item) {
  const n = { task: 0, merged: 0, status: 0, routed: 0, kn: 0, project: 0, hyp: 0, skipped: 0 };
  const notified = new Set(), notes = [];
  const sourceOf = (p) => ({ itemId: item.id, itemTitle: item.title, owner: c.uid, ts: p.ts || null, quote: p.quote || '' });
  const idFor = (type, p) => `${type}_${crypto.createHash('sha256').update(JSON.stringify([c.uid, c.tid, item.id, p.id])).digest('hex').slice(0, 32)}`;
  const saved = (p, id, kind) => {
    p.applied = id;
    p.appliedKind = kind;
    n[kind]++;
    store.saveInboxItem(c.uid, c.tid, item);
  };
  const createdProjects = new Map();
  for (const p of item.proposals.filter((p) => p.appliedKind)) {
    n[p.appliedKind]++;
    if (p.kind === 'project') createdProjects.set(p.id, p.applied);
  }
  for (const p of item.proposals.filter((x) => x.on && x.kind === 'project')) {
    if (p.appliedKind) continue;
    if (!c.admin) { n.skipped++; notes.push(`Проєкт «${p.name}» не створено: потрібна роль Admin`); continue; }
    const id = idFor('p', p);
    if (!store.projects.get(c.tid, id)) {
      const pr = projectInput(c, { name: p.name, vision: p.vision || '', owner: c.uid, status: 'active', members: [c.uid], goals: [] }, { id, color: COLORS[store.projects.list(c.tid).length % COLORS.length], creator: c.uid, createdAt: store.now(), source: sourceOf(p) });
      store.projects.save(c.tid, pr);
    }
    createdProjects.set(p.id, id); saved(p, id, 'project');
  }
  for (const p of item.proposals.filter((x) => x.on && x.kind !== 'project')) {
    if (p.appliedKind) continue;
    try {
      if (p.kind === 'task') {
        const dup = p.dup && p.merge ? await store.findTask(c.tid, p.dup, c.uid) : null;
        if (dup && canSeeTask(c, dup)) {
          const reviewId = idFor('review', p);
          if (!dup.history.some((change) => change.reviewId === reviewId)) {
            hist(dup, c.uid, `Згадано ще раз у «${item.title}»${p.quote ? `: “${p.quote.slice(0, 160)}”` : ''}`, item.title);
            dup.history.at(-1).reviewId = reviewId;
            await store.saveTask(c.tid, dup);
          }
          saved(p, dup.id, 'merged');
        } else {
          const t = await createTask(c, p, { id: idFor('t', p), source: sourceOf(p), historyText: `Створено з «${item.title}», підтвердив ${c.me.name}` });
          saved(p, t.id, 'task');
          if (t.owner !== c.uid && !isExternal(t.owner)) notified.add(nameOf(t.owner));
          if (t.requester !== c.uid && !isExternal(t.requester)) notified.add(nameOf(t.requester));
        }
      } else if (p.kind === 'status') {
        const t = await store.findTask(c.tid, p.task, c.uid);
        if (!t || !canSeeTask(c, t) || !TASK_ST.includes(p.to)) { n.skipped++; continue; }
        if (canEditTask(c, t)) {
          await updateTask(c, t, { status: p.to }, `з «${item.title}», підтвердив ${c.me.name}`, idFor('review', p));
          saved(p, t.id, 'status');
        } else {
          routeStatusProposal(c, item, p, t, idFor('i', p));
          saved(p, t.id, 'routed'); notified.add(nameOf(controller(t)));
        }
      } else if (p.kind === 'kn') {
        const k = await createKnowledge(c, { ...p, date: item.date }, { id: idFor('k', p), source: `${item.title}${p.ts ? ' · ' + p.ts : ''}`, sourceItem: item.id, quote: p.quote });
        if (p.conflict && p.res === 'replace') {
          const old = await store.findKnowledge(c.tid, p.conflict, c.uid);
          if (old && canSeeKn(c, old) && (canEditKn(c, old) || old.scope === 'team')) {
            if (old.supersededBy !== k.id) { old.supersededBy = k.id; await store.saveKnowledge(c.tid, old); }
            if (k.supersedes !== old.id) { k.supersedes = old.id; await store.saveKnowledge(c.tid, k); }
          }
        }
        saved(p, k.id, 'kn');
      } else if (p.kind === 'hyp') {
        const project = createdProjects.get(p.project) || validProject(c, p.project);
        if (!project) { n.skipped++; notes.push('Гіпотезу без проєкту пропущено — обери проєкт'); continue; }
        const id = idFor('h', p);
        if (!store.hypotheses.get(c.tid, id)) {
          const h = hypInput(c, { project, if: p.if, then: p.then, because: p.because, metric: p.metric || '', target: '', current: '', status: 'draft', owner: p.owner || c.uid }, { id, creator: c.uid, learnings: [], createdAt: store.now(), source: sourceOf(p) });
          store.hypotheses.save(c.tid, h);
        }
        saved(p, id, 'hyp');
      }
    } catch (e) {
      if (e instanceof HttpError) { n.skipped++; notes.push(e.message); } else throw e;
    }
  }
  const lines = [
    n.task && `${n.task} нових комітментів`, n.merged && `${n.merged} об’єднано з існуючими`, n.status && `${n.status} статусів оновлено`,
    n.routed && `${n.routed} пропозицій відправлено постановникам`, n.kn && `${n.kn} знань збережено`, n.project && `${n.project} проєктів`,
    n.hyp && `${n.hyp} гіпотез-чернеток`, n.skipped && `${n.skipped} пропущено`,
  ].filter(Boolean);
  return { lines, notified: [...notified], notes };
}

// A status change for someone else's task goes to that person's inbox (spec §5.2).
function routeStatusProposal(c, item, p, t, id) {
  const to = controller(t);
  if (!isMember(c.team, to) || store.getInboxItem(to, c.tid, id)) return;
  const routed = {
    id, owner: to, type: 'routed', title: `${c.me.name}: оновлення по «${t.title}»`, date: item.date,
    origin: `Від ${c.me.name} · з «${item.title}»`, status: 'review', summary: [`${c.me.name} пропонує змінити статус задачі «${t.title}» на «${STL[p.to]}».`],
    participants: [], proposals: [{ ...p, id: store.newId('pr'), on: true }], error: null, createdAt: store.now(), routedFrom: c.uid,
  };
  store.saveInboxItem(to, c.tid, routed, `${c.me.name} пропонує: «${t.title}» → ${STL[p.to]}\n\nЦитата з «${item.title}»${p.ts ? ` (${p.ts})` : ''}:\n\n> ${p.quote}`);
}

/* ================= roadmap (single source: README.md) ================= */

app.get('/api/roadmap', requireUser, route(() => {
  const readme = fs.readFileSync(path.join(here, '..', 'README.md'), 'utf8');
  const i = readme.indexOf('## Roadmap');
  return { markdown: i < 0 ? '' : readme.slice(i).replace(/^## Roadmap\s*\n/, '') };
}));

/* ================= static + SPA ================= */

app.get('/join/:token', (req, res) => res.redirect(`/#join-${encodeURIComponent(req.params.token)}`));
app.use(express.static(path.join(here, '..', 'public'), { index: 'index.html' }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.TEAMOS_HOST || undefined;
app.listen(PORT, HOST, () => {
  store.rebuildRootIndex();
  if (store.S3_RECORDS) store.rebuildRecordIndexes();
  console.log(`TeamOS → http://${HOST || 'localhost'}:${PORT}`);
  console.log(`  data:   ${store.DATA_DIR}`);
  console.log(`  tasks and knowledge: ${store.S3_RECORDS ? 'Amazon S3' : 'local filesystem'}`);
  console.log(`  email sign-in: ${magicLinkConfigured() ? 'SendGrid' : 'not configured'}`);
  console.log(`  ai:     ${aiConfigured() ? `${AI_PROVIDER} / ${MODEL}` : 'not configured (manual review)'}`);
});
