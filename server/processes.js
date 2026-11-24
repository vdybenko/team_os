// Processes and agreements: living team documents with versions (docs/02-processes-and-agreements-vision.md).
//
// A process describes how we do the work. It belongs to a level (hypothesis, project, team or organization);
// anyone who sees it proposes changes (amendments), and the owner of the level accepts them into a new version.
// An agreement records what the parties agreed on. A new version comes into force only once every party
// has accepted that exact text; until then the previous version stays in force.
// TeamOS Advocate reviews both: a checklist of what is missing, risks and alternatives. It never changes a document.
//
// Domain exports are used only inside functions: domain.js imports this module too.

import * as store from './store.js';
import * as D from './domain.js';
import { tr } from './i18n.js';
import { aiConfigured, adviseDocument, errorMessage } from './ai.js';

export const PROC_LEVELS = ['hypothesis', 'project', 'team', 'org'];
export const PROC_VIS = ['owner', 'owner_admin', 'all'];
export const SECTIONS = ['purpose', 'trigger', 'roles', 'inputs', 'steps', 'output', 'metric', 'exceptions', 'review'];
const TARGETS = [...SECTIONS, 'summary'];
export const AMEND_KINDS = ['extend', 'replace', 'add', 'remove'];
export const AGR_TYPES = ['partnership', 'roles', 'team_rules', 'other'];
const MAX_STEPS = 40, MAX_CLAUSES = 50, MAX_TEXT = 3000;

const emptySections = () => ({ purpose: '', trigger: '', roles: '', inputs: '', steps: [], output: '', metric: '', exceptions: '', review: '' });
const uniq = (xs) => [...new Set(xs)];

/* ================= processes ================= */

// Everything the access rules need, loaded once per request.
export async function procEnv(c) {
  const [projects, hyps, org] = await Promise.all([
    store.projects.list(c.tid), store.hypotheses.list(c.tid),
    c.team.orgId && c.team.kind !== 'personal' ? store.getOrg(c.team.orgId) : null,
  ]);
  return { org, orgRole: D.orgRole(org, c.uid), projects: new Map(projects.map((p) => [p.id, p])), hyps: new Map(hyps.map((h) => [h.id, h])) };
}
const projectOf = (env, p) => (p.level === 'project' ? env.projects.get(p.project) : p.level === 'hypothesis' ? env.projects.get(env.hyps.get(p.hypothesis)?.project) : null);
const teamAdmins = (team) => team.members.filter((m) => ['owner', 'admin'].includes(m.role)).map((m) => m.userId);

export function canSeeProcess(c, env, p) {
  if (p.level === 'org') {
    if (!env.org || p.orgId !== env.org.id) return false;
    return p.visibility === 'all' || (p.visibility === 'owner_admin' ? Boolean(env.orgRole) : env.orgRole === 'owner');
  }
  if (p.teamId && p.teamId !== c.tid) return false;
  if (p.level === 'team') return true;
  const pr = projectOf(env, p);
  return c.admin || (pr && (pr.owner === c.uid || (pr.members || []).includes(c.uid)));
}
// Primary approvers get the "waiting for me" badge. When the owner of a hypothesis or project is no longer
// on the team, the team Owner/Admin approve until a new owner is set.
export function approversOf(c, env, p) {
  if (p.level === 'org') return p.visibility === 'owner' ? env.org?.owners || [] : uniq([...(env.org?.owners || []), ...(env.org?.admins || [])]);
  if (p.level === 'team') return teamAdmins(c.team);
  const owner = p.level === 'hypothesis' ? env.hyps.get(p.hypothesis)?.owner : env.projects.get(p.project)?.owner;
  return owner && D.isMember(c.team, owner) ? [owner] : teamAdmins(c.team);
}
// Team Owner/Admin can always approve changes to a process of a lower level.
export const canApproveProcess = (c, env, p) => approversOf(c, env, p).includes(c.uid) || (['hypothesis', 'project'].includes(p.level) && c.admin);
const pendingOf = (p) => p.amendments.filter((a) => a.status === 'pending');

async function readProcess(c, env, id) {
  store.assertId(id, 'process id');
  return await store.processes.get(c.tid, id) || (env.org ? await store.orgProcesses.get(env.org.id, id) : null);
}
const saveProcess = (c, p) => (p.level === 'org' ? store.orgProcesses.save(p.orgId, p) : store.processes.save(c.tid, p));

export async function listProcesses(c, env) {
  env ||= await procEnv(c);
  const all = [...(env.org ? await store.orgProcesses.list(env.org.id) : []), ...await store.processes.list(c.tid)];
  return all.filter((p) => canSeeProcess(c, env, p));
}
async function processFor(c, id) {
  const env = await procEnv(c);
  const p = await readProcess(c, env, id);
  if (!p || !canSeeProcess(c, env, p)) D.fail(404, 'Process not found');
  return { p, env };
}
export async function getProcess(c, id) { return (await processFor(c, id)).p; }

