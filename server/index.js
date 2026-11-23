import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as store from './store.js';
import { mountAuthRoutes, sessionMiddleware, requireUser, magicLinkConfigured, origin } from './auth.js';
import { normalizeEmail } from './magic-link.js';
import { aiConfigured, errorMessage, AI_PROVIDER, MODEL } from './ai.js';
import { askAssistant } from './assistant.js';
import { langOf, tr, render, msg, LANGS } from './i18n.js';
import * as D from './domain.js';
import { transcribeConfigured } from './transcribe.js';
import { mountOAuth } from './oauth.js';
import { mountMcp } from './mcp.js';
import { getSharedTask, replaceTaskShare, taskForSharing } from './task-share.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_LOCAL_PROXY === '1') app.set('trust proxy', 'loopback');
// A PDF arrives base64-encoded in JSON, so adding to the inbox gets a larger body limit than the rest of the API.
const jsonSmall = express.json({ limit: '5mb' }), jsonInbox = express.json({ limit: '30mb' });
app.use((req, res, next) => (req.method === 'POST' && /^\/api\/teams\/[^/]+\/inbox(\/audio)?\/?$/.test(req.path) ? jsonInbox : jsonSmall)(req, res, next));
app.use(sessionMiddleware);
mountAuthRoutes(app);
mountOAuth(app);
mountMcp(app);

/* ================= helpers ================= */

const { fail, failWith, errorMsg, str, isExternal, isMember, nameOf, today } = D;
const route = (fn) => async (req, res) => {
  try { const out = await fn(req, res); if (!res.headersSent) res.json(out ?? { ok: true }); }
  catch (e) {
    const s = e.status || (e.$metadata ? 503 : 500);
    if (s >= 500) console.error(e);
    res.status(s).json({ error: render(langOf(req), errorMsg(e)) });
  }
};
const ctx = (req) => D.ctxFor(req.user, req.params.tid, langOf(req));

/* ================= API: me & teams ================= */

app.get('/api/me', requireUser, route(async (req) => ({
  user: req.user,
  teams: (await store.teamsOfUser(req.user.id)).map((t) => ({ id: t.id, name: t.name, kind: t.kind, role: t.members.find((m) => m.userId === req.user.id).role })),
  ai: aiConfigured(), model: MODEL, transcribe: transcribeConfigured(),
})));

app.patch('/api/me', requireUser, route(async (req) => {
  const u = req.user;
  if (req.body.name !== undefined) u.name = str(req.body.name, 120) || u.name;
  if (Array.isArray(req.body.aliases)) u.aliases = req.body.aliases.map((a) => str(a, 60)).filter(Boolean).slice(0, 30);
  if (LANGS.includes(req.body.lang)) u.lang = req.body.lang;
  await store.saveUser(u);
  return u;
}));

app.post('/api/teams', requireUser, route((req) => D.createTeam(req.user, req.body.name, langOf(req))));

// Everything the signed-in member may see in a team, in one payload.
app.get('/api/teams/:tid/state', requireUser, route(async (req) => {
  const c = await ctx(req);
  const [members, tasks, knowledge, projects, hypotheses, inbox, vision, sources] = await Promise.all([
    D.memberList(c.team), D.visibleTasks(c), D.visibleKnowledge(c), store.projects.list(c.tid),
    store.hypotheses.list(c.tid), store.listInbox(c.uid, c.tid), store.getVision(c.tid), D.listSources(c),
  ]);
  return {
    team: { id: c.team.id, name: c.team.name, kind: c.team.kind, settings: c.team.settings || { urgentDays: 2 }, invites: c.admin ? c.team.invites : [] },
    role: c.role, members,
    projects, hypotheses,
    tasks: tasks.map((t) => D.taskView(c, t)),
    knowledge,
    sources: sources.map((s) => ({ ...s, canDelete: D.canDeleteSource(c, s) })),
    inbox: inbox.map(({ proposals, ...i }) => ({ ...D.inboxView(c.lang, i), counts: D.countProps(D.reviewProposals({ ...i, proposals })) })),
    vision,
  };
}));

