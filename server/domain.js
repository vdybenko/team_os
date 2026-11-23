// TeamOS domain logic and access rules, shared by the HTTP API (index.js) and the MCP server (mcp.js).
// Every operation takes a member context `c` built by ctxFor(), so both surfaces enforce the same permissions.

import crypto from 'node:crypto';
import * as store from './store.js';
import { normalizeEmail } from './magic-link.js';
import { analyze, aiConfigured, errorMessage } from './ai.js';
import { knowledgeEvidence } from './evidence.js';
import { tr, render, msg } from './i18n.js';
import { pdfToText, MAX_PDF_BYTES } from './pdf.js';
import { transcribe, transcribeConfigured, MAX_AUDIO_BYTES } from './transcribe.js';

/* ================= helpers ================= */

export const { isExternal } = store;
// Messages are English keys; they are translated into the requester's language when sent (server/i18n.js).
export class HttpError extends Error { constructor(status, key, vars) { super(tr('en', key, vars)); this.status = status; this.i18n = msg(key, vars); } }
export const fail = (status, key, vars) => { throw new HttpError(status, key, vars); };
export const failWith = (status, m) => fail(status, m.key, m.vars);
// Any error as a message: HttpError and AI errors carry { key, vars }; other English messages are looked up as keys.
export const errorMsg = (e) => (e.$metadata ? msg('S3 storage is temporarily unavailable.') : e.i18n || msg(e.message || 'Server error'));
export const str = (v, max = 2000) => (v == null ? '' : String(v).trim().slice(0, max));
export const dateOrNull = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
export const today = () => new Date().toISOString().slice(0, 10);
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

export const TASK_ST = ['open', 'progress', 'waiting', 'done', 'cancelled'];
export const HYP_ST = ['draft', 'testing', 'validated', 'invalidated'];
export const PRJ_ST = ['active', 'paused', 'done', 'archived'];
export const KN_TYPES = ['decision', 'agreement', 'fact', 'process', 'context'];
export const INBOX_TYPES = ['transcript', 'email', 'chat', 'doc', 'note'];
const STL = { open: 'Open', progress: 'In progress', waiting: 'Waiting', done: 'Done', cancelled: 'Cancelled' };
const st = (code) => ({ $t: STL[code] || code });
const COLORS = ['#1f4fd8', '#0b8a5f', '#b4441c', '#7a3fb0', '#a8326e', '#2f7f8f', '#8a6d00'];

/* ================= member context ================= */

export async function ctxFor(user, tid, lang) {
  const team = await store.getTeam(tid) || fail(404, 'Team not found');
  const m = team.members.find((x) => x.userId === user.id) || fail(403, 'You are not a member of this team');
  return { team, tid: team.id, me: user, uid: user.id, role: m.role, admin: ['owner', 'admin'].includes(m.role), lang };
}
export const isMember = (team, uid) => team.members.some((m) => m.userId === uid);
export async function teamMembers(team) {
  return Promise.all(team.members.map(async (member) => ({ ...member, profile: await store.getUser(member.userId) })));
}
export async function memberList(team) {
  return (await teamMembers(team)).map(({ userId, role, joinedAt, profile = {} }) => ({
    id: userId, role, joinedAt, name: profile?.name || userId, email: profile?.email, picture: profile?.picture, aliases: profile?.aliases || [],
  }));
}

// People reference: a member id, or "ext:Name" for an external contact.
function person(team, v, field) {
  if (typeof v !== 'string' || !v) return null;
  if (isExternal(v)) { const n = str(v.slice(4), 120); return n ? `ext:${n}` : null; }
  if (!isMember(team, v)) fail(400, '{field}: this person is not on the team', { field: { $t: field } });
  return v;
}

/* ---------- task permissions (spec §5.2) ---------- */
// Status and fields are changed only by whoever set the task (the requester).
// When the requester is external, the member who created the task controls it.
export const controller = (t) => (t.requester && !isExternal(t.requester) ? t.requester : t.creator);
export async function nameOf(who) {
  if (!who) return '—';
  return isExternal(who) ? who.slice(4) : (await store.getUser(who))?.name || '—';
}
export const canEditTask = (c, t) => controller(t) === c.uid;
export const canSeeTask = (c, t) => [t.owner, t.requester, t.creator].includes(c.uid) || (c.admin && store.taskHolder(t).shared);
export async function visibleTasks(c) {
  return (await store.listTasksFor(c.tid, c.uid)).filter((t) => canSeeTask(c, t));
}
export async function getTaskFor(c, id) {
  const t = await store.findTask(c.tid, store.assertId(id, 'task id'), c.uid);
  if (!t || !canSeeTask(c, t)) fail(404, 'Task not found');
  return t;
}
// History entries keep the message as { key, vars } so each viewer reads it in their own language.
// `source` is either plain text (an item title) or a message.
function hist(t, by, m, source) {
  const entry = { at: store.now(), by, text: render('en', m), msg: m };
  if (source) Object.assign(entry, typeof source === 'string' ? { source } : { source: render('en', source), sourceMsg: source });
  t.history.push(entry);
}
const histView = (lang, h) => ({ ...h, ...(h.msg ? { text: render(lang, h.msg) } : {}), ...(h.sourceMsg ? { source: render(lang, h.sourceMsg) } : {}) });

export function taskView(c, { shareToken, ...t }) {
  return {
    ...t,
    history: t.history.map((h) => histView(c.lang, h)),
    canEdit: canEditTask(c, t),
    controller: controller(t),
    shared: store.taskHolder(t).shared,
    unread: t.comments.filter((x) => x.author !== c.uid && !(x.readBy || []).includes(c.uid)).length,
  };
}