function stepsInput(raw, old = []) {
  const known = new Map(old.map((s) => [s.id, s]));
  return (Array.isArray(raw) ? raw : []).slice(0, MAX_STEPS).map((s) => {
    const text = D.str(typeof s === 'string' ? s : s?.text, MAX_TEXT);
    if (!text) return null;
    const prev = typeof s === 'object' && known.get(s?.id);
    return { id: prev?.id || store.newId('st'), text, ...(prev?.source ? { source: prev.source } : s?.source ? { source: sourceInput(s.source) } : {}) };
  }).filter(Boolean);
}
const sourceInput = (s) => (s && typeof s === 'object' ? Object.fromEntries(Object.entries({
  itemId: D.str(s.itemId, 80), itemTitle: D.str(s.itemTitle, 200), sourceId: D.str(s.sourceId, 80), knowledgeId: D.str(s.knowledgeId, 80),
  quote: D.str(s.quote, 1000), ts: D.str(s.ts, 20), by: D.str(s.by, 80),
}).filter(([, v]) => v)) : null);
function sectionsInput(raw, old = emptySections()) {
  const out = structuredClone(old);
  if (!raw || typeof raw !== 'object') return out;
  for (const k of SECTIONS) {
    if (raw[k] === undefined) continue;
    out[k] = k === 'steps' ? stepsInput(raw[k], old.steps) : D.str(raw[k], MAX_TEXT);
  }
  return out;
}
function snapshot(p, by, note, amendments = []) {
  return { n: p.version, at: store.now(), by, note, title: p.title, summary: p.summary, sections: structuredClone(p.sections), amendments };
}
function activate(p, by, note) {
  p.status = 'active';
  p.version = 1;
  p.versions.push(snapshot(p, by, note));
}

export async function createProcess(c, body, extra = {}) {
  const env = await procEnv(c);
  const level = PROC_LEVELS.includes(body.level) ? body.level : D.fail(400, 'Choose the level of the process');
  const title = D.str(body.title, 200) || D.fail(400, 'Name the process');
  const p = {
    id: extra.id || store.newId('pc'), level, project: null, hypothesis: null, orgId: null, teamId: level === 'org' ? null : c.tid, visibility: null,
    title, summary: D.str(body.summary, 2000), sections: sectionsInput(body.sections), status: 'draft', version: 0, versions: [], amendments: [],
    advocate: null, dismissed: null, fromKnowledge: extra.fromKnowledge || [], source: extra.source || null, creator: c.uid, createdAt: store.now(),
  };
  if (level === 'hypothesis') {
    const h = env.hyps.get(String(body.hypothesis || '')) || D.fail(400, 'Choose a hypothesis');
    Object.assign(p, { hypothesis: h.id, project: h.project });
  } else if (level === 'project') {
    p.project = (env.projects.get(String(body.project || '')) || D.fail(400, 'Choose a project')).id;
  } else if (level === 'org') {
    if (!env.org) D.fail(400, 'This workspace is not part of an organization');
    p.orgId = env.org.id;
    p.visibility = PROC_VIS.includes(body.visibility) ? body.visibility : 'all';
  }
  if (!canSeeProcess(c, env, p)) D.fail(403, 'You can’t add a process on this level');
  if (extra.id) {
    const existing = await readProcess(c, env, p.id);
    if (existing) return existing;
  }
  if (!extra.draft && canApproveProcess(c, env, p)) activate(p, c.uid, extra.note || 'created');
  await saveProcess(c, p);
  if (p.status === 'active') scheduleAdvocate(c, 'process', p.id);
  return p;
}

// Owner decisions: rename, set the visibility of an organization process, retire or reactivate.
export async function updateProcess(c, id, body) {
  const { p, env } = await processFor(c, id);
  if (!canApproveProcess(c, env, p)) D.fail(403, 'Only whoever approves changes to this process can do this');
  if (body.title !== undefined) p.title = D.str(body.title, 200) || p.title;
  if (body.visibility !== undefined && p.level === 'org') {
    if (!PROC_VIS.includes(body.visibility)) D.fail(400, 'Unknown visibility');
    p.visibility = body.visibility;
    if (!canSeeProcess(c, env, p)) D.fail(400, 'You would lose access to this process');
  }
  if (body.status !== undefined) {
    if (body.status === 'retired' && p.status !== 'retired') { p.retiredFrom = p.status; p.status = 'retired'; p.retiredAt = store.now(); p.retiredBy = c.uid; }
    else if (body.status === 'active' && p.status === 'retired') { p.status = p.version ? 'active' : 'draft'; delete p.retiredFrom; }
    else if (!['retired', 'active'].includes(body.status)) D.fail(400, 'Unknown status');
  }
  return saveProcess(c, p);
}
// A draft created by someone other than the owner takes effect once the owner approves it as v1.
export async function approveProcess(c, id) {
  const { p, env } = await processFor(c, id);
  if (!canApproveProcess(c, env, p)) D.fail(403, 'Only whoever approves changes to this process can do this');
  if (p.status !== 'draft') D.fail(400, 'The process is already approved');
  activate(p, c.uid, 'approved');
  await saveProcess(c, p);
  scheduleAdvocate(c, 'process', p.id);
  return p;
}