/* ---------- assistant chats ---------- */
const assistantRequests = new Set();
const chatRoute = '/api/teams/:tid/assistant/chats';
app.use(chatRoute, (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
app.get(chatRoute, requireUser, route(async (req) => {
  const { uid, tid } = await ctx(req);
  return store.listAssistantChats(uid, tid);
}));
app.get(chatRoute + '/:cid', requireUser, route(async (req) => {
  const { uid, tid } = await ctx(req);
  return await store.getAssistantChat(uid, tid, req.params.cid) || fail(404, 'Chat not found');
}));
app.post(chatRoute + '/:cid/messages', requireUser, route(async (req) => {
  const c = await ctx(req);
  const cid = store.assertId(req.params.cid, 'chat id');
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!question || question.length > 2000) fail(400, 'Enter a question of up to 2,000 characters.');
  const id = store.assertId(req.body?.id, 'message id');
  const chat = await store.getAssistantChat(c.uid, c.tid, cid) || {
    id: cid, title: question.length > 72 ? question.slice(0, 71) + '…' : question, turns: [],
  };
  const existing = chat.turns.find((turn) => turn.id === id);
  if (existing) {
    if (existing.question !== question) fail(409, 'This message ID has already been used.');
    return chat;
  }
  if (!aiConfigured()) fail(503, 'The AI assistant is temporarily unavailable.');
  const lock = `${c.uid}/${c.tid}`;
  if (assistantRequests.has(lock)) fail(409, 'Wait for the answer to your previous question.');
  assistantRequests.add(lock);
  try {
    const [tasks, knowledge, projects, hypotheses, members] = await Promise.all([
      D.visibleTasks(c), D.visibleKnowledge(c), store.projects.list(c.tid), store.hypotheses.list(c.tid), D.teamMembers(c.team),
    ]);
    const names = new Map(members.map(({ userId, profile }) => [userId, profile?.name]));
    let reply;
    try {
      reply = await askAssistant({
        question, turns: chat.turns, team: c.team.name, lang: c.lang, viewerId: c.uid, today: today(), tasks, knowledge,
        projects, hypotheses, documents: D.assistantDocuments(c), nameOf: (who) => isExternal(who) ? who.slice(4) : names.get(who) || '—',
      });
    } catch (error) { failWith(502, errorMessage(error)); }
    await ctx(req);
    chat.turns.push({ id, question, ...reply, createdAt: store.now() });
    return store.saveAssistantChat(c.uid, c.tid, chat);
  } finally { assistantRequests.delete(lock); }
}));

app.patch('/api/teams/:tid', requireUser, route(async (req) => {
  const c = await ctx(req); if (!c.admin) fail(403, 'Only Owner or Admin');
  if (req.body.name !== undefined) { if (c.role !== 'owner') fail(403, 'Only the Owner can rename the team'); c.team.name = str(req.body.name, 120) || c.team.name; }
  if (req.body.urgentDays !== undefined) c.team.settings = { ...(c.team.settings || {}), urgentDays: Math.max(0, Math.min(14, Number(req.body.urgentDays) || 2)) };
  return store.saveTeam(c.team);
}));

app.put('/api/teams/:tid/vision', requireUser, route(async (req) => { await D.saveVision(await ctx(req), req.body.markdown); }));

/* ---------- members & invites ---------- */

app.post('/api/teams/:tid/invites', requireUser, route(async (req) => D.createInvite(await ctx(req), req.body)));
app.delete('/api/teams/:tid/invites/:token', requireUser, route(async (req) => { await D.revokeInvite(await ctx(req), req.params.token); }));
async function findInvite(token) {
  for (const t of await store.listTeams()) { const inv = (t.invites || []).find((i) => i.token === token); if (inv) return { team: t, inv }; }
  return null;
}
async function inviteForUser(req) {
  const found = await findInvite(String(req.params.token)) || fail(404, 'Invite not found or revoked');
  const invitedEmail = normalizeEmail(found.inv.email);
  if (found.inv.email && (!invitedEmail || invitedEmail !== normalizeEmail(req.user.email))) {
    fail(403, 'This invite was sent to another address. Sign in with the address the team owner entered.');
  }
  return found;
}
app.get('/api/invites/:token', requireUser, route(async (req) => {
  const f = await inviteForUser(req);
  return { team: { id: f.team.id, name: f.team.name }, role: f.inv.role, invitedBy: await nameOf(f.inv.createdBy), member: isMember(f.team, req.user.id) };
}));
app.post('/api/invites/:token/accept', requireUser, route(async (req) => {
  const f = await inviteForUser(req);
  if (!isMember(f.team, req.user.id)) f.team.members.push({ userId: req.user.id, role: f.inv.role, joinedAt: store.now(), invitedBy: f.inv.createdBy });
  // An invite tied to an email is single-use; an open link stays until revoked.
  if (f.inv.email) f.team.invites = f.team.invites.filter((i) => i.token !== f.inv.token);
  await store.saveTeam(f.team);
  return { teamId: f.team.id };
}));

app.patch('/api/teams/:tid/members/:uid', requireUser, route(async (req) => { await D.changeRole(await ctx(req), req.params.uid, req.body.role); }));
app.delete('/api/teams/:tid/members/:uid', requireUser, route(async (req) => { await D.removeMember(await ctx(req), req.params.uid); }));
app.post('/api/teams/:tid/transfer', requireUser, route(async (req) => {
  const c = await ctx(req); if (c.role !== 'owner') fail(403, 'Only the Owner can transfer ownership');
  if (str(req.body.confirm) !== c.team.name) fail(400, 'The team name doesn’t match');
  const to = c.team.members.find((x) => x.userId === req.body.userId && x.userId !== c.uid) || fail(400, 'Choose a member');
  to.role = 'owner'; c.team.members.find((x) => x.userId === c.uid).role = 'admin';
  await store.saveTeam(c.team);
}));

/* ================= API: projects & hypotheses ================= */

app.post('/api/teams/:tid/projects', requireUser, route(async (req) => D.createProject(await ctx(req), req.body)));
app.patch('/api/teams/:tid/projects/:pid', requireUser, route(async (req) => D.updateProject(await ctx(req), req.params.pid, req.body)));
app.delete('/api/teams/:tid/projects/:pid', requireUser, route(async (req) => { await D.deleteProject(await ctx(req), req.params.pid); }));

app.post('/api/teams/:tid/hypotheses', requireUser, route(async (req) => D.createHypothesis(await ctx(req), req.body)));
app.patch('/api/teams/:tid/hypotheses/:hid', requireUser, route(async (req) => D.updateHypothesis(await ctx(req), req.params.hid, req.body)));
app.post('/api/teams/:tid/hypotheses/:hid/learnings', requireUser, route(async (req) => D.addLearning(await ctx(req), req.params.hid, req.body.text)));
app.delete('/api/teams/:tid/hypotheses/:hid', requireUser, route(async (req) => { await D.deleteHypothesis(await ctx(req), req.params.hid); }));

/* ================= API: tasks ================= */

app.post('/api/teams/:tid/tasks', requireUser, route(async (req) => {
  const c = await ctx(req); return D.taskView(c, await D.createTask(c, req.body));
}));
app.patch('/api/teams/:tid/tasks/:id', requireUser, route(async (req) => {
  const c = await ctx(req); return D.taskView(c, await D.updateTask(c, await D.getTaskFor(c, req.params.id), req.body));
}));
app.delete('/api/teams/:tid/tasks/:id', requireUser, route(async (req) => { await D.deleteTask(await ctx(req), req.params.id); }));
app.post('/api/teams/:tid/tasks/:id/comments', requireUser, route(async (req) => {
  const c = await ctx(req); return D.taskView(c, await D.commentOnTask(c, req.params.id, req.body.text));
}));
app.post('/api/teams/:tid/tasks/:id/read', requireUser, route(async (req) => {
  const c = await ctx(req); const t = await D.getTaskFor(c, req.params.id);
  let changed = false;
  for (const x of t.comments) if (!(x.readBy ||= []).includes(c.uid)) { x.readBy.push(c.uid); changed = true; }
  if (changed) await store.saveTask(c.tid, t);
}));

const taskShareRoute = '/api/teams/:tid/tasks/:id/share';
const shareLink = (token) => token ? `${origin}/share/task/${token}` : null;
app.use(taskShareRoute, (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
app.get(taskShareRoute, requireUser, route(async (req) => {
  const task = await taskForSharing(await ctx(req), req.params.id);
  return { link: shareLink(task.shareToken) };
}));
app.post(taskShareRoute, requireUser, route(async (req) => {
  if (!req.is('application/json')) fail(403, 'Open TeamOS and try again.');
  const c = await ctx(req);
  const task = await taskForSharing(c, req.params.id);
  return { link: shareLink(await replaceTaskShare(c, task)) };
}));
app.delete(taskShareRoute, requireUser, route(async (req) => {
  const c = await ctx(req);
  const task = await taskForSharing(c, req.params.id);
  if (task.shareToken) await store.saveTaskShare(c.tid, task, null);
  return { link: null };
}));

/* ================= API: knowledge ================= */

app.post('/api/teams/:tid/knowledge', requireUser, route(async (req) => D.createKnowledge(await ctx(req), req.body)));
app.patch('/api/teams/:tid/knowledge/:id', requireUser, route(async (req) => D.updateKnowledge(await ctx(req), req.params.id, req.body)));
app.delete('/api/teams/:tid/knowledge/:id', requireUser, route(async (req) => { await D.deleteKnowledge(await ctx(req), req.params.id); }));

/* ================= API: sources ================= */

app.get('/api/teams/:tid/sources/:sid', requireUser, route(async (req) => D.getSourceWithText(await ctx(req), req.params.sid)));
app.get('/api/teams/:tid/sources/:sid/file', requireUser, route(async (req, res) => {
  const { src, buf } = await D.getSourceFile(await ctx(req), req.params.sid);
  sendPdf(res, buf, src.file.name, req.query.download !== '1');
}));
app.get('/api/teams/:tid/sources/:sid/audio', requireUser, route(async (req, res) => sendAudio(res, await D.getSourceAudio(await ctx(req), req.params.sid))));
app.delete('/api/teams/:tid/sources/:sid', requireUser, route(async (req) => { await D.deleteSource(await ctx(req), req.params.sid); }));

/* ================= API: inbox ================= */

const { applying, inboxKey } = D;
app.use('/api/teams/:tid/inbox/:iid', (req, res, next) => {
  if (req.user && req.method !== 'GET' && req.method !== 'HEAD' && applying.has(inboxKey(req.user.id, req.params.tid, req.params.iid))) {
    return res.status(409).json({ error: tr(langOf(req), 'This item is already being saved. Try again in a moment.') });
  }
  next();
});

app.post('/api/teams/:tid/inbox', requireUser, route(async (req) => {
  const c = await ctx(req);
  const f = req.body?.file;
  if (!f) return D.addInboxItem(c, req.body);
  if (typeof f.data !== 'string' || !/^[A-Za-z0-9+/=\s]+$/.test(f.data)) fail(400, 'The file is not a PDF.');
  return D.addInboxItem(c, req.body, { pdf: { buf: Buffer.from(f.data, 'base64'), name: f.name } });
}));

// Original files are served as downloads of a fixed type, so the browser never runs them as part of the app.
function sendPdf(res, buf, name, inline) {
  const ascii = String(name || 'document.pdf').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  res.set({
    'Content-Type': 'application/pdf', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store',
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name || 'document.pdf')}`,
  });
  res.send(buf);
}
// Recordings are served with their own audio type and never sniffed into anything else.
function sendAudio(res, { mime, buf }) {
  res.set({ 'Content-Type': D.audioType(mime), 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline' });
  res.send(buf);
}
app.post('/api/teams/:tid/inbox/audio', requireUser, route(async (req) => D.addVoiceItem(await ctx(req), req.body)));
app.get('/api/teams/:tid/inbox/:iid/audio', requireUser, route(async (req, res) => sendAudio(res, await D.getInboxAudio(await ctx(req), req.params.iid))));

app.get('/api/teams/:tid/inbox/:iid/file', requireUser, route(async (req, res) => {
  const c = await ctx(req);
  const item = await store.getInboxItem(c.uid, c.tid, req.params.iid) || fail(404, 'Item not found (the inbox is personal)');
  const buf = item.file ? await store.getInboxFile(c.uid, c.tid, item.id) : null;
  if (!buf) fail(404, 'The source has no file');
  sendPdf(res, buf, item.file.name, req.query.download !== '1');
}));

app.get('/api/teams/:tid/inbox/:iid', requireUser, route(async (req) => {
  const c = await ctx(req);
  const item = await store.getInboxItem(c.uid, c.tid, req.params.iid) || fail(404, 'Item not found (the inbox is personal)');
  return { ...D.inboxView(c.lang, item), source: await store.getInboxSource(c.uid, c.tid, item.id) };
}));

app.patch('/api/teams/:tid/inbox/:iid', requireUser, route(async (req) => {
  const c = await ctx(req);
  const item = await store.getInboxItem(c.uid, c.tid, req.params.iid) || fail(404, 'Item not found');
  if (req.body.title !== undefined) item.title = str(req.body.title, 200) || item.title;
  if (D.SOURCE_SCOPES.includes(req.body.sourceScope)) item.sourceScope = req.body.sourceScope;
  D.replaceProposals(item, req.body.proposals);
  await store.saveInboxItem(c.uid, c.tid, item);
  return item;
}));

app.post('/api/teams/:tid/inbox/:iid/ignore', requireUser, route(async (req) => {
  const c = await ctx(req);
  const item = await store.getInboxItem(c.uid, c.tid, req.params.iid) || fail(404, 'Item not found');
  item.status = item.status === 'ignored' ? 'review' : 'ignored';
  return await store.saveInboxItem(c.uid, c.tid, item);
}));

app.post('/api/teams/:tid/inbox/:iid/reanalyze', requireUser, route(async (req) => {
  const c = await ctx(req);
  return D.inboxView(c.lang, await D.reanalyzeInboxItem(c, req.params.iid));
}));

app.delete('/api/teams/:tid/inbox/:iid', requireUser, route(async (req) => {
  const c = await ctx(req);
  const item = await store.getInboxItem(c.uid, c.tid, req.params.iid) || fail(404, 'Item not found');
  await store.removeInboxItem(c.uid, c.tid, item);
}));

app.post('/api/teams/:tid/inbox/:iid/apply', requireUser, route(async (req) => {
  const c = await ctx(req);
  const key = inboxKey(c.uid, c.tid, req.params.iid);
  if (applying.has(key)) fail(409, 'This item is already being saved. Try again in a moment.');
  applying.add(key);
  try {
    const item = await store.getInboxItem(c.uid, c.tid, req.params.iid) || fail(404, 'Item not found');
    if (!['review', 'partial'].includes(item.status)) fail(400, 'This item has already been processed');
    D.replaceProposals(item, req.body.proposals);
    if (D.SOURCE_SCOPES.includes(req.body.sourceScope)) item.sourceScope = req.body.sourceScope;
    await store.saveInboxItem(c.uid, c.tid, item);
    const res = await D.applyProposals(c, item);
    item.status = 'done';
    item.resultMsg = res.lines;
    item.result = res.lines.map((m) => render('en', m)).join(' · ') || 'Nothing was saved';
    item.appliedAt = store.now();
    await store.saveInboxItem(c.uid, c.tid, item);
    return { lines: res.lines.map((m) => render(c.lang, m)), notified: res.notified, notes: res.notes.map((m) => render(c.lang, m)), sourceId: item.sourceId || null };
  } finally { applying.delete(key); }
}));

/* ================= roadmap (single source: README.md) ================= */

app.get('/api/roadmap', requireUser, route(() => {
  const readme = fs.readFileSync(path.join(here, '..', 'README.md'), 'utf8');
  const i = readme.indexOf('## Roadmap');
  return { markdown: i < 0 ? '' : readme.slice(i).replace(/^## Roadmap\s*\n/, '') };
}));

/* ================= static + SPA ================= */

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
app.get('/share/task/:token', async (req, res) => {
  const lang = req.acceptsLanguages('en', 'uk') || 'en';
  const t = (key) => tr(lang, key);
  res.set({
    'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  });

  let task, unavailable;
  try {
    task = await getSharedTask(req.params.token);
    if (!task) { res.status(404); unavailable = t('This task link is unavailable'); }
  } catch (error) {
    console.error('[task share]', error);
    res.status(503);
    unavailable = t('Could not load the task. Please try again.');
  }
  const date = task?.due && new Date(`${task.due}T00:00:00Z`);
  const deadline = date && !Number.isNaN(+date)
    ? new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeZone: 'UTC' }).format(date)
    : task?.due;
  res.type('html').send(`<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t('Shared task')} · TeamOS</title><link rel="stylesheet" href="/app.css"></head>
<body><main class="ob task-share-page"><header class="login-brand"><span class="logo" aria-hidden="true">T</span>TeamOS</header>
<article class="card"><h1>${escapeHtml(task?.title ?? unavailable)}</h1>
${deadline ? `<p class="hint">${t('Deadline')} · <time datetime="${escapeHtml(task.due)}">${escapeHtml(deadline)}</time></p>` : ''}
${task?.description ? `<p class="task-share-description">${escapeHtml(task.description)}</p>` : ''}
</article></main></body></html>`);
});

app.get('/join/:token', (req, res) => res.redirect(`/#join-${encodeURIComponent(req.params.token)}`));
app.use(express.static(path.join(here, '..', 'public'), { index: 'index.html' }));
app.use('/api', (req, res) => res.status(404).json({ error: tr(langOf(req), 'Not found') }));

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.TEAMOS_HOST || undefined;
store.initializeLocalStorage();
app.listen(PORT, HOST, () => {
  console.log(`TeamOS → http://${HOST || 'localhost'}:${PORT}`);
  console.log(`  data:   ${store.S3_RECORDS ? 'Amazon S3' : store.DATA_DIR}`);
  console.log(`  email sign-in: ${magicLinkConfigured() ? 'SendGrid' : 'not configured'}`);
  console.log(`  ai:     ${aiConfigured() ? `${AI_PROVIDER} / ${MODEL}` : 'not configured (manual review)'}`);
  console.log(`  mcp:    ${new URL('/mcp', process.env.BASE_URL || `http://localhost:${PORT}`).href} (OAuth)`);
});