export async function createTask(c, input, extra = {}) {
  const owner = person(c.team, input.owner ?? c.uid, 'Owner') || c.uid;
  const requester = person(c.team, input.requester ?? c.uid, 'Requester') || c.uid;
  if (isExternal(owner) && isExternal(requester)) fail(400, 'At least one side must be a team member');
  const title = str(input.title, 300) || fail(400, 'Write what needs to be done');
  const t = {
    id: extra.id || store.newId('t'), title, description: str(input.description, 10000),
    owner, requester, creator: c.uid,
    due: dateOrNull(input.due), important: Boolean(input.important), urgent: null,
    status: TASK_ST.includes(input.status) ? input.status : 'open',
    project: await validProject(c, input.project), hypothesis: await validHyp(c, input.hypothesis),
    source: extra.source || null, comments: [], history: [], createdAt: store.now(),
  };
  if (extra.id) {
    const existing = await store.findTask(c.tid, t.id, store.taskHolder(t).userId || c.uid);
    if (existing) return existing;
  }
  hist(t, c.uid, extra.history || msg('Created manually'), extra.source?.itemTitle);
  return store.saveTask(c.tid, t);
}
const validProject = async (c, id) => (id && typeof id === 'string' && await store.projects.get(c.tid, id) ? id : null);
const validHyp = async (c, id) => (id && typeof id === 'string' && await store.hypotheses.get(c.tid, id) ? id : null);

export async function updateTask(c, t, body, sourceNote, reviewId) {
  if (!canEditTask(c, t)) fail(403, '{name}, who set the task, changes its status and fields. Write a comment.', { name: await nameOf(controller(t)) });
  if (reviewId && t.history.some((change) => change.reviewId === reviewId)) return t;
  const prev = structuredClone(t);
  const by = c.uid;
  if (body.title !== undefined) t.title = str(body.title, 300) || t.title;
  if (body.description !== undefined) t.description = str(body.description, 10000);
  if (body.status !== undefined && body.status !== t.status) {
    if (!TASK_ST.includes(body.status)) fail(400, 'Unknown status');
    hist(t, by, msg('{from} → {to}', { from: st(t.status), to: st(body.status) }), sourceNote);
    if (reviewId) t.history.at(-1).reviewId = reviewId;
    t.status = body.status;
  }
  if (body.owner !== undefined && body.owner !== t.owner) {
    const o = person(c.team, body.owner, 'Owner') || fail(400, 'Choose an owner');
    if (isExternal(o) && isExternal(t.requester)) fail(400, 'At least one side must be a team member');
    hist(t, by, msg('owner: {from} → {to}', { from: await nameOf(t.owner), to: await nameOf(o) })); t.owner = o;
  }
  if (body.due !== undefined && (dateOrNull(body.due) || null) !== t.due) { t.due = dateOrNull(body.due); t.urgent = null; hist(t, by, msg('deadline → {due}', { due: t.due || { $t: 'no deadline' } })); }
  if (body.important !== undefined) t.important = Boolean(body.important);
  if (body.urgent !== undefined) t.urgent = body.urgent === null ? null : Boolean(body.urgent);
  if (body.project !== undefined) { t.project = await validProject(c, body.project); if (t.hypothesis && (await store.hypotheses.get(c.tid, t.hypothesis))?.project !== t.project) t.hypothesis = null; }
  if (body.hypothesis !== undefined) t.hypothesis = await validHyp(c, body.hypothesis);
  return store.saveTask(c.tid, t, prev);
}
export async function deleteTask(c, id) {
  const t = await getTaskFor(c, id);
  if (!canEditTask(c, t)) fail(403, 'Only the requester can delete it');
  await store.removeTask(c.tid, t);
}
export async function commentOnTask(c, id, text) {
  const t = await getTaskFor(c, id);
  const body = str(text, 5000) || fail(400, 'Empty comment');
  t.comments.push({ id: store.newId('c'), author: c.uid, text: body, at: store.now(), readBy: [c.uid] });
  return store.saveTask(c.tid, t);
}

/* ---------- knowledge ---------- */
export const canSeeKn = (c, k) => k.scope === 'team' || k.author === c.uid;
export const canEditKn = (c, k) => k.author === c.uid || (c.admin && k.scope === 'team');
export const visibleKnowledge = (c) => store.listKnowledgeFor(c.tid, c.uid);
// A knowledge entry sits in a project and, optionally, one of its hypotheses.
async function knPlacement(c, project, hypothesis) {
  const h = hypothesis && await store.hypotheses.get(c.tid, hypothesis);
  if (!h) return { project, hypothesis: null };
  if (!project) return { project: await validProject(c, h.project), hypothesis: h.id };
  return { project, hypothesis: h.project === project ? h.id : null };
}
export async function createKnowledge(c, input, extra = {}) {
  const k = {
    id: extra.id || store.newId('k'), type: KN_TYPES.includes(input.type) ? input.type : 'fact',
    text: str(input.text, 1000) || fail(400, 'Write the text'), why: str(input.why, 2000) || null,
    scope: input.scope === 'private' || c.team.kind === 'personal' ? 'private' : 'team',
    ...await knPlacement(c, await validProject(c, input.project), await validHyp(c, input.hypothesis)), author: c.uid, date: dateOrNull(input.date) || today(),
    source: extra.source || 'Added manually', sourceItem: extra.sourceItem || null, sourceId: extra.sourceId || null, quote: extra.quote || null,
    supersedes: null, supersededBy: null, createdAt: store.now(),
  };
  if (extra.id) {
    const existing = await store.findKnowledge(c.tid, k.id, c.uid);
    if (existing) return existing;
  }
  const saved = await store.saveKnowledge(c.tid, k);
  if (input.supersedes) await supersede(c, saved, input.supersedes);
  return saved;
}
// A new entry replaces an old one: the old one is kept, marked as superseded.
async function supersede(c, k, oldId) {
  const old = await store.findKnowledge(c.tid, store.assertId(oldId, 'knowledge id'), c.uid);
  if (!old || !canSeeKn(c, old) || old.scope !== k.scope || old.id === k.id) fail(400, 'The entry to replace was not found');
  if (!canEditKn(c, old) && old.scope !== 'team') fail(403, 'The author or Owner/Admin can edit');
  if (old.supersededBy !== k.id) { old.supersededBy = k.id; await store.saveKnowledge(c.tid, old); }
  if (k.supersedes !== old.id) { k.supersedes = old.id; await store.saveKnowledge(c.tid, k); }
}
async function editableKnowledge(c, id, action) {
  const k = await store.findKnowledge(c.tid, store.assertId(id, 'knowledge id'), c.uid);
  if (!k || !canSeeKn(c, k)) fail(404, 'Knowledge entry not found');
  if (!canEditKn(c, k)) fail(403, action === 'delete' ? 'The author or Owner/Admin can delete' : 'The author or Owner/Admin can edit');
  return k;
}
export async function updateKnowledge(c, id, body) {
  const k = await editableKnowledge(c, id, 'edit');
  const prev = { ...k };
  if (body.text !== undefined) k.text = str(body.text, 1000) || k.text;
  if (body.why !== undefined) k.why = str(body.why, 2000) || null;
  if (body.type !== undefined && KN_TYPES.includes(body.type)) k.type = body.type;
  if (body.scope !== undefined && c.team.kind !== 'personal') k.scope = body.scope === 'private' ? 'private' : 'team';
  if (body.project !== undefined) k.project = await validProject(c, body.project);
  if (body.hypothesis !== undefined) k.hypothesis = await validHyp(c, body.hypothesis);
  Object.assign(k, await knPlacement(c, k.project, k.hypothesis));
  return store.saveKnowledge(c.tid, k, prev);
}
export async function deleteKnowledge(c, id) {
  await store.removeKnowledge(c.tid, await editableKnowledge(c, id, 'delete'));
}