export async function proposeProcessChange(c, id, body, extra = {}) {
  const { p } = await processFor(c, id);
  if (p.status === 'retired') D.fail(400, 'The process is retired');
  if (extra.id && p.amendments.some((a) => a.id === extra.id)) return p;
  const kind = AMEND_KINDS.includes(body.kind) ? body.kind : D.fail(400, 'Choose what kind of change it is');
  const target = TARGETS.includes(body.target) ? body.target : D.fail(400, 'Choose the section the change is about');
  const a = {
    id: extra.id || store.newId('am'), kind, target, step: null, before: null, text: D.str(body.text, MAX_TEXT), note: D.str(body.note, 1000) || null,
    by: c.uid, at: store.now(), source: extra.source || null, advocate: Boolean(body.advocate || extra.advocate), status: 'pending',
    decidedBy: null, decidedAt: null, reason: null, version: null,
  };
  if (target === 'steps') {
    if (kind === 'add') a.before = p.sections.steps.some((s) => s.id === body.before) ? body.before : null;
    else a.step = p.sections.steps.find((s) => s.id === body.step)?.id || D.fail(400, 'Choose a step');
  }
  if (kind !== 'remove' && !a.text) D.fail(400, 'Describe the change');
  p.amendments.push(a);
  if (p.amendments.length > 500) p.amendments = [...p.amendments.filter((x) => x.status === 'pending'), ...p.amendments.filter((x) => x.status !== 'pending').slice(-300)];
  return saveProcess(c, p);
}

function applyAmendment(doc, a) {
  const s = doc.sections;
  const gone = () => D.fail(409, 'The step this change refers to is no longer in the process');
  if (a.target === 'steps') {
    const i = a.step ? s.steps.findIndex((x) => x.id === a.step) : -1;
    if (a.kind === 'add') {
      if (s.steps.length >= MAX_STEPS) D.fail(400, 'A process can have up to {n} steps', { n: MAX_STEPS });
      const step = { id: store.newId('st'), text: a.text, ...(a.source ? { source: a.source } : {}) };
      const at = a.before ? s.steps.findIndex((x) => x.id === a.before) : -1;
      if (at >= 0) s.steps.splice(at, 0, step); else s.steps.push(step);
    } else if (i < 0) gone();
    else if (a.kind === 'remove') s.steps.splice(i, 1);
    else if (a.kind === 'extend') s.steps[i] = { ...s.steps[i], text: `${s.steps[i].text} ${a.text}`.slice(0, MAX_TEXT) };
    else s.steps[i] = { ...s.steps[i], text: a.text, ...(a.source ? { source: a.source } : {}) };
    return;
  }
  const holder = a.target === 'summary' ? doc : s;
  if (a.kind === 'remove') holder[a.target] = '';
  else if (a.kind === 'extend' && holder[a.target]) holder[a.target] = `${holder[a.target]} ${a.text}`.slice(0, MAX_TEXT);
  else holder[a.target] = a.text;
}

// Several accepted changes make one new version. edits = { amendmentId: text } for "edit and accept".
export async function acceptProcessChanges(c, id, ids, edits = {}) {
  const { p, env } = await processFor(c, id);
  if (!canApproveProcess(c, env, p)) D.fail(403, 'Only whoever approves changes to this process can do this');
  if (p.status !== 'active') D.fail(400, p.status === 'draft' ? 'Approve the draft process first' : 'The process is retired');
  const list = uniq(Array.isArray(ids) ? ids : [ids]).map((x) => p.amendments.find((a) => a.id === x && a.status === 'pending') || D.fail(404, 'The change was not found or has already been decided'));
  if (!list.length) D.fail(400, 'Choose the changes to accept');
  const doc = { summary: p.summary, sections: structuredClone(p.sections) };
  for (const a of list) {
    if (edits && typeof edits[a.id] === 'string' && D.str(edits[a.id], MAX_TEXT) !== a.text) { a.proposedText = a.text; a.text = D.str(edits[a.id], MAX_TEXT); }
    applyAmendment(doc, a);
  }
  p.summary = doc.summary;
  p.sections = doc.sections;
  p.version += 1;
  const at = store.now();
  for (const a of list) Object.assign(a, { status: 'accepted', decidedBy: c.uid, decidedAt: at, version: p.version });
  p.versions.push(snapshot(p, c.uid, 'changes', list.map((a) => a.id)));
  if (p.versions.length > 200) p.versions = p.versions.slice(-200);
  await saveProcess(c, p);
  scheduleAdvocate(c, 'process', p.id);
  return p;
}
export async function rejectProcessChange(c, id, aid, reason) {
  const { p, env } = await processFor(c, id);
  if (!canApproveProcess(c, env, p)) D.fail(403, 'Only whoever approves changes to this process can do this');
  const a = p.amendments.find((x) => x.id === aid && x.status === 'pending') || D.fail(404, 'The change was not found or has already been decided');
  Object.assign(a, { status: 'rejected', decidedBy: c.uid, decidedAt: store.now(), reason: D.str(reason, 1000) || null });
  return saveProcess(c, p);
}
// The author takes back a change that has not been decided yet.
export async function withdrawProcessChange(c, id, aid) {
  const { p } = await processFor(c, id);
  const a = p.amendments.find((x) => x.id === aid && x.status === 'pending') || D.fail(404, 'The change was not found or has already been decided');
  if (a.by !== c.uid) D.fail(403, 'Only the author can withdraw a change');
  p.amendments = p.amendments.filter((x) => x !== a);
  return saveProcess(c, p);
}
// A draft that never became active can be deleted by its author or the approver.
export async function deleteProcess(c, id) {
  const { p, env } = await processFor(c, id);
  if (p.version) D.fail(400, 'An approved process is kept in the history. Retire it instead.');
  if (p.creator !== c.uid && !canApproveProcess(c, env, p)) D.fail(403, 'No permission');
  if (p.level === 'org') await store.orgProcesses.remove(p.orgId, p);
  else await store.processes.remove(c.tid, p);
}

export const processCoverage = (p) => SECTIONS.filter((k) => (k === 'steps' ? p.sections.steps.length > 0 : Boolean(p.sections[k]))).length;

export function processView(c, env, p, names = {}) {
  const approvers = approversOf(c, env, p);
  const pending = pendingOf(p).length;
  const mine = approvers.includes(c.uid);
  return {
    ...p, approvers, approverNames: Object.fromEntries(approvers.map((id) => [id, names[id] || null])),
    canApprove: canApproveProcess(c, env, p), canPropose: p.status !== 'retired', pending,
    needsMe: mine && p.status !== 'retired' ? pending + (p.status === 'draft' ? 1 : 0) : 0,
    coverage: processCoverage(p), dismissedNow: p.dismissed?.version === p.version ? p.dismissed.keys : [],
  };
}
export async function processViews(c) {
  const env = await procEnv(c);
  const list = await listProcesses(c, env);
  const ids = uniq(list.flatMap((p) => approversOf(c, env, p)).filter((id) => !D.isMember(c.team, id)));
  const names = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, (await store.getUser(id))?.name || null])));
  return list.map((p) => processView(c, env, p, names));
}

/* ---------- collecting knowledge entries of type "process" into one document ---------- */
export async function collectProcess(c, body, extra = {}) {
  const ids = uniq(Array.isArray(body.knowledge) ? body.knowledge : []).slice(0, MAX_STEPS);
  if (!ids.length) D.fail(400, 'Choose the knowledge entries to collect');
  const entries = [];
  for (const kid of ids) {
    const k = await store.findKnowledge(c.tid, store.assertId(kid, 'knowledge id'), c.uid);
    if (!k || !D.canSeeKn(c, k)) D.fail(404, 'Knowledge entry not found');
    if (k.scope === 'private' && c.team.kind !== 'personal') D.fail(400, 'Private knowledge can’t become part of a shared process');
    entries.push(k);
  }
  const steps = entries.map((k) => ({ text: k.text, source: { knowledgeId: k.id, itemTitle: k.source && k.source !== 'Added manually' ? k.source : '', quote: k.quote || '', sourceId: k.sourceId || '' } }));
  return createProcess(c, { ...body, sections: { ...(body.sections || {}), steps } }, { ...extra, fromKnowledge: entries.map((k) => k.id), note: 'collected' });
}

/* ================= agreements ================= */

const agrParties = (a) => a.current?.parties || a.parties;
export const agreementViewers = (a) => uniq([...agrParties(a), ...(a.pending?.parties || [])]);
export const canSeeAgreement = (c, a) => agreementViewers(a).includes(c.uid);
// Who must accept the pending version: everyone in the version in force and in the new one,
// except members who have left the team. An external person stays a party (their consent is recorded by a member).
export const requiredParties = (team, a) => (a.pending ? uniq([...(a.current?.parties || []), ...a.pending.parties]).filter((p) => D.isExternal(p) || D.isMember(team, p)) : []);
export function agreementStatus(a) {
  if (a.terminatedAt) return 'terminated';
  if (a.reviewReason) return 'needs_review';
  if (a.pending) return 'pending';
  return a.current ? 'in_force' : 'draft';
}
const consentOf = (a, party) => a.pending?.consents.find((x) => x.party === party);
export const agreementNeedsMe = (c, a) => !a.terminatedAt && ((requiredParties(c.team, a).includes(c.uid) && !consentOf(a, c.uid)) || (a.reviewReason && !a.pending?.review && agreementViewers(a).includes(c.uid)));