/* ---------- projects & hypotheses ---------- */
const goalInput = (g) => ({ id: typeof g.id === 'string' && /^[\w-]{1,80}$/.test(g.id) ? g.id : store.newId('g'), goal: str(g.goal, 300), metric: str(g.metric, 200), target: str(g.target, 50), current: str(g.current, 50), by: dateOrNull(g.by) });
function projectInput(c, body, p = {}) {
  if (body.name !== undefined) p.name = str(body.name, 120) || fail(400, 'Project name is required');
  if (body.vision !== undefined) p.vision = str(body.vision, 5000);
  if (body.status !== undefined) { if (!PRJ_ST.includes(body.status)) fail(400, 'Unknown status'); p.status = body.status; }
  if (body.owner !== undefined) p.owner = person(c.team, body.owner, 'Project owner') || c.uid;
  if (body.color !== undefined && /^#[0-9a-f]{6}$/i.test(body.color)) p.color = body.color;
  if (Array.isArray(body.members)) p.members = body.members.filter((u) => isMember(c.team, u));
  if (Array.isArray(body.goals)) p.goals = body.goals.slice(0, 20).map(goalInput).filter((g) => g.goal);
  return p;
}
export async function createProject(c, body, extra = {}) {
  if (!c.admin) fail(403, 'Owner and Admin create projects');
  const n = (await store.projects.list(c.tid)).length;
  const p = projectInput(c, { owner: c.uid, status: 'active', members: [c.uid], goals: [], vision: '', ...body }, { id: extra.id || store.newId('p'), color: COLORS[n % COLORS.length], creator: c.uid, createdAt: store.now(), ...(extra.source ? { source: extra.source } : {}) });
  if (!p.name) fail(400, 'Project name is required');
  return store.projects.save(c.tid, p);
}
export async function getProject(c, pid) {
  return await store.projects.get(c.tid, store.assertId(pid, 'project id')) || fail(404, 'Project not found');
}
export async function updateProject(c, pid, body) {
  if (!c.admin) fail(403, 'Owner and Admin edit projects');
  return store.projects.save(c.tid, projectInput(c, body, await getProject(c, pid)));
}
export async function deleteProject(c, pid) {
  if (!c.admin) fail(403, 'Only Owner or Admin');
  const p = await getProject(c, pid);
  if ((await store.hypotheses.list(c.tid)).some((h) => h.project === p.id)) fail(400, 'Delete or move the project’s hypotheses first');
  await store.projects.remove(c.tid, p);
}
// Goals live inside the project. Upsert by goal id; a new goal is appended.
export async function saveGoal(c, pid, input) {
  if (!c.admin) fail(403, 'Owner and Admin edit projects');
  const p = await getProject(c, pid);
  const goals = [...(p.goals || [])];
  const i = input.id ? goals.findIndex((g) => g.id === input.id) : -1;
  if (input.id && i < 0) fail(404, 'Goal not found');
  const merged = goalInput({ ...(i >= 0 ? goals[i] : {}), ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) });
  if (!merged.goal) fail(400, 'Write the goal');
  if (i >= 0) goals[i] = merged; else { if (goals.length >= 20) fail(400, 'A project can have up to 20 goals'); goals.push(merged); }
  p.goals = goals;
  await store.projects.save(c.tid, p);
  return { project: p, goal: merged };
}
export async function removeGoal(c, pid, goalId) {
  if (!c.admin) fail(403, 'Owner and Admin edit projects');
  const p = await getProject(c, pid);
  if (!(p.goals || []).some((g) => g.id === goalId)) fail(404, 'Goal not found');
  p.goals = p.goals.filter((g) => g.id !== goalId);
  return store.projects.save(c.tid, p);
}