function partiesInput(c, raw) {
  const out = [];
  for (const v of Array.isArray(raw) ? raw : []) {
    if (typeof v !== 'string') continue;
    if (D.isExternal(v)) { const n = D.str(v.slice(4), 120); if (n) out.push(`ext:${n}`); continue; }
    if (!D.isMember(c.team, v)) D.fail(400, '{field}: this person is not on the team', { field: { $t: 'Party' } });
    out.push(v);
  }
  return uniq(out).slice(0, 30);
}
function clausesInput(raw, base = []) {
  const known = new Map(base.map((x) => [x.id, x]));
  const out = (Array.isArray(raw) ? raw : []).slice(0, MAX_CLAUSES).map((x) => {
    const title = D.str(x?.title, 200), text = D.str(x?.text, MAX_TEXT);
    if (!text) return null;
    const prev = known.get(x?.id);
    return { id: prev?.id || store.newId('cl'), title: title || prev?.title || '', text, ...(x?.source ? { source: sourceInput(x.source) } : prev?.source && prev.text === text ? { source: prev.source } : {}) };
  }).filter(Boolean);
  if (!out.length) D.fail(400, 'Add at least one clause');
  return out;
}
async function agreementFor(c, id) {
  const a = await store.agreements.get(c.tid, store.assertId(id, 'agreement id'));
  if (!a || !canSeeAgreement(c, a)) D.fail(404, 'Agreement not found');
  return a;
}
export const getAgreement = agreementFor;
export async function listAgreements(c) { return (await store.agreements.list(c.tid)).filter((a) => canSeeAgreement(c, a)); }
const log = (a, by, kind, extra = {}) => { (a.history ||= []).push({ at: store.now(), by, kind, ...extra }); if (a.history.length > 300) a.history = a.history.slice(-300); };

export async function createAgreement(c, body, extra = {}) {
  const type = AGR_TYPES.includes(body.type) ? body.type : 'other';
  const title = D.str(body.title, 200) || D.fail(400, 'Name the agreement');
  const parties = uniq([c.uid, ...partiesInput(c, body.parties)]);
  if (parties.length < 2) D.fail(400, 'An agreement needs at least two parties');
  if (extra.id) {
    const existing = await store.agreements.get(c.tid, extra.id);
    if (existing) return existing;
  }
  const at = store.now();
  const a = {
    id: extra.id || store.newId('ag'), type, title, parties, current: null,
    pending: { n: 1, clauses: clausesInput(body.clauses), parties, by: c.uid, at, note: D.str(body.note, 500) || null, consents: [{ party: c.uid, decision: 'accept', at }], source: extra.source || null, terminate: false, review: false },
    versions: [], reviewReason: null, terminatedAt: null, advocate: null, dismissed: null, creator: c.uid, createdAt: at, history: [],
  };
  log(a, c.uid, 'proposed', { n: 1 });
  await store.agreements.save(c.tid, a);
  scheduleAdvocate(c, 'agreement', a.id);
  return a;
}

// A new version on approval: the whole text (clauses), or one clause ({ clause: { id | null, title, text } }; empty text removes it),
// optionally a new list of parties, or terminate: true. Any change resets the consents already given:
// people agree to an exact text. The author accepts their own version.
export async function proposeAgreementChange(c, id, body, extra = {}) {
  const a = await agreementFor(c, id);
  if (a.terminatedAt) D.fail(400, 'The agreement has been terminated');
  if (extra.reviewId && (a.history || []).some((h) => h.reviewId === extra.reviewId)) return a;
  if (!agreementViewers(a).includes(c.uid)) D.fail(403, 'Only the parties can change the agreement');
  const base = a.pending || a.current;
  let clauses;
  if (body.clause) {
    const cl = body.clause;
    const text = D.str(cl.text, MAX_TEXT);
    const list = structuredClone(base.clauses);
    const i = cl.id ? list.findIndex((x) => x.id === cl.id) : -1;
    if (cl.id && i < 0) D.fail(404, 'Clause not found');
    if (i >= 0 && !text) list.splice(i, 1);
    else if (i >= 0) list[i] = { ...list[i], title: D.str(cl.title, 200) || list[i].title, text, ...(extra.source ? { source: extra.source } : {}) };
    else if (text) list.push({ id: store.newId('cl'), title: D.str(cl.title, 200), text, ...(extra.source ? { source: extra.source } : {}) });
    else D.fail(400, 'Write the text of the clause');
    clauses = clausesInput(list, base.clauses);
  } else if (body.clauses) clauses = clausesInput(body.clauses, base.clauses);
  else clauses = structuredClone(base.clauses);
  const parties = body.parties !== undefined ? partiesInput(c, body.parties) : base.parties.filter((p) => D.isExternal(p) || D.isMember(c.team, p));
  if (parties.length < 2) D.fail(400, 'An agreement needs at least two parties');
  const changed = body.terminate || JSON.stringify(clauses.map((x) => [x.title, x.text])) !== JSON.stringify(base.clauses.map((x) => [x.title, x.text])) || JSON.stringify([...parties].sort()) !== JSON.stringify([...base.parties].sort());
  if (!changed && !(a.reviewReason && !a.pending?.review)) D.fail(400, 'Nothing has changed');
  const at = store.now();
  const counterTo = a.pending && a.pending.by !== c.uid ? a.pending.by : null;
  a.pending = {
    n: (a.current?.n || 0) + 1, clauses, parties, by: c.uid, at, note: D.str(body.note, 500) || a.pending?.note || null, consents: [],
    source: extra.source || (a.pending && !body.clause && !body.clauses ? a.pending.source : null) || null, terminate: Boolean(body.terminate), review: Boolean(a.reviewReason), counterTo,
  };
  if (requiredParties(c.team, a).includes(c.uid)) a.pending.consents.push({ party: c.uid, decision: 'accept', at });
  log(a, c.uid, counterTo ? 'counter' : body.terminate ? 'terminate' : a.reviewReason ? 'review' : 'proposed', { n: a.pending.n, ...(extra.reviewId ? { reviewId: extra.reviewId } : {}) });
  finalizeIfAccepted(c, a);
  await store.agreements.save(c.tid, a);
  if (!a.pending) scheduleAdvocate(c, 'agreement', a.id);
  return a;
}

function finalizeIfAccepted(c, a) {
  if (!a.pending || (a.reviewReason && !a.pending.review)) return false;
  const required = requiredParties(c.team, a);
  if (!required.length || !required.every((p) => consentOf(a, p)?.decision === 'accept')) return false;
  const at = store.now();
  if (a.current) a.versions.unshift(structuredClone(a.current));
  const { n, clauses, parties, by, note, source, terminate, consents } = a.pending;
  a.current = { n, clauses, parties, by, note, source, at, consents: consents.filter((x) => x.decision === 'accept' && required.includes(x.party)), terminate: terminate || undefined };
  a.parties = parties;
  a.pending = null;
  a.reviewReason = null;
  if (terminate) a.terminatedAt = at;
  log(a, null, terminate ? 'terminated' : 'in_force', { n });
  return true;
}

export async function respondToAgreement(c, id, body) {
  const a = await agreementFor(c, id);
  if (!a.pending) D.fail(400, 'There is no version waiting for consent');
  if (!requiredParties(c.team, a).includes(c.uid)) D.fail(403, 'Only the parties of this version respond to it');
  const decision = ['accept', 'reject'].includes(body.decision) ? body.decision : D.fail(400, 'Choose: accept or reject');
  const note = D.str(body.note, 1000);
  if (decision === 'reject' && !note) D.fail(400, 'Write the reason — the other parties will see it');
  a.pending.consents = a.pending.consents.filter((x) => x.party !== c.uid);
  a.pending.consents.push({ party: c.uid, decision, at: store.now(), ...(note ? { note } : {}) });
  log(a, c.uid, decision === 'accept' ? 'accepted' : 'rejected', { n: a.pending.n, ...(note ? { note } : {}) });
  const done = finalizeIfAccepted(c, a);
  await store.agreements.save(c.tid, a);
  if (done) scheduleAdvocate(c, 'agreement', a.id);
  return a;
}
// An external party confirms outside TeamOS (email, call, signature); a member party records it.
export async function recordExternalConsent(c, id, body) {
  const a = await agreementFor(c, id);
  if (!a.pending) D.fail(400, 'There is no version waiting for consent');
  const required = requiredParties(c.team, a);
  if (!required.includes(c.uid)) D.fail(403, 'Only the parties of this version respond to it');
  const party = typeof body.party === 'string' && D.isExternal(body.party) && required.includes(body.party) ? body.party : D.fail(400, 'Choose an external party of this version');
  const note = D.str(body.note, 1000) || D.fail(400, 'Describe how the external party confirmed it');
  a.pending.consents = a.pending.consents.filter((x) => x.party !== party);
  a.pending.consents.push({ party, decision: 'accept', at: store.now(), note, recordedBy: c.uid });
  log(a, c.uid, 'external', { n: a.pending.n, party, note });
  const done = finalizeIfAccepted(c, a);
  await store.agreements.save(c.tid, a);
  if (done) scheduleAdvocate(c, 'agreement', a.id);
  return a;
}
// The author withdraws a version nobody else has accepted yet.
export async function withdrawAgreementVersion(c, id) {
  const a = await agreementFor(c, id);
  if (!a.pending || a.pending.by !== c.uid) D.fail(403, 'Only the author can withdraw this version');
  if (!a.current) D.fail(400, 'The first version can’t be withdrawn. Propose a different text instead.');
  log(a, c.uid, 'withdrawn', { n: a.pending.n });
  a.pending = null;
  return store.agreements.save(c.tid, a);
}

// A party leaves the team: the agreement needs a full review by everyone who remains (§4.3a).
export async function markPartyLeft(team, uid) {
  const name = (await store.getUser(uid))?.name || null;
  for (const a of await store.agreements.list(team.id)) {
    if (a.terminatedAt || !agreementViewers(a).includes(uid)) continue;
    a.reviewReason = { kind: 'party_left', party: uid, name, at: store.now() };
    log(a, null, 'party_left', { party: uid, name });
    await store.agreements.save(team.id, a);
  }
}