export const canEditHyp = (c, h) => c.admin || h.owner === c.uid;
const stmt = (h) => `If ${h.if}, then ${h.then}${h.because ? `, because ${h.because}` : ''}`;
async function hypInput(c, body, h = {}) {
  for (const k of ['if', 'then', 'because']) if (body[k] !== undefined) h[k] = str(body[k], 1000);
  if (body.project !== undefined) h.project = await validProject(c, body.project) || fail(400, 'A hypothesis must belong to a project');
  if (body.owner !== undefined) h.owner = c.admin ? person(c.team, body.owner, 'Responsible') || c.uid : c.uid;
  for (const k of ['metric', 'target', 'current', 'verdict']) if (body[k] !== undefined) h[k] = str(body[k], 500);
  for (const k of ['from', 'to']) if (body[k] !== undefined) h[k] = dateOrNull(body[k]);
  if (body.status !== undefined) { if (!HYP_ST.includes(body.status)) fail(400, 'Unknown status'); h.status = body.status; }
  if (!h.if || !h.then) fail(400, 'Fill in “If…” and “then…”');
  h.statement = stmt(h);
  return h;
}
export async function createHypothesis(c, body, extra = {}) {
  const h = await hypInput(c, { status: 'draft', owner: c.uid, metric: '', target: '', current: '', ...body }, { id: extra.id || store.newId('h'), creator: c.uid, learnings: [], createdAt: store.now(), ...(extra.source ? { source: extra.source } : {}) });
  if (!h.project) fail(400, 'A hypothesis must belong to a project');
  return store.hypotheses.save(c.tid, h);
}
export async function getHypothesis(c, hid) {
  return await store.hypotheses.get(c.tid, store.assertId(hid, 'hypothesis id')) || fail(404, 'Hypothesis not found');
}
export async function updateHypothesis(c, hid, body) {
  const h = await getHypothesis(c, hid);
  if (!canEditHyp(c, h)) fail(403, 'The responsible person or Owner/Admin edits the hypothesis');
  const prevSt = h.status;
  await hypInput(c, body, h);
  if (prevSt !== h.status) (h.history ||= []).push({ at: store.now(), by: c.uid, text: `${prevSt} → ${h.status}` });
  return store.hypotheses.save(c.tid, h);
}
export async function addLearning(c, hid, text) {
  const h = await getHypothesis(c, hid);
  const body = str(text, 2000) || fail(400, 'Write a learning');
  h.learnings.unshift({ id: store.newId('l'), at: store.now(), by: c.uid, text: body });
  return store.hypotheses.save(c.tid, h);
}
export async function deleteHypothesis(c, hid) {
  const h = await getHypothesis(c, hid);
  if (!canEditHyp(c, h)) fail(403, 'No permission');
  await store.hypotheses.remove(c.tid, h);
}

/* ---------- teams, vision, members & invites ---------- */

export async function createTeam(user, nameInput, lang) {
  const name = str(nameInput, 120) || fail(400, 'Team name is required');
  const team = await store.saveTeam({ id: store.newId('team'), kind: 'team', name, members: [{ userId: user.id, role: 'owner', joinedAt: store.now() }], invites: [], settings: { urgentDays: 2 }, createdAt: store.now() });
  await store.saveVision(team.id, store.initialVision(team, lang));
  return team;
}
export async function saveVision(c, markdown) {
  if (!c.admin) fail(403, 'Owner and Admin edit the Team vision');
  await store.saveVision(c.tid, str(markdown, 100000));
}
export async function createInvite(c, { email: suppliedEmail, role } = {}) {
  if (!c.admin) fail(403, 'Owner and Admin can invite');
  if (c.team.kind === 'personal') fail(400, 'You can’t invite people to a personal space. Create a team.');
  const raw = str(suppliedEmail, 255);
  const email = normalizeEmail(raw);
  if (raw && !email) fail(400, 'Enter a valid email address for the invite');
  const inv = { token: crypto.randomBytes(12).toString('base64url'), role: role === 'admin' ? 'admin' : 'member', email, createdBy: c.uid, createdAt: store.now() };
  c.team.invites.push(inv); await store.saveTeam(c.team);
  return inv;
}
export async function revokeInvite(c, token) {
  if (!c.admin) fail(403, 'Only Owner or Admin');
  const before = c.team.invites.length;
  c.team.invites = c.team.invites.filter((i) => i.token !== token);
  if (c.team.invites.length !== before) await store.saveTeam(c.team);
  return before !== c.team.invites.length;
}
export async function changeRole(c, uid, role) {
  if (!c.admin) fail(403, 'Owner and Admin change roles');
  const m = c.team.members.find((x) => x.userId === uid) || fail(404, 'Member not found');
  if (m.role === 'owner') fail(400, 'The Owner role changes only by transferring ownership');
  if (!['admin', 'member'].includes(role)) fail(400, 'Unknown role');
  m.role = role; await store.saveTeam(c.team);
  return m;
}
export async function removeMember(c, uid) {
  const self = uid === c.uid;
  if (!c.admin && !self) fail(403, 'Owner and Admin remove members');
  const m = c.team.members.find((x) => x.userId === uid) || fail(404, 'Member not found');
  if (m.role === 'owner') fail(400, 'The Owner can’t leave — transfer ownership first');
  c.team.members = c.team.members.filter((x) => x !== m); await store.saveTeam(c.team);
}

/* ================= inbox ================= */

export const applying = new Set();
export const inboxKey = (uid, tid, iid) => `${uid}/${tid}/${iid}`;

export const inboxView = (lang, i) => ({
  ...i,
  ...(i.proposals ? { proposals: reviewProposals(i) } : {}),
  ...(i.resultMsg ? { result: i.resultMsg.map((m) => render(lang, m)).join(' · ') || render(lang, msg('Nothing was saved')) } : {}),
  ...(i.error ? { error: render(lang, i.errorMsg || msg(i.error)) } : {}),
});
export const reviewProposals = ({ status, proposals = [] }) => (status === 'done' ? proposals : proposals.filter((p) => !p.appliedKind));
export const countProps = (ps = []) => ps.reduce((a, p) => ((a[p.kind] = (a[p.kind] || 0) + 1), a), {});

export function replaceProposals(item, proposals) {
  if (!Array.isArray(proposals)) return;
  const completed = item.proposals.filter((p) => p.appliedKind);
  const ids = new Set(completed.map((p) => p.id));
  item.proposals = [...completed, ...sanitizeProposals(proposals).filter((p) => !ids.has(p.id))];
}

// Adds raw text to the member's personal inbox and starts AI analysis in the background.
// `pdf` = { buf, name }: the text is extracted from the file, and the file itself is kept with the item.
export async function addInboxItem(c, body, { pdf } = {}) {
  let extracted = null;
  if (pdf) {
    if (pdf.buf.length > MAX_PDF_BYTES) fail(413, 'The file is too large (max 20 MB)');
    try { extracted = await pdfToText(pdf.buf); } catch (e) { fail(400, e.message); }
  }
  const text = extracted ? extracted.text.slice(0, 400000) : str(body.text, 400000) || fail(400, 'Paste text or choose a file');
  const type = INBOX_TYPES.includes(body.type) ? body.type : pdf ? 'doc' : 'transcript';
  const date = dateOrNull(body.date) || today();
  const fileName = pdf ? str(pdf.name, 200).replace(/[\\/\u0000-\u001f]/g, '_') || 'document.pdf' : null;
  const item = {
    id: store.newId('i'), owner: c.uid, type, title: str(body.title, 200) || (fileName ? fileName.replace(/\.pdf$/i, '') : tr(c.lang, type === 'note' ? 'Note — {date}' : 'Entry — {date}', { date })),
    date, origin: str(body.origin, 100) || (pdf ? `PDF · ${fileName}` : tr(c.lang, 'Pasted text')), status: 'processing',
    summary: [], participants: [], proposals: [], error: null, createdAt: store.now(),
    ...(pdf ? { file: { name: fileName, size: pdf.buf.length, pages: extracted.pages, mime: 'application/pdf' } } : {}),
  };
  if (pdf) await store.saveInboxFile(c.uid, c.tid, item.id, pdf.buf);
  await store.saveInboxItem(c.uid, c.tid, item, text);
  runAnalysis(c, item.id).catch((error) => console.error('[analyze] Failed to persist analysis:', error.name));
  return item;
}