/* ---------- advocate checklists for agreements ---------- */
// [key, label, pattern over clause titles and texts (English and Ukrainian), suggested clause { title, text }]
const CHECKLISTS = {
  partnership: [
    ['contributions', 'Contributions of each party and how they are measured', /внес|contribut|invest|вклад/i],
    ['equity', 'Split of shares', /част(к|о)|share|equity|%/i],
    ['equity_change', 'How the shares change', /(змін|перегляд)\w* част|share\w* (change|review)|(change|review)\w* (of )?share/i, ['Changing the shares', 'Once a year the partners review the shares against agreed criteria: time, money and results.']],
    ['vesting', 'Vesting and cliff', /вест|vest|cliff/i, ['Vesting', 'Each partner’s share vests monthly over 4 years, with a 1-year cliff.']],
    ['roles', 'Roles and areas of responsibility', /рол|відповідальн|role|responsib/i],
    ['decisions', 'How decisions are made', /рішен|голос|decision|vot/i],
    ['deadlock', 'What happens in a deadlock', /дедлок|deadlock|tie/i, ['Deadlock', 'If the votes are split evenly, an outside adviser chosen by the partners in advance decides.']],
    ['exit', 'A partner leaves (good / bad leaver)', /вихід|виход|leaver|exit|leav/i, ['A partner leaves', 'A good leaver keeps the vested share, a bad leaver keeps it only at nominal value. The other partners buy back the rest.']],
    ['dilution', 'Dilution when raising investment', /розмит|dilut|інвестиц|investment/i, ['Dilution', 'When raising investment, all partners’ shares are diluted proportionally.']],
    ['ip', 'Intellectual property', /інтелект|ip\b|intellectual|власніст/i, ['Intellectual property', 'Everything created for the company belongs to the company, not to individual partners.']],
    ['confidentiality', 'Confidentiality and non-compete', /конфіден|неконкур|confidential|non-?compete/i, ['Confidentiality', 'Partners keep internal information confidential and do not start a competing product while they take part and for 12 months after leaving.']],
    ['disputes', 'How disputes are resolved', /спор|dispute|медіац|mediat/i, ['Disputes', 'Partners first discuss a dispute among themselves, then go to mediation.']],
    ['review', 'When we review the agreement', /перегляд|review/i, ['Reviewing the agreement', 'The partners review the agreement once a year or when the set of partners changes.']],
  ],
  team_rules: [
    ['communication', 'Communication and response time', /чат|відпов|комунікац|chat|respond|communicat|reply/i],
    ['tasks', 'Who sets and closes tasks', /задач|task/i],
    ['meetings', 'Regular meetings', /демо|зустр|мітинг|demo|meeting|sync/i],
    ['conflicts', 'How we resolve conflicts', /конфлікт|conflict/i, ['Conflicts', 'We first discuss a conflict one to one; if that doesn’t help, together with the team Owner.']],
    ['time_off', 'Time off and handing over work', /відпуст|vacation|time off|leave/i, ['Time off', 'Before time off, a person hands their open tasks over to a colleague.']],
    ['review', 'When we review the rules', /перегляд|review/i, ['Reviewing the rules', 'We review the rules once a quarter at the weekly planning.']],
  ],
  roles: [
    ['areas', 'Area of responsibility of each person', /./],
    ['backup', 'Who stands in', /підмін|заміщ|backup|stand in|cover/i, ['Standing in', 'If someone is away for more than 3 days, an agreed colleague takes over their tasks.']],
    ['handover', 'Handing over when someone leaves a role', /передач|handover|hand over/i, ['Handover', 'Whoever leaves a role hands over their work and access within a week.']],
    ['review', 'When we review the roles', /перегляд|review/i, ['Reviewing the roles', 'We review the roles every six months or when the team changes.']],
  ],
  other: [
    ['scope', 'Scope of the work', /обсяг|scope|deliver/i],
    ['payment', 'Payment or exchange of value', /оплат|плат|pay|fee|price/i, ['Payment', 'Describe what each side receives and when.']],
    ['rights', 'Rights to the result', /прав|rights|ownership|ip\b/i, ['Rights', 'The results of the work belong to the client.']],
    ['term', 'Term and termination', /строк|припин|термін|term|terminat/i, ['Term and termination', 'The agreement is in force until either side terminates it with 30 days’ notice.']],
    ['review', 'When we review it', /перегляд|review/i, ['Review', 'We review the terms once a quarter.']],
  ],
};
export function agreementChecklist(a, lang = 'en') {
  const v = a.pending || a.current;
  const text = (v?.clauses || []).map((x) => `${x.title}\n${x.text}`);
  return (CHECKLISTS[a.type] || CHECKLISTS.other).map(([key, label, re, sug]) => ({
    key, label: tr(lang, label), ok: text.some((t) => re.test(t)),
    ...(sug ? { suggestion: { title: tr(lang, sug[0]), text: tr(lang, sug[1]) } } : {}),
  }));
}

export function agreementView(c, a) {
  const required = requiredParties(c.team, a);
  const checklist = agreementChecklist(a, c.lang);
  const v = a.pending || a.current;
  return {
    ...a, status: agreementStatus(a), required, needsMe: agreementNeedsMe(c, a), myConsent: consentOf(a, c.uid) || null,
    canPropose: !a.terminatedAt, checklist, coverage: checklist.filter((x) => x.ok).length, checkedVersion: v?.n || 0,
    dismissedNow: a.dismissed?.version === (v?.n || 0) ? a.dismissed.keys : [],
  };
}
export async function agreementViews(c) { return (await listAgreements(c)).map((a) => agreementView(c, a)); }

/* ================= TeamOS Advocate ================= */

const advRunning = new Set();
function docText(kind, d) {
  if (kind === 'process') {
    return { title: d.title, level: d.level, summary: d.summary, version: d.version, sections: { ...d.sections, steps: d.sections.steps.map((s, i) => `${i + 1}. ${s.text}`) } };
  }
  const v = d.pending || d.current;
  return { title: d.title, type: d.type, version: v?.n || 0, parties: (v?.parties || []).length, clauses: (v?.clauses || []).map((x) => ({ title: x.title, text: x.text })) };
}
async function loadDoc(c, kind, id) {
  if (kind === 'process') { const { p } = await processFor(c, id); return p; }
  return agreementFor(c, id);
}
const saveDoc = (c, kind, d) => (kind === 'process' ? saveProcess(c, d) : store.agreements.save(c.tid, d));
const docVersion = (kind, d) => (kind === 'process' ? d.version : (d.pending || d.current)?.n || 0);

export async function runAdvocate(c, kind, id) {
  const d = await loadDoc(c, kind, id);
  if (!aiConfigured()) D.fail(503, 'AI is not configured: the advocate shows the checklist only');
  const key = `${c.tid}/${kind}/${id}`;
  if (advRunning.has(key)) D.fail(409, 'The advocate is already reviewing this document');
  advRunning.add(key);
  try {
    const gaps = kind === 'process' ? SECTIONS.filter((k) => (k === 'steps' ? !d.sections.steps.length : !d.sections[k])) : agreementChecklist(d).filter((x) => !x.ok).map((x) => x.key);
    const related = kind === 'process' ? (await listProcesses(c)).filter((x) => x.id !== d.id && x.status === 'active').slice(0, 30).map((x) => ({ title: x.title, level: x.level, summary: x.summary })) : [];
    let out;
    try {
      out = await adviseDocument({ kind, document: docText(kind, d), gaps, related, vision: (await store.getVision(c.tid)).slice(0, 4000) });
    } catch (e) { D.failWith(502, errorMessage(e)); }
    const fresh = await loadDoc(c, kind, id);
    fresh.advocate = {
      version: docVersion(kind, fresh), at: store.now(), by: c.uid,
      suggestions: Object.fromEntries((out.gaps || []).filter((g) => gaps.includes(g.key) && D.str(g.suggestion)).map((g) => [g.key, D.str(g.suggestion, 1500)])),
      risks: (out.risks || []).map((r) => D.str(r, 600)).filter(Boolean).slice(0, 6),
      alternatives: (out.alternatives || []).map((x) => ({ title: D.str(x.title, 200), pros: D.str(x.pros, 400), cons: D.str(x.cons, 400) })).filter((x) => x.title).slice(0, 3),
    };
    return saveDoc(c, kind, fresh);
  } finally { advRunning.delete(key); }
}
// Each new version gets a review automatically, in the background.
export function scheduleAdvocate(c, kind, id) {
  if (!aiConfigured() || process.env.TEAMOS_ADVOCATE_AUTO === '0') return;
  setImmediate(() => runAdvocate(c, kind, id).catch((e) => { if (e.status !== 409) console.error('[advocate]', e.message); }));
}
// "We deliberately don't do this": the advice is hidden for this version.
export async function dismissAdvice(c, kind, id, key) {
  const d = await loadDoc(c, kind, id);
  const k = D.str(key, 60) || D.fail(400, 'Choose the advice to dismiss');
  const version = docVersion(kind, d);
  if (d.dismissed?.version !== version) d.dismissed = { version, keys: [] };
  if (!d.dismissed.keys.includes(k)) d.dismissed.keys.push(k);
  return saveDoc(c, kind, d);
}

/* ================= inbox context ================= */
// What the analyzer sees: active processes and agreements visible to whoever uploaded the source.
export async function analysisContext(c) {
  const env = await procEnv(c);
  const [procs, agrs] = await Promise.all([listProcesses(c, env), listAgreements(c)]);
  return {
    processes: procs.filter((p) => p.status !== 'retired').slice(0, 60).map((p) => ({
      id: p.id, title: p.title, level: p.level, project_id: p.project, hypothesis_id: p.hypothesis, summary: p.summary.slice(0, 300),
      sections: Object.fromEntries(SECTIONS.filter((k) => k !== 'steps' && p.sections[k]).map((k) => [k, p.sections[k].slice(0, 200)])),
      steps: p.sections.steps.map((s) => ({ id: s.id, text: s.text.slice(0, 200) })),
    })),
    agreements: agrs.filter((a) => !a.terminatedAt).slice(0, 30).map((a) => ({
      id: a.id, title: a.title, type: a.type, clauses: (a.pending || a.current).clauses.map((x) => ({ id: x.id, title: x.title, text: x.text.slice(0, 300) })),
    })),
  };
}