/* ---------- dictation ---------- */
// A voice note: the recording is kept as the item's original, its transcript becomes the source text.
// With server transcription configured, the browser's live transcript is only a fallback.
const AUDIO_MIME = /^audio\/[\w.+-]+(;\s*codecs=[\w.,"' -]+)?$/i;
export const audioType = (mime) => String(mime || '').split(';')[0].trim() || 'audio/webm';
export async function addVoiceItem(c, body) {
  const mime = str(body.mime, 100);
  if (!AUDIO_MIME.test(mime)) fail(400, 'Unsupported audio format');
  if (typeof body.audio !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(body.audio)) fail(400, 'The recording is empty');
  const audio = Buffer.from(body.audio, 'base64');
  if (audio.length < 200) fail(400, 'The recording is empty');
  if (audio.length > MAX_AUDIO_BYTES) fail(413, 'The recording is too long (max 20 MB)');
  const draft = str(body.text, 400000);
  // A transcript the person corrected by hand is kept as it is; otherwise the server transcribes again.
  const server = transcribeConfigured() && !(body.edited === true && draft);
  const lang = /^[a-z]{2}$/.test(body.lang) ? body.lang : null;
  if (!server && !draft) fail(400, 'No transcript: speech recognition didn’t catch anything and server transcription isn’t configured');
  const type = INBOX_TYPES.includes(body.type) ? body.type : 'note';
  const date = dateOrNull(body.date) || today();
  const duration = Math.max(0, Math.min(36000, Math.round(Number(body.duration) || 0)));
  const item = {
    id: store.newId('i'), owner: c.uid, type, title: str(body.title, 200) || tr(c.lang, 'Voice note — {date}', { date }),
    date, origin: tr(c.lang, 'Voice recording'), status: 'processing',
    audio: { mime: audioType(mime), size: audio.length, duration, lang, transcript: server ? 'pending' : 'browser' },
    summary: [], participants: [], proposals: [], error: null, createdAt: store.now(),
  };
  await store.saveInboxAudio(c.uid, c.tid, item.id, audio);
  await store.saveInboxItem(c.uid, c.tid, item, draft);
  runAnalysis(c, item.id).catch((error) => console.error('[analyze] Failed to persist analysis:', error.name));
  return item;
}
export async function getInboxAudio(c, iid) {
  const item = await store.getInboxItem(c.uid, c.tid, iid) || fail(404, 'Item not found (the inbox is personal)');
  const buf = item.audio ? await store.getInboxAudio(c.uid, c.tid, item.id) : null;
  return buf ? { mime: item.audio.mime, buf } : fail(404, 'The source has no recording');
}
// Replaces the browser draft with the server transcript; keeps the draft if the service fails.
async function transcribeItem(c, iid) {
  const item = await store.getInboxItem(c.uid, c.tid, iid);
  if (item?.audio?.transcript !== 'pending') return;
  const draft = await store.getInboxSource(c.uid, c.tid, iid);
  let text = '', failure = null;
  if (transcribeConfigured()) {
    item.stage = 'transcribing'; await store.saveInboxItem(c.uid, c.tid, item);
    const buf = await store.getInboxAudio(c.uid, c.tid, iid);
    try { text = buf ? await transcribe(buf, item.audio.mime, item.audio.lang) : ''; } catch (e) { failure = e; console.error('[transcribe]', e.message); }
    // Guard against hallucinated output on silence or noise: a much shorter result than the live draft is ignored.
    if (text && draft.trim().length > 40 && text.length < draft.trim().length * 0.3) text = '';
  }
  const fresh = await store.getInboxItem(c.uid, c.tid, iid); if (!fresh) return;
  delete fresh.stage;
  fresh.audio.transcript = text ? 'server' : 'browser';
  if (!text && !draft.trim()) { await store.saveInboxItem(c.uid, c.tid, fresh); throw failure || new Error('The recording has no recognizable speech.'); }
  await store.saveInboxItem(c.uid, c.tid, fresh, text || undefined);
}

/* ---------- analysis ---------- */

async function analysisContext(c, item) {
  const [people, prj, hypotheses, tasks, knowledge, vision] = await Promise.all([
    teamMembers(c.team), store.projects.list(c.tid), store.hypotheses.list(c.tid), visibleTasks(c), visibleKnowledge(c), store.getVision(c.tid),
  ]);
  const appliedTasks = new Map((item.proposals || []).filter((p) => ['task', 'merged'].includes(p.appliedKind)).map((p) => [p.applied, {
    id: p.applied, title: p.title, owner: p.owner, requester: p.requester, quote: p.quote, timestamp: p.ts,
  }]));
  for (const { id, title, owner, requester, source } of tasks) {
    // Older reanalysis runs replaced the proposal list. The task still points to its inbox item.
    if (source?.itemId === item.id && source.owner === c.uid) {
      appliedTasks.set(id, { id, title, owner, requester, quote: source.quote, timestamp: source.ts });
    }
  }
  return {
    team_vision: (vision || '').slice(0, 6000),
    members: people.map(({ userId, role, profile }) => ({ id: userId, name: profile?.name || userId, emails: profile?.emails, aliases: profile?.aliases || [], role })),
    projects: prj.map((p) => ({ id: p.id, name: p.name, vision: p.vision?.slice(0, 600), status: p.status })),
    hypotheses: hypotheses.map((h) => ({ id: h.id, project_id: h.project, statement: h.statement || [h.if, h.then, h.because].filter(Boolean).join(' → '), status: h.status })),
    open_tasks: tasks.filter((t) => !['done', 'cancelled'].includes(t.status)).slice(0, 200)
      .map((t) => ({ id: t.id, title: t.title, owner: t.owner, requester: t.requester, status: t.status, due: t.due })),
    ...(appliedTasks.size ? { applied_tasks: [...appliedTasks.values()] } : {}),
    existing_knowledge: knowledge.filter((k) => !k.supersededBy).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 60)
      .map((k) => ({ id: k.id, type: k.type, text: k.text, date: k.date, project_id: k.project || null })),
  };
}

const running = new Set();
export async function reanalyzeInboxItem(c, iid) {
  const key = inboxKey(c.uid, c.tid, iid);
  if (applying.has(key)) fail(409, 'This item is already being saved. Try again in a moment.');
  applying.add(key);
  try {
    const item = await store.getInboxItem(c.uid, c.tid, iid) || fail(404, 'Item not found');
    if (item.type === 'routed') fail(400, 'This item has no source to analyze');
    if (running.has(key)) return item;
    if (!item.appliedAt && item.status !== 'done' && item.proposals.some((p) => p.appliedKind)) fail(409, 'Finish saving this item first.');
    Object.assign(item, { status: 'processing', error: null, errorMsg: null });
    await store.saveInboxItem(c.uid, c.tid, item);
    runAnalysis(c, iid).catch((error) => console.error('[analyze] Failed to persist analysis:', error.name));
    return item;
  } finally { applying.delete(key); }
}

export async function runAnalysis(c, iid) {
  const key = inboxKey(c.uid, c.tid, iid);
  if (running.has(key)) return;
  running.add(key);
  try {
    await transcribeItem(c, iid);
    const item = await store.getInboxItem(c.uid, c.tid, iid);
    if (!item) return;
    if (!aiConfigured()) {
      Object.assign(item, { status: 'review', error: 'AI analysis is not configured. Add proposals manually, or configure a provider and run the analysis again.', errorMsg: null });
      return await store.saveInboxItem(c.uid, c.tid, item);
    }
    const context = await analysisContext(c, item);
    const text = await store.getInboxSource(c.uid, c.tid, iid);
    const out = await analyze({ text, title: item.title, type: item.type, pdf: Boolean(item.file), date: item.date, uploader: { id: c.uid, name: c.me.name }, context });
    const fresh = await store.getInboxItem(c.uid, c.tid, iid); if (!fresh) return;
    const applied = (fresh.proposals || []).filter((p) => p.appliedKind);
    Object.assign(fresh, { status: 'review', error: null, errorMsg: null, summary: out.summary || [], participants: out.participants || [],
      proposals: [...applied, ...toProposals(c, out, context, text)], analyzedAt: store.now() });
    await store.saveInboxItem(c.uid, c.tid, fresh);
  } catch (e) {
    console.error('[analyze]', e);
    const fresh = await store.getInboxItem(c.uid, c.tid, iid);
    if (fresh) {
      const m = e.$metadata ? msg('S3 storage is temporarily unavailable.') : errorMessage(e);
      Object.assign(fresh, { status: 'failed', error: render('en', m), errorMsg: m });
      await store.saveInboxItem(c.uid, c.tid, fresh);
    }
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
  const taskKey = (title, owner) => `${owner || ''}\n${str(title, 300).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()}`;
  const appliedTaskIds = new Set(context.applied_tasks?.map((t) => t.id));
  const seenTasks = new Set(context.applied_tasks?.map((t) => taskKey(t.title, t.owner)));
  for (const x of out.commitments || []) {
    let owner = who(x.owner_member_id, x.owner_external_name, c.uid), requester = who(x.requester_member_id, x.requester_external_name, c.uid);
    const key = taskKey(x.title, owner);
    if (!str(x.title) || !str(x.evidence_quote) || appliedTaskIds.has(x.duplicate_of_task_id) || seenTasks.has(key)) continue;
    seenTasks.add(key);
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
    const h = hyp.get(x.hypothesis_id);
    const project = prj.has(x.project_id) ? x.project_id : h && prj.has(h.project_id) ? h.project_id : null;
    const hypothesis = h && (!project || h.project_id === project) ? h.id : null;
    P.push({ id: pid(), kind: 'kn', on: x.confidence === 'high', ...evidence, quote, type: KN_TYPES.includes(x.type) ? x.type : 'fact', text, why: str(x.why, 2000), scope: c.team.kind === 'personal' ? 'private' : x.scope === 'private' ? 'private' : 'team', project, hypothesis, conflict, conflictNote: conflict ? str(x.conflict_note, 500) || null : null, visionConflict: str(x.vision_conflict, 500) || null, res: conflict ? 'replace' : null });
  }
  for (const x of out.new_projects || []) P.push({ id: pid(), kind: 'project', on: false, ...ev(x), name: str(x.name, 120), vision: str(x.vision, 2000) });
  for (const x of out.new_hypotheses || []) P.push({ id: pid(), kind: 'hyp', on: false, ...ev(x), project: prj.has(x.project_id) ? x.project_id : null, if: str(x.if, 1000), then: str(x.then, 1000), because: str(x.because, 1000), metric: str(x.metric, 300), owner: x.owner_member_id && mem.has(x.owner_member_id) ? x.owner_member_id : c.uid });
  return P.filter((p) => p.quote);
}

const PROP_KEYS = ['id', 'kind', 'on', 'quote', 'ts', 'conf', 'title', 'owner', 'requester', 'due', 'project', 'hypothesis', 'important', 'dup', 'merge', 'task', 'to', 'type', 'text', 'why', 'scope', 'conflict', 'conflictNote', 'visionConflict', 'res', 'name', 'vision', 'if', 'then', 'because', 'metric', 'from', 'manual'];
function sanitizeProposals(ps) {
  const used = new Set();
  return ps.slice(0, 300).filter((p) => p && ['task', 'status', 'kn', 'project', 'hyp'].includes(p.kind)).map((p) => {
    const o = pick(p, PROP_KEYS);
    o.id = typeof o.id === 'string' && /^[\w-]{1,80}$/.test(o.id) && !used.has(o.id) ? o.id : store.newId('pr');
    used.add(o.id);
    o.on = Boolean(o.on);
    for (const k of ['title', 'text', 'why', 'name', 'vision', 'if', 'then', 'because', 'metric', 'quote', 'conflictNote', 'visionConflict']) if (o[k] != null) o[k] = str(o[k], 2000);
    return o;
  });
}

/* ---------- apply reviewed proposals ---------- */

export async function applyProposals(c, item) {
  const n = { task: 0, merged: 0, status: 0, routed: 0, kn: 0, project: 0, hyp: 0, skipped: 0 };
  const notified = new Set(), notes = [];
  const src = item.proposals.some((p) => p.on || p.appliedKind) ? await ensureSource(c, item) : null;
  const sourceOf = (p) => ({ itemId: item.id, itemTitle: item.title, owner: c.uid, ts: p.ts || null, quote: p.quote || '', ...(src ? { sourceId: src.id } : {}) });
  const idFor = (type, p) => `${type}_${crypto.createHash('sha256').update(JSON.stringify([c.uid, c.tid, item.id, p.id])).digest('hex').slice(0, 32)}`;
  const saved = async (p, id, kind) => {
    p.applied = id;
    p.appliedKind = kind;
    n[kind]++;
    await store.saveInboxItem(c.uid, c.tid, item);
  };
  const createdProjects = new Map();
  for (const p of item.proposals.filter((p) => p.appliedKind)) {
    n[p.appliedKind]++;
    if (p.kind === 'project') createdProjects.set(p.id, p.applied);
  }
  for (const p of item.proposals.filter((x) => x.on && x.kind === 'project')) {
    if (p.appliedKind) continue;
    if (!c.admin) { n.skipped++; notes.push(msg('Project “{name}” was not created: the Admin role is required', { name: p.name })); continue; }
    const id = idFor('p', p);
    if (!await store.projects.get(c.tid, id)) await createProject(c, { name: p.name, vision: p.vision || '' }, { id, source: sourceOf(p) });
    createdProjects.set(p.id, id); await saved(p, id, 'project');
  }
  for (const p of item.proposals.filter((x) => x.on && x.kind !== 'project')) {
    if (p.appliedKind) continue;
    try {
      if (p.kind === 'task') {
        const dup = p.dup && p.merge ? await store.findTask(c.tid, p.dup, c.uid) : null;
        if (dup && canSeeTask(c, dup)) {
          const reviewId = idFor('review', p);
          if (!dup.history.some((change) => change.reviewId === reviewId)) {
            hist(dup, c.uid, p.quote ? msg('Mentioned again in “{title}”: “{quote}”', { title: item.title, quote: p.quote.slice(0, 160) }) : msg('Mentioned again in “{title}”', { title: item.title }), item.title);
            dup.history.at(-1).reviewId = reviewId;
            await store.saveTask(c.tid, dup);
          }
          await saved(p, dup.id, 'merged');
        } else {
          const t = await createTask(c, p, { id: idFor('t', p), source: sourceOf(p), history: msg('Created from “{title}”, confirmed by {name}', { title: item.title, name: c.me.name }) });
          await saved(p, t.id, 'task');
          if (t.owner !== c.uid && !isExternal(t.owner)) notified.add(await nameOf(t.owner));
          if (t.requester !== c.uid && !isExternal(t.requester)) notified.add(await nameOf(t.requester));
        }
      } else if (p.kind === 'status') {
        const t = await store.findTask(c.tid, p.task, c.uid);
        if (!t || !canSeeTask(c, t) || !TASK_ST.includes(p.to)) { n.skipped++; continue; }
        if (canEditTask(c, t)) {
          await updateTask(c, t, { status: p.to }, msg('from “{title}”, confirmed by {name}', { title: item.title, name: c.me.name }), idFor('review', p));
          await saved(p, t.id, 'status');
        } else {
          await routeStatusProposal(c, item, p, t, idFor('i', p));
          await saved(p, t.id, 'routed'); notified.add(await nameOf(controller(t)));
        }
      } else if (p.kind === 'kn') {
        const k = await createKnowledge(c, { ...p, date: item.date }, { id: idFor('k', p), source: `${item.title}${p.ts ? ' · ' + p.ts : ''}`, sourceItem: item.id, sourceId: src?.id, quote: p.quote });
        if (p.conflict && p.res === 'replace') {
          const old = await store.findKnowledge(c.tid, p.conflict, c.uid);
          if (old && old.scope === k.scope && canSeeKn(c, old) && (canEditKn(c, old) || old.scope === 'team')) {
            if (old.supersededBy !== k.id) { old.supersededBy = k.id; await store.saveKnowledge(c.tid, old); }
            if (k.supersedes !== old.id) { k.supersedes = old.id; await store.saveKnowledge(c.tid, k); }
          }
        }
        await saved(p, k.id, 'kn');
      } else if (p.kind === 'hyp') {
        const project = createdProjects.get(p.project) || await validProject(c, p.project);
        if (!project) { n.skipped++; notes.push(msg('A hypothesis without a project was skipped — choose a project')); continue; }
        const id = idFor('h', p);
        if (!await store.hypotheses.get(c.tid, id)) {
          await createHypothesis(c, { project, if: p.if, then: p.then, because: p.because, metric: p.metric || '', owner: p.owner || c.uid }, { id, source: sourceOf(p) });
        }
        await saved(p, id, 'hyp');
      }
    } catch (e) {
      if (e instanceof HttpError) { n.skipped++; notes.push(e.i18n); } else throw e;
    }
  }
  if (src) await recordDerived(c, src, item);
  const lines = [['task', 'newCommitment'], ['merged', 'merged'], ['status', 'statusUpdated'], ['routed', 'routed'], ['kn', 'knowledgeSaved'], ['project', 'project'], ['hyp', 'draftHypothesis'], ['skipped', 'skipped']]
    .filter(([k]) => n[k]).map(([k, plural]) => ({ plural, n: n[k] }));
  return { lines, notified: [...notified], notes };
}

/* ================= sources ================= */
// When an inbox item is applied, its original is kept in the knowledge base as a source,
// and every task, knowledge entry, hypothesis and project created from it points back to it (sourceId).

export const keepsSource = (item) => INBOX_TYPES.includes(item.type);
export const SOURCE_SCOPES = ['team', 'private'];
const sourceScope = (c, item) => (c.team.kind === 'personal' || item.sourceScope === 'private' ? 'private' : 'team');

async function ensureSource(c, item) {
  if (!keepsSource(item)) return null;
  const id = `s_${crypto.createHash('sha256').update(JSON.stringify([c.uid, c.tid, item.id])).digest('hex').slice(0, 32)}`;
  const existing = await store.findSource(c.tid, id, c.uid);
  if (existing) return existing;
  const text = await store.getInboxSource(c.uid, c.tid, item.id);
  const file = item.file ? await store.getInboxFile(c.uid, c.tid, item.id) : null;
  const audio = item.audio ? await store.getInboxAudio(c.uid, c.tid, item.id) : null;
  const src = {
    id, kind: file ? 'pdf' : audio ? 'voice' : item.type, title: item.title, date: item.date, origin: item.origin,
    author: c.uid, scope: sourceScope(c, item), inboxItem: item.id,
    file: file ? { name: item.file.name, size: file.length, pages: item.file.pages || null } : null,
    audio: audio ? { mime: item.audio.mime, size: audio.length, duration: item.audio.duration || 0, transcript: item.audio.transcript } : null,
    chars: text.length, summary: item.summary || [], derived: [], createdAt: store.now(),
  };
  if (audio) await store.saveSourceAudio(c.tid, src, audio);
  await store.saveSource(c.tid, src, { text, file: file || undefined });
  item.sourceId = id;
  await store.saveInboxItem(c.uid, c.tid, item);
  return src;
}

const DERIVED_KIND = { task: 'task', merged: 'task', status: 'task', routed: 'task', kn: 'knowledge', hyp: 'hypothesis', project: 'project' };
async function recordDerived(c, src, item) {
  const fresh = await store.findSource(c.tid, src.id, c.uid) || src;
  const have = new Set((fresh.derived ||= []).map((d) => `${d.kind}:${d.id}`));
  let changed = false;
  for (const p of item.proposals.filter((x) => x.appliedKind && DERIVED_KIND[x.appliedKind])) {
    const d = { kind: DERIVED_KIND[p.appliedKind], id: p.applied };
    if (have.has(`${d.kind}:${d.id}`)) continue;
    have.add(`${d.kind}:${d.id}`); fresh.derived.push(d); changed = true;
  }
  if (changed) await store.saveSource(c.tid, fresh);
}

export const listSources = (c) => store.listSourcesFor(c.tid, c.uid);
export async function* assistantDocuments(c) {
  const [sources, inbox] = await Promise.all([listSources(c), store.listInbox(c.uid, c.tid)]);
  const savedItems = new Set(sources.filter((s) => s.author === c.uid).map((s) => s.inboxItem));
  const pending = inbox.filter((i) => keepsSource(i) && i.owner === c.uid && !i.sourceId && !savedItems.has(i.id)
    && ['processing', 'review', 'partial', 'failed'].includes(i.status));
  const documents = [
    ...sources.map((s) => ({ record: s, kind: 'source', read: () => store.getSourceText(c.tid, s) })),
    ...pending.map((i) => ({ record: i, kind: 'inbox', read: () => store.getInboxSource(c.uid, c.tid, i.id) })),
  ];
  for (let i = 0; i < documents.length; i += 6) {
    yield* await Promise.all(documents.slice(i, i + 6).map(async ({ record, kind, read }) => ({
      id: record.id, kind, title: record.title, date: record.date, pdf: Boolean(record.file), text: await read(),
    })));
  }
}
export async function getSource(c, sid) {
  return await store.findSource(c.tid, store.assertId(sid, 'source id'), c.uid) || fail(404, 'Source not found');
}
export async function getSourceWithText(c, sid) {
  const src = await getSource(c, sid);
  return { ...src, text: await store.getSourceText(c.tid, src) };
}
export async function getSourceFile(c, sid) {
  const src = await getSource(c, sid);
  const buf = src.file ? await store.getSourceFile(c.tid, src) : null;
  return buf ? { src, buf } : fail(404, 'The source has no file');
}
export async function getSourceAudio(c, sid) {
  const src = await getSource(c, sid);
  const buf = src.audio ? await store.getSourceAudio(c.tid, src) : null;
  return buf ? { mime: src.audio.mime, buf } : fail(404, 'The source has no recording');
}
export const canDeleteSource = (c, s) => s.author === c.uid || (c.admin && s.scope === 'team');
export async function deleteSource(c, sid) {
  const src = await getSource(c, sid);
  if (!canDeleteSource(c, src)) fail(403, 'The author or Owner/Admin can delete');
  await store.removeSource(c.tid, src);
}

// A status change for someone else's task goes to that person's inbox (spec §5.2).
async function routeStatusProposal(c, item, p, t, id) {
  const to = controller(t);
  if (!isMember(c.team, to) || await store.getInboxItem(to, c.tid, id)) return;
  const lang = (await store.getUser(to))?.lang || 'en'; // written in the recipient's language
  const status = st(p.to), name = c.me.name;
  const routed = {
    id, owner: to, type: 'routed', title: tr(lang, '{name}: update on “{title}”', { name, title: t.title }), date: item.date,
    origin: tr(lang, 'From {name} · from “{title}”', { name, title: item.title }), status: 'review',
    summary: [tr(lang, '{name} proposes changing the status of “{title}” to “{status}”.', { name, title: t.title, status })],
    participants: [], proposals: [{ ...p, id: store.newId('pr'), on: true }], error: null, createdAt: store.now(), routedFrom: c.uid,
  };
  await store.saveInboxItem(to, c.tid, routed, `${tr(lang, '{name} proposes: “{title}” → {status}', { name, title: t.title, status })}\n\n${tr(lang, 'Quote from “{title}”{ts}:', { title: item.title, ts: p.ts ? ` (${p.ts})` : '' })}\n\n> ${p.quote}`);
}
