// TeamOS MCP server — Streamable HTTP transport at POST /mcp (stateless, JSON responses).
//
// Authorization: OAuth 2.1 Bearer tokens from server/oauth.js. Each connection (grant) carries
//   - scope: read ⊂ write ⊂ manage — which tools the app may call;
//   - teams: null (all of the user's workspaces) or a list of team ids.
// Every tool runs through server/domain.js with the user's member context, so the app can see
// and change exactly what the user can in the TeamOS UI (requester-only task status, private
// knowledge, personal inbox, Owner/Admin-only team management).

import * as store from './store.js';
import * as D from './domain.js';
import * as Docs from './processes.js';
import { authenticate, challenge, RESOURCE } from './oauth.js';
import { origin } from './auth.js';
import { render, msg, tr, LANGS } from './i18n.js';

const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER = { name: 'teamos', title: 'TeamOS', version: '0.3.0' };
const INSTRUCTIONS = `TeamOS is the user's team second brain: tasks (commitments between people), knowledge (decisions, agreements, facts, processes, context), projects with goals, hypotheses and a personal inbox, organised by workspace (a personal space and teams).
Start with list_workspaces to get team ids; most tools take team_id (optional when the connection is limited to one workspace).
People are referenced by member id (from list_members / get_workspace_overview) or "ext:Name" for someone outside the team.
Task rules: the requester (who set the task) changes its status and fields; the owner (who does it) can only comment. "I owe" = tasks where I am the owner; "owed to me" = tasks I requested from others.
Processes (how we work, on the hypothesis / project / team / organization level) and agreements (what the parties agreed on) are versioned documents: anyone proposes a change; the owner of the process level accepts it, and an agreement version comes into force only when every party accepts it.
Raw meeting transcripts, emails and notes go to add_to_inbox: TeamOS extracts proposals that the user confirms in Review. Use create_task / add_knowledge for items the user has already confirmed.
Dates are YYYY-MM-DD.`;

/* ---------------- schema helpers ---------------- */

const S = {
  str: (description, extra = {}) => ({ type: 'string', description, ...extra }),
  date: (description) => ({ type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: `${description} (YYYY-MM-DD)` }),
  bool: (description) => ({ type: 'boolean', description }),
  int: (description, min, max) => ({ type: 'integer', minimum: min, maximum: max, description }),
  enum: (values, description) => ({ type: 'string', enum: values, description }),
  person: (description) => ({ type: 'string', description: `${description}: a member id, or "ext:Name" for an external person` }),
  team: { type: 'string', description: 'Workspace (team) id from list_workspaces. Optional when the connection is limited to one workspace.' },
};
const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });

/* ---------------- session & context ---------------- */

async function allowedTeams(s) {
  const teams = await store.teamsOfUser(s.user.id);
  return s.grant.teams ? teams.filter((t) => s.grant.teams.includes(t.id)) : teams;
}
async function teamCtx(s, args) {
  let tid = args.team_id;
  if (!tid) {
    const teams = await allowedTeams(s);
    if (teams.length === 1) tid = teams[0].id;
    else D.fail(400, 'Choose a workspace: pass team_id. Available: {list}', { list: teams.map((t) => `${t.id} (${t.kind === 'personal' ? 'Personal' : t.name})`).join(', ') });
  }
  if (typeof tid !== 'string') D.fail(400, 'Team not found');
  if (s.grant.teams && !s.grant.teams.includes(tid)) D.fail(403, 'This connection has no access to this workspace');
  const c = await D.ctxFor(s.user, store.assertId(tid, 'team id'), s.lang);
  c.names = new Map((await D.memberList(c.team)).map((m) => [m.id, m.name]));
  c.goalList = await D.listGoals(c);
  return c;
}
const refreshGoals = async (c) => { c.goalList = await store.goals.list(c.tid); };
const who = (c, id) => (!id ? null : D.isExternal(id) ? { external: id.slice(4) } : c.names.has(id) ? { id, name: c.names.get(id) } : { id, name: 'Deleted user', deleted: true });
const ACTIVE = ['open', 'progress', 'waiting'];
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)));

function taskOut(c, t, full = false) {
  const out = clean({
    id: t.id, title: t.title, status: t.status, owner: who(c, t.owner), requester: who(c, t.requester), due: t.due,
    overdue: t.due && t.due < D.today() && ACTIVE.includes(t.status) ? true : undefined, important: t.important || undefined,
    project_id: t.project, hypothesis_id: t.hypothesis, you_can_edit: D.canEditTask(c, t), comments: t.comments.length || undefined,
    description: full ? t.description : t.description?.slice(0, 280),
  });
  if (full) {
    out.comments = t.comments.map((x) => ({ by: who(c, x.author), at: x.at, text: x.text }));
    out.history = t.history.map((h) => clean({ at: h.at, by: who(c, h.by), text: h.msg ? render(c.lang, h.msg) : h.text, source: h.source }));
    if (t.source) out.source = clean({ inbox_item: t.source.itemTitle, quote: t.source.quote });
    out.created_at = t.createdAt;
  }
  return out;
}
const knOut = (c, k) => clean({ id: k.id, type: k.type, text: k.text, why: k.why, scope: k.scope, project_id: k.project, date: k.date, author: who(c, k.author), source: k.source, quote: k.quote, replaces: k.supersedes, superseded_by: k.supersededBy, you_can_edit: D.canEditKn(c, k) });
const projectOut = (c, p) => clean({ id: p.id, name: p.name, status: p.status, owner: who(c, p.owner), vision: p.vision, members: (p.members || []).map((m) => who(c, m)), goals: (c.goalList || []).filter((g) => g.level === 'project' && g.project === p.id).map((g) => clean(D.legacyGoalView(g))) });
const processOut = (c, p, full = false) => clean({
  id: p.id, title: p.title, level: p.level, project_id: p.project, hypothesis_id: p.hypothesis, visibility: p.visibility, status: p.status, version: p.version,
  summary: p.summary, approvers: (p.approvers || []).map((x) => who(c, x) || { id: x, name: p.approverNames?.[x] }), you_can_approve: p.canApprove,
  pending_changes: full ? undefined : p.pending, waiting_for_you: p.needsMe || undefined, completeness: `${p.coverage}/${Docs.SECTIONS.length}`,
  ...(full ? {
    sections: { ...Object.fromEntries(Docs.SECTIONS.filter((k) => k !== 'steps').map((k) => [k, p.sections[k]])), steps: p.sections.steps.map((x) => clean({ id: x.id, text: x.text, quote: x.source?.quote })) },
    changes: p.amendments.map((a) => clean({ id: a.id, kind: a.kind, section: a.target, step_id: a.step, before_step_id: a.before, text: a.text, status: a.status, by: who(c, a.by), at: a.at, quote: a.source?.quote, reason: a.reason, accepted_in_version: a.version })),
    versions: p.versions.map((v) => clean({ n: v.n, at: v.at, by: who(c, v.by), note: v.note, changes: v.amendments })),
    advocate: p.advocate ? clean({ checked_version: p.advocate.version, suggestions: p.advocate.suggestions, risks: p.advocate.risks, alternatives: p.advocate.alternatives }) : undefined,
  } : {}),
});
const agreementOut = (c, a, full = false) => {
  const clauses = (v) => v?.clauses.map((x) => clean({ id: x.id, title: x.title, text: x.text, quote: x.source?.quote }));
  return clean({
    id: a.id, title: a.title, type: a.type, status: a.status, parties: (a.current?.parties || a.parties).map((x) => who(c, x)), version_in_force: a.current?.n,
    waiting_for_you: a.needsMe || undefined, review_reason: a.reviewReason ? clean({ party_left: who(c, a.reviewReason.party) || a.reviewReason.name, at: a.reviewReason.at }) : undefined,
    pending: a.pending ? clean({
      version: a.pending.n, by: who(c, a.pending.by), note: a.pending.note, terminate: a.pending.terminate || undefined, parties: a.pending.parties.map((x) => who(c, x)),
      required: a.required.map((x) => who(c, x)), consents: a.pending.consents.map((x) => clean({ party: who(c, x.party), decision: x.decision, note: x.note, at: x.at })),
      clauses: full ? clauses(a.pending) : undefined,
    }) : undefined,
    ...(full ? {
      clauses_in_force: clauses(a.current), terminated_at: a.terminatedAt,
      history: a.versions.map((v) => clean({ version: v.n, in_force_from: v.at, consents: v.consents.map((x) => who(c, x.party)) })),
      advocate_checklist: a.checklist.map((x) => clean({ item: x.label, covered: x.ok, suggestion: x.ok ? undefined : x.suggestion })),
      advocate: a.advocate ? clean({ checked_version: a.advocate.version, suggestions: a.advocate.suggestions, risks: a.advocate.risks, alternatives: a.advocate.alternatives }) : undefined,
    } : {}),
  });
};
const findView = async (list, id, what) => (await list).find((x) => x.id === id) || D.fail(404, what);
const krOut = (c, k) => clean({ id: k.id, title: k.title, unit: k.unit, start: k.start, current: k.current, target: k.target, progress: Math.round(D.krProgress(k) * 100) / 100, owner: who(c, k.owner), confidence: k.confidence, note: k.note, last_checkin: k.checkins?.at(-1)?.at });
const goalOut = (c, g) => clean({
  id: g.id, level: g.level, period: g.period, type: g.type, status: g.status, title: g.title, description: g.description, owner: who(c, g.owner),
  project_id: g.project, member: g.member ? who(c, g.member) : undefined, progress: Math.round(D.goalProgress(g) * 100) / 100,
  contributes_to: (g.alignedTo || []).map((a) => a.krId), unaligned_reason: g.unaligned?.reason, score: g.score, retro: g.retro,
  key_results: (g.keyResults || []).map((k) => krOut(c, k)),
});
const hypOut = (c, h) => clean({ id: h.id, project_id: h.project, statement: h.statement, if: h.if, then: h.then, because: h.because, status: h.status, owner: who(c, h.owner), metric: h.metric, target: h.target, current: h.current, from: h.from, to: h.to, verdict: h.verdict,
  moves_key_result: h.kr, expected_impact: h.expectedImpact, success_criteria: h.successCriteria, kill_criteria: h.killCriteria, priority: h.priority ? { ...h.priority, score: D.hypScore(h) } : undefined, learnings: (h.learnings || []).map((l) => ({ at: l.at, by: who(c, l.by), text: l.text })), you_can_edit: D.canEditHyp(c, h) });
const inboxOut = (c, i) => clean({ id: i.id, title: i.title, type: i.type, date: i.date, status: i.status, origin: i.origin, summary: i.summary, result: D.inboxView(c.lang, i).result, error: i.error ? D.inboxView(c.lang, i).error : undefined, proposals: D.countProps(i.proposals) });
const joinLink = (inv) => `${origin}/join/${inv.token}`;
const tokens = (q) => String(q || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);
function score(words, ...fields) {
  const hay = fields.filter(Boolean).join(' \n ').toLowerCase();
  let n = 0;
  for (const w of words) if (hay.includes(w)) n++;
  return words.length ? n / words.length : 0;
}
const provenance = (s) => `${s.grant.clientName || 'MCP'} (MCP)`;

/* ---------------- tools ---------------- */

const RO = { readOnlyHint: true, openWorldHint: false };
const W = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const DEL = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

const TOOLS = [
  /* ---- read ---- */
  {
    name: 'list_workspaces', title: 'List workspaces', scope: 'read', annotations: RO,
    description: 'Lists the workspaces (personal space and teams) this connection can reach, with your role in each.',
    inputSchema: obj({}),
    async run(s) {
      return (await allowedTeams(s)).map((t) => ({ team_id: t.id, name: t.kind === 'personal' ? tr(s.lang, 'Personal') : t.name, kind: t.kind, role: t.members.find((m) => m.userId === s.user.id)?.role, members: t.members.length }));
    },
  },
  {
    name: 'get_workspace_overview', title: 'Workspace overview', scope: 'read', annotations: RO,
    description: 'Overview of one workspace: members, team vision, projects with goals, hypotheses, and counts of your tasks, knowledge and inbox items.',
    inputSchema: obj({ team_id: S.team }),
    async run(s, a) {
      const c = await teamCtx(s, a);
      const [tasks, knowledge, projects, hypotheses, inbox, vision] = await Promise.all([D.visibleTasks(c), D.visibleKnowledge(c), store.projects.list(c.tid), store.hypotheses.list(c.tid), store.listInbox(c.uid, c.tid), store.getVision(c.tid)]);
      const active = tasks.filter((t) => ACTIVE.includes(t.status));
      return {
        team: { id: c.tid, name: c.team.name, kind: c.team.kind, your_role: c.role, you: { id: c.uid, name: s.user.name } },
        members: c.team.members.map((m) => ({ id: m.userId, name: c.names.get(m.userId), role: m.role })),
        vision: vision.length > 6000 ? vision.slice(0, 6000) + '\n…' : vision,
        projects: projects.map((p) => projectOut(c, p)),
        hypotheses: hypotheses.map((h) => clean({ id: h.id, project_id: h.project, statement: h.statement, status: h.status, priority_score: D.hypScore(h), moves_key_result: h.kr })),
        goals_this_quarter: c.goalList.filter((g) => g.status !== 'cancelled' && (g.period === D.currentQuarter() || g.period === D.currentQuarter().slice(0, 4)) && g.level !== 'member').map((g) => goalOut(c, g)),
        counts: {
          tasks_i_owe: active.filter((t) => t.owner === c.uid).length,
          tasks_owed_to_me: active.filter((t) => t.requester === c.uid && t.owner !== c.uid).length,
          overdue: active.filter((t) => t.due && t.due < D.today() && (t.owner === c.uid || t.requester === c.uid)).length,
          knowledge: knowledge.filter((k) => !k.supersededBy).length,
          inbox_waiting_review: inbox.filter((i) => ['review', 'partial'].includes(i.status)).length,
        },
      };
    },
  },
  {
    name: 'search', title: 'Search the knowledge base', scope: 'read', annotations: RO,
    description: 'Keyword search across tasks, knowledge, projects (with goals) and hypotheses. Searches all reachable workspaces unless team_id is given.',
    inputSchema: obj({
      query: S.str('Words to look for'), team_id: S.team,
      types: { type: 'array', items: { type: 'string', enum: ['task', 'knowledge', 'project', 'hypothesis'] }, description: 'Limit to these record types' },
      limit: S.int('Maximum results (default 25)', 1, 100),
    }, ['query']),
    async run(s, a) {
      const words = tokens(a.query);
      if (!words.length) D.fail(400, 'Write what to search for');
      const types = new Set(a.types?.length ? a.types : ['task', 'knowledge', 'project', 'hypothesis']);
      const teams = a.team_id ? [{ id: a.team_id }] : await allowedTeams(s);
      const hits = [];
      for (const t of teams) {
        const c = await teamCtx(s, { team_id: t.id });
        const add = (type, sc, item) => { if (sc > 0) hits.push({ score: sc, type, team_id: c.tid, team: c.team.kind === 'personal' ? tr(s.lang, 'Personal') : c.team.name, ...item }); };
        if (types.has('task')) for (const x of await D.visibleTasks(c)) add('task', score(words, x.title, x.description, ...x.comments.map((m) => m.text)), taskOut(c, x));
        if (types.has('knowledge')) for (const k of await D.visibleKnowledge(c)) add('knowledge', score(words, k.text, k.why, k.quote) * (k.supersededBy ? 0.5 : 1), knOut(c, k));
        if (types.has('project')) for (const p of await store.projects.list(c.tid)) add('project', score(words, p.name, p.vision, ...(p.goals || []).map((g) => `${g.goal} ${g.metric}`)), projectOut(c, p));
        if (types.has('hypothesis')) for (const h of await store.hypotheses.list(c.tid)) add('hypothesis', score(words, h.statement, h.metric, h.verdict, ...(h.learnings || []).map((l) => l.text)), { id: h.id, project_id: h.project, statement: h.statement, status: h.status });
      }
      hits.sort((x, y) => y.score - x.score);
      return hits.slice(0, a.limit || 25).map(({ score: sc, ...h }) => ({ match: Math.round(sc * 100) / 100, ...h }));
    },
  },
  {
    name: 'list_tasks', title: 'List tasks', scope: 'read', annotations: RO,
    description: 'Lists tasks you can see in a workspace. relation: "i_owe" (you are the owner), "owed_to_me" (you requested it from someone else), "all". By default only active tasks (open, in progress, waiting).',
    inputSchema: obj({
      team_id: S.team, relation: S.enum(['i_owe', 'owed_to_me', 'all'], 'Default: all'),
      status: { type: 'array', items: { type: 'string', enum: D.TASK_ST }, description: 'Statuses to include. Default: open, progress, waiting' },
      person: S.person('Only tasks where this person is the owner or the requester'),
      project_id: S.str('Only tasks of this project'), due_before: S.date('Only tasks due on or before this date'),
      query: S.str('Words that must appear in the title or description'), limit: S.int('Maximum results (default 100)', 1, 500),
    }),
    async run(s, a) {
      const c = await teamCtx(s, a);
      const statuses = a.status?.length ? a.status : ACTIVE;
      const words = tokens(a.query);
      let list = (await D.visibleTasks(c)).filter((t) => statuses.includes(t.status));
      if (a.relation === 'i_owe') list = list.filter((t) => t.owner === c.uid);
      if (a.relation === 'owed_to_me') list = list.filter((t) => t.requester === c.uid && t.owner !== c.uid);
      if (a.person) list = list.filter((t) => t.owner === a.person || t.requester === a.person);
      if (a.project_id) list = list.filter((t) => t.project === a.project_id);
      if (a.due_before) list = list.filter((t) => t.due && t.due <= a.due_before);
      if (words.length) list = list.filter((t) => score(words, t.title, t.description) === 1);
      list.sort((x, y) => (x.due || '9999').localeCompare(y.due || '9999') || (y.important - x.important));
      return { total: list.length, tasks: list.slice(0, a.limit || 100).map((t) => taskOut(c, t)) };
    },
  },
  {
    name: 'get_task', title: 'Get a task', scope: 'read', annotations: RO,
    description: 'A task with its full description, comments, history and source quote.',
    inputSchema: obj({ team_id: S.team, task_id: S.str('Task id') }, ['task_id']),
    async run(s, a) { const c = await teamCtx(s, a); return taskOut(c, await D.getTaskFor(c, a.task_id), true); },
  },
  {
    name: 'list_knowledge', title: 'List knowledge', scope: 'read', annotations: RO,
    description: 'Knowledge entries (decisions, agreements, facts, processes, context) you can see in a workspace, newest first. Superseded entries are hidden unless requested.',
    inputSchema: obj({
      team_id: S.team, type: S.enum(D.KN_TYPES, 'Only this type'), project_id: S.str('Only entries linked to this project'),
      query: S.str('Words that must appear'), include_superseded: S.bool('Also return entries replaced by newer ones'), limit: S.int('Maximum results (default 100)', 1, 500),
    }),
    async run(s, a) {
      const c = await teamCtx(s, a);
      const words = tokens(a.query);
      let list = await D.visibleKnowledge(c);
      if (!a.include_superseded) list = list.filter((k) => !k.supersededBy);
      if (a.type) list = list.filter((k) => k.type === a.type);
      if (a.project_id) list = list.filter((k) => k.project === a.project_id);
      if (words.length) list = list.filter((k) => score(words, k.text, k.why, k.quote) === 1);
      list.sort((x, y) => (y.date || '').localeCompare(x.date || ''));
      return { total: list.length, knowledge: list.slice(0, a.limit || 100).map((k) => knOut(c, k)) };
    },
  },
  {
    name: 'list_projects', title: 'List projects', scope: 'read', annotations: RO,
    description: 'Projects of a workspace with their status, vision, members and goals (goal, metric, target, current, by).',
    inputSchema: obj({ team_id: S.team, status: S.enum(D.PRJ_ST, 'Only this status') }),
    async run(s, a) {
      const c = await teamCtx(s, a);
      return (await store.projects.list(c.tid)).filter((p) => !a.status || p.status === a.status).map((p) => projectOut(c, p));
    },
  },
  {
    name: 'list_hypotheses', title: 'List hypotheses', scope: 'read', annotations: RO,
    description: 'Hypotheses ("If… then… because…") with status, metric, learnings and verdict.',
    inputSchema: obj({ team_id: S.team, project_id: S.str('Only this project'), status: S.enum(D.HYP_ST, 'Only this status') }),
    async run(s, a) {
      const c = await teamCtx(s, a);
      return (await store.hypotheses.list(c.tid)).filter((h) => (!a.project_id || h.project === a.project_id) && (!a.status || h.status === a.status)).map((h) => hypOut(c, h));
    },
  },
  {
    name: 'list_members', title: 'List members', scope: 'read', annotations: RO,
    description: 'Members of a workspace with ids and roles (owner, admin, member). Owners and Admins also see pending invites with join links.',
    inputSchema: obj({ team_id: S.team }),
    async run(s, a) {
      const c = await teamCtx(s, a);
      const members = (await D.memberList(c.team)).map((m) => clean({ id: m.id, name: m.name, email: m.email, role: m.role, aliases: m.aliases, joined_at: m.joinedAt }));
      return { your_role: c.role, members, ...(c.admin ? { invites: c.team.invites.map((i) => clean({ token: i.token, email: i.email, role: i.role, created_at: i.createdAt, join_link: joinLink(i) })) } : {}) };
    },
  },
  {
    name: 'list_inbox', title: 'List inbox', scope: 'read', annotations: RO,
    description: 'Your personal inbox in a workspace: added transcripts, emails and notes, their analysis status and how many proposals wait for review.',
    inputSchema: obj({ team_id: S.team, status: S.enum(['processing', 'review', 'partial', 'done', 'failed', 'ignored'], 'Only this status') }),
    async run(s, a) {
      const c = await teamCtx(s, a);
      return (await store.listInbox(c.uid, c.tid)).filter((i) => !a.status || i.status === a.status).map((i) => inboxOut(c, i));
    },
  },
  {
    name: 'get_inbox_item', title: 'Get an inbox item', scope: 'read', annotations: RO,
    description: 'An inbox item with its source text, summary and extracted proposals.',
    inputSchema: obj({ team_id: S.team, item_id: S.str('Inbox item id'), include_source: S.bool('Include the full source text (default true)') }, ['item_id']),
    async run(s, a) {
      const c = await teamCtx(s, a);
      const item = await store.getInboxItem(c.uid, c.tid, store.assertId(a.item_id, 'item id')) || D.fail(404, 'Item not found (the inbox is personal)');
      return { ...inboxOut(c, item), proposals: item.proposals.map((p) => clean({ ...p, on: undefined })), ...(a.include_source === false ? {} : { source: await store.getInboxSource(c.uid, c.tid, item.id) }) };
    },
  },

  /* ---- write ---- */
  {
    name: 'add_to_inbox', title: 'Add to inbox', scope: 'write', annotations: W,
    description: 'Adds a meeting transcript, email, chat, document or note to your inbox. TeamOS extracts tasks, status updates, knowledge, projects and hypotheses as proposals; you confirm them in TeamOS → Inbox → Review.',
    inputSchema: obj({
      team_id: S.team, text: S.str('The full text', { maxLength: 400000 }), title: S.str('Short title'),
      type: S.enum(D.INBOX_TYPES, 'Kind of source (default transcript)'), date: S.date('When it happened (default today)'),
    }, ['text']),
    async run(s, a) {
      const c = await teamCtx(s, a);
      const item = await D.addInboxItem(c, { ...a, origin: provenance(s) });
      return { ...inboxOut(c, item), review_url: `${origin}/` };
    },
  },
  {
    name: 'create_task', title: 'Create a task', scope: 'write', annotations: W,
    description: 'Creates a task (commitment). By default you are both the requester and the owner. Set owner_id to delegate to someone, or requester_id when someone asked you.',
    inputSchema: obj({
      team_id: S.team, title: S.str('What needs to be done'), description: S.str('Details'),
      owner_id: S.person('Who does it (default: you)'), requester_id: S.person('Who asked for it (default: you)'),
      due: S.date('Deadline'), important: S.bool('Important'), status: S.enum(D.TASK_ST, 'Initial status (default open)'),
      project_id: S.str('Project id'), hypothesis_id: S.str('Hypothesis id'),
    }, ['title']),
    async run(s, a) {
      const c = await teamCtx(s, a);
      const t = await D.createTask(c, { title: a.title, description: a.description, owner: a.owner_id, requester: a.requester_id, due: a.due, important: a.important, status: a.status, project: a.project_id, hypothesis: a.hypothesis_id }, { history: msg('Created via {app}', { app: provenance(s) }) });
      return taskOut(c, t, true);
    },
  },
  {
    name: 'update_task', title: 'Update a task', scope: 'write', annotations: W,
    description: 'Changes a task’s status or fields. Only the requester (who set the task) may do this; the owner should use comment_on_task instead. Pass only the fields to change; null clears due/project/hypothesis.',
    inputSchema: obj({
      team_id: S.team, task_id: S.str('Task id'), status: S.enum(D.TASK_ST, 'New status'), title: S.str('New title'), description: S.str('New description'),
      owner_id: S.person('New owner'), due: { type: ['string', 'null'], description: 'New deadline (YYYY-MM-DD) or null' }, important: S.bool('Important'),
      project_id: { type: ['string', 'null'], description: 'Project id or null' }, hypothesis_id: { type: ['string', 'null'], description: 'Hypothesis id or null' },
    }, ['task_id']),
    async run(s, a) {
      const c = await teamCtx(s, a);
      const t = await D.getTaskFor(c, a.task_id);
      const body = clean({ status: a.status, title: a.title, description: a.description, owner: a.owner_id, important: a.important });
      if (a.due !== undefined) body.due = a.due;
      if (a.project_id !== undefined) body.project = a.project_id;
      if (a.hypothesis_id !== undefined) body.hypothesis = a.hypothesis_id;
      return taskOut(c, await D.updateTask(c, t, body, msg('via {app}', { app: provenance(s) })), true);
    },
  },
  {
    name: 'comment_on_task', title: 'Comment on a task', scope: 'write', annotations: W,
    description: 'Adds a comment to a task. Owners use comments to report progress or propose changes to the requester.',
    inputSchema: obj({ team_id: S.team, task_id: S.str('Task id'), text: S.str('Comment') }, ['task_id', 'text']),
    async run(s, a) { const c = await teamCtx(s, a); return taskOut(c, await D.commentOnTask(c, a.task_id, a.text), true); },
  },
  {
    name: 'delete_task', title: 'Delete a task', scope: 'write', annotations: DEL,
    description: 'Permanently deletes a task. Only its requester can delete it. Prefer status "cancelled" unless the user asks to delete.',
    inputSchema: obj({ team_id: S.team, task_id: S.str('Task id') }, ['task_id']),
    async run(s, a) { const c = await teamCtx(s, a); await D.deleteTask(c, a.task_id); return { deleted: a.task_id }; },
  },
  {
    name: 'add_knowledge', title: 'Add knowledge', scope: 'write', annotations: W,
    description: 'Saves a knowledge entry: decision, agreement, fact, process or context. Use replaces_id when a new decision overrides an old one (the old entry is kept as superseded).',
    inputSchema: obj({
      team_id: S.team, type: S.enum(D.KN_TYPES, 'Kind (default fact)'), text: S.str('The knowledge itself, one clear statement', { maxLength: 1000 }), why: S.str('Reasoning or context'),
      scope: S.enum(['team', 'private'], 'team (default) or private — only you see it'), project_id: S.str('Project id'), date: S.date('When it was decided or learned (default today)'),
      replaces_id: S.str('Id of the knowledge entry this one replaces'),
    }, ['text']),
    async run(s, a) {
      const c = await teamCtx(s, a);
      const k = await D.createKnowledge(c, { type: a.type, text: a.text, why: a.why, scope: a.scope, project: a.project_id, date: a.date, supersedes: a.replaces_id }, { source: tr(c.lang, 'Added via {app}', { app: provenance(s) }) });
      return knOut(c, k);
    },
  },
  {
    name: 'update_knowledge', title: 'Update knowledge', scope: 'write', annotations: W,
    description: 'Edits a knowledge entry (its author, or Owner/Admin for team entries). Pass only fields to change.',
    inputSchema: obj({ team_id: S.team, knowledge_id: S.str('Knowledge id'), type: S.enum(D.KN_TYPES, 'Kind'), text: S.str('Text'), why: S.str('Reasoning'), scope: S.enum(['team', 'private'], 'Visibility'), project_id: { type: ['string', 'null'], description: 'Project id or null' } }, ['knowledge_id']),
    async run(s, a) {
      const c = await teamCtx(s, a);
      const body = clean({ type: a.type, text: a.text, why: a.why, scope: a.scope });
      if (a.project_id !== undefined) body.project = a.project_id;
      return knOut(c, await D.updateKnowledge(c, a.knowledge_id, body));
    },
  },
  {
    name: 'delete_knowledge', title: 'Delete knowledge', scope: 'write', annotations: DEL,
    description: 'Permanently deletes a knowledge entry (its author, or Owner/Admin for team entries). To record a changed decision, prefer add_knowledge with replaces_id.',
    inputSchema: obj({ team_id: S.team, knowledge_id: S.str('Knowledge id') }, ['knowledge_id']),
    async run(s, a) { const c = await teamCtx(s, a); await D.deleteKnowledge(c, a.knowledge_id); return { deleted: a.knowledge_id }; },
  },
  {
    name: 'create_project', title: 'Create a project', scope: 'write', annotations: W,
    description: 'Creates a project (Owner/Admin). Goals can be added now or later with save_goal.',
    inputSchema: obj({
      team_id: S.team, name: S.str('Project name'), vision: S.str('Vision / why the project exists'), owner_id: S.str('Project owner member id (default: you)'),
      status: S.enum(D.PRJ_ST, 'Default active'), member_ids: { type: 'array', items: { type: 'string' }, description: 'Member ids on the project' },
      goals: { type: 'array', items: obj({ goal: S.str('Goal'), metric: S.str('Metric'), target: S.str('Target value'), current: S.str('Current value'), by: S.date('Target date') }, ['goal']) },
    }, ['name']),
    async run(s, a) {
      const c = await teamCtx(s, a);
      const p = await D.createProject(c, clean({ name: a.name, vision: a.vision, owner: a.owner_id, status: a.status, members: a.member_ids ? [...new Set([c.uid, ...a.member_ids])] : undefined, goals: a.goals }));
      await refreshGoals(c);
      return projectOut(c, p);
    },
  },
  {
    name: 'update_project', title: 'Update a project', scope: 'write', annotations: W,
    description: 'Changes a project’s name, vision, status, owner or members (Owner/Admin). Use save_goal / remove_goal for goals.',
    inputSchema: obj({ team_id: S.team, project_id: S.str('Project id'), name: S.str('Name'), vision: S.str('Vision'), status: S.enum(D.PRJ_ST, 'Status'), owner_id: S.str('Owner member id'), member_ids: { type: 'array', items: { type: 'string' }, description: 'Full list of member ids' } }, ['project_id']),
    async run(s, a) {
      const c = await teamCtx(s, a);
      return projectOut(c, await D.updateProject(c, a.project_id, clean({ name: a.name, vision: a.vision, status: a.status, owner: a.owner_id, members: a.member_ids })));
    },
  },
  {
    name: 'save_goal', title: 'Add or change a goal', scope: 'write', annotations: W,
    description: 'Simple project goal with one key result (metric, current, target). Adds one, or updates it when goal_id is given (project Owner or team Owner/Admin). For full OKRs use list_goals and checkin_key_result.',
    inputSchema: obj({ team_id: S.team, project_id: S.str('Project id'), goal_id: S.str('Existing goal id to change'), goal: S.str('Goal'), metric: S.str('Metric'), target: S.str('Target value'), current: S.str('Current value'), by: S.date('Target date') }, ['project_id']),
    async run(s, a) {
      const c = await teamCtx(s, a);
      const { project, goal } = await D.saveGoal(c, a.project_id, { id: a.goal_id, goal: a.goal, metric: a.metric, target: a.target, current: a.current, by: a.by });
      await refreshGoals(c);
      return { goal: clean(goal), project: projectOut(c, project) };
    },
  },
  {
    name: 'remove_goal', title: 'Remove a goal', scope: 'write', annotations: DEL,
    description: 'Removes a goal from a project (Owner/Admin).',
    inputSchema: obj({ team_id: S.team, project_id: S.str('Project id'), goal_id: S.str('Goal id') }, ['project_id', 'goal_id']),
    async run(s, a) { const c = await teamCtx(s, a); const p = await D.removeGoal(c, a.project_id, a.goal_id); await refreshGoals(c); return projectOut(c, p); },
  },
  {
    name: 'list_goals', title: 'List goals (OKR)', scope: 'read', annotations: RO,
    description: 'Goals of a workspace on every level (team annual/quarterly, project, member) with key results, progress, confidence and alignment: contributes_to lists the parent key result ids. Hypotheses move key results (see moves_key_result in list_hypotheses).',
    inputSchema: obj({ team_id: S.team, period: S.str('Period: "2027" or "2027Q1" (default: all)'), level: S.enum(D.GOAL_LEVELS, 'Only this level') }),
    async run(s, a) {
      const c = await teamCtx(s, a);
      return c.goalList.filter((g) => (!a.period || g.period === a.period || g.period === String(a.period).slice(0, 4)) && (!a.level || g.level === a.level)).map((g) => goalOut(c, g));
    },
  },
  {
    name: 'checkin_key_result', title: 'Check in a key result', scope: 'write', annotations: W,
    description: 'Records a weekly check-in for a key result: its new value, confidence (on_track / at_risk / off_track) and a note. The key result owner or whoever edits the goal can do it.',
    inputSchema: obj({ team_id: S.team, goal_id: S.str('Goal id'), key_result_id: S.str('Key result id'), value: { type: 'number', description: 'New current value' }, confidence: S.enum(D.KR_CONF, 'Confidence'), note: S.str('What changed, what blocks') }, ['goal_id', 'key_result_id']),
    async run(s, a) { const c = await teamCtx(s, a); return goalOut(c, await D.checkinKr(c, a.goal_id, a.key_result_id, { value: a.value, confidence: a.confidence, note: a.note })); },
  },
  {
    name: 'set_hypothesis_priority', title: 'Set hypothesis priority', scope: 'write', annotations: W,
    description: 'Scores a hypothesis 1–10 on impact, confidence (by strength of evidence), speed (how soon the key result moves) and cost (team time and money). Priority = impact × confidence × speed ÷ ((cost_time + cost_money) / 2). Optionally links the project key result it moves and the expected contribution.',
    inputSchema: obj({
      team_id: S.team, hypothesis_id: S.str('Hypothesis id'), impact: { type: 'integer', minimum: 1, maximum: 10 }, confidence: { type: 'integer', minimum: 1, maximum: 10 }, speed: { type: 'integer', minimum: 1, maximum: 10 },
      cost_time: { type: 'integer', minimum: 1, maximum: 10 }, cost_money: { type: 'integer', minimum: 1, maximum: 10 }, key_result_id: S.str('Key result of a goal of the same project'), expected_impact: { type: 'number', description: 'Expected contribution to the key result' },
    }, ['hypothesis_id']),
    async run(s, a) {
      const c = await teamCtx(s, a);
      const priority = clean({ impact: a.impact, confidence: a.confidence, speed: a.speed, costTime: a.cost_time, costMoney: a.cost_money });
      return hypOut(c, await D.updateHypothesis(c, a.hypothesis_id, clean({ priority: Object.keys(priority).length ? priority : undefined, kr: a.key_result_id, expectedImpact: a.expected_impact })));
    },
  },
  {
    name: 'create_hypothesis', title: 'Create a hypothesis', scope: 'write', annotations: W,
    description: 'Creates a hypothesis "If <if>, then <then>, because <because>" in a project, as a draft by default.',
    inputSchema: obj({
      team_id: S.team, project_id: S.str('Project id'), if: S.str('If… (the change or action)'), then: S.str('then… (the expected result)'), because: S.str('because… (the reasoning)'),
      metric: S.str('How it is measured'), target: S.str('Target value'), current: S.str('Current value'), owner_id: S.str('Responsible member id (default: you)'),
      status: S.enum(D.HYP_ST, 'Default draft'), from: S.date('Test start'), to: S.date('Test end'),
    }, ['project_id', 'if', 'then']),
    async run(s, a) {
      const c = await teamCtx(s, a);
      return hypOut(c, await D.createHypothesis(c, clean({ project: a.project_id, if: a.if, then: a.then, because: a.because, metric: a.metric, target: a.target, current: a.current, owner: a.owner_id, status: a.status, from: a.from, to: a.to })));
    },
  },
  {
    name: 'update_hypothesis', title: 'Update a hypothesis', scope: 'write', annotations: W,
    description: 'Changes a hypothesis: status (draft → testing → validated / invalidated), current value, verdict, wording or dates. The responsible person or Owner/Admin can edit.',
    inputSchema: obj({
      team_id: S.team, hypothesis_id: S.str('Hypothesis id'), status: S.enum(D.HYP_ST, 'Status'), if: S.str('If…'), then: S.str('then…'), because: S.str('because…'),
      metric: S.str('Metric'), target: S.str('Target'), current: S.str('Current value'), verdict: S.str('Conclusion'), owner_id: S.str('Responsible member id'), from: S.date('Test start'), to: S.date('Test end'), project_id: S.str('Move to project'),
    }, ['hypothesis_id']),
    async run(s, a) {
      const c = await teamCtx(s, a);
      return hypOut(c, await D.updateHypothesis(c, a.hypothesis_id, clean({ status: a.status, if: a.if, then: a.then, because: a.because, metric: a.metric, target: a.target, current: a.current, verdict: a.verdict, owner: a.owner_id, from: a.from, to: a.to, project: a.project_id })));
    },
  },
  {
    name: 'add_hypothesis_learning', title: 'Add a learning', scope: 'write', annotations: W,
    description: 'Records a learning (what was observed) on a hypothesis.',
    inputSchema: obj({ team_id: S.team, hypothesis_id: S.str('Hypothesis id'), text: S.str('The learning') }, ['hypothesis_id', 'text']),
    async run(s, a) { const c = await teamCtx(s, a); return hypOut(c, await D.addLearning(c, a.hypothesis_id, a.text)); },
  },
  {
    name: 'update_team_vision', title: 'Update the team vision', scope: 'write', annotations: W,
    description: 'Replaces the Team vision document (Markdown) of a workspace (Owner/Admin). Read it first with get_workspace_overview and keep what should stay.',
    inputSchema: obj({ team_id: S.team, markdown: S.str('The full new vision in Markdown', { maxLength: 100000 }) }, ['markdown']),
    async run(s, a) { const c = await teamCtx(s, a); await D.saveVision(c, a.markdown); return { saved: true, team_id: c.tid }; },
  },

  /* ---- processes & agreements ---- */
  {
    name: 'list_processes', title: 'List processes', scope: 'read', annotations: RO,
    description: 'Processes you can see: how the team works on the hypothesis, project, team and organization level, with the version, who approves changes, pending changes and completeness by TeamOS Advocate.',
    inputSchema: obj({ team_id: S.team, level: S.enum(Docs.PROC_LEVELS, 'Only this level'), project_id: S.str('Only processes of this project and its hypotheses'), waiting_for_me: S.bool('Only processes with changes waiting for your approval') }),
    async run(s, a) {
      const c = await teamCtx(s, a);
      const list = (await Docs.processViews(c)).filter((p) => (!a.level || p.level === a.level) && (!a.project_id || p.project === a.project_id) && (!a.waiting_for_me || p.needsMe));
      return { processes: list.map((p) => processOut(c, p)) };
    },
  },
  {
    name: 'get_process', title: 'Get a process', scope: 'read', annotations: RO,
    description: 'The current version of a process by section and its steps (with step ids for proposing changes), proposed changes, version history and the latest advocate review.',
    inputSchema: obj({ team_id: S.team, process_id: S.str('Process id') }, ['process_id']),
    async run(s, a) { const c = await teamCtx(s, a); return processOut(c, await findView(Docs.processViews(c), a.process_id, 'Process not found'), true); },
  },
  {
    name: 'propose_process_change', title: 'Propose a process change', scope: 'write', annotations: W,
    description: 'Adds a draft change to a process. It changes nothing until whoever approves the process accepts it (if that is you, accept it with decide_process_change). kind: add (a new step, or describe an empty section), extend (add a detail), replace ("from now on we do it differently"), remove.',
    inputSchema: obj({
      team_id: S.team, process_id: S.str('Process id'), kind: S.enum(Docs.AMEND_KINDS, 'Kind of change'), section: S.enum([...Docs.SECTIONS, 'summary'], 'Section the change is about'),
      step_id: S.str('For extend / replace / remove of a step'), before_step_id: S.str('For a new step: the step it goes before (default: at the end)'), text: S.str('The proposed wording (not needed for remove)'), note: S.str('Why'),
    }, ['process_id', 'kind', 'section']),
    async run(s, a) {
      const c = await teamCtx(s, a);
      const p = await Docs.proposeProcessChange(c, a.process_id, { kind: a.kind, target: a.section, step: a.step_id, before: a.before_step_id, text: a.text, note: a.note }, { source: { itemTitle: provenance(s) } });
      return processOut(c, await findView(Docs.processViews(c), p.id, 'Process not found'), true);
    },
  },
  {
    name: 'decide_process_change', title: 'Accept or reject process changes', scope: 'write', annotations: W,
    description: 'For whoever approves the process: accept one or several pending changes (they make one new version; edits replace the proposed wording) or reject one with a reason.',
    inputSchema: obj({
      team_id: S.team, process_id: S.str('Process id'), accept_ids: { type: 'array', items: { type: 'string' }, description: 'Change ids to accept together' },
      edits: { type: 'object', additionalProperties: { type: 'string' }, description: 'Change id → the wording to accept instead' }, reject_id: S.str('A change id to reject'), reason: S.str('Why it is rejected'),
    }, ['process_id']),
    async run(s, a) {
      const c = await teamCtx(s, a);
      if (a.reject_id) await Docs.rejectProcessChange(c, a.process_id, a.reject_id, a.reason);
      if (a.accept_ids?.length) await Docs.acceptProcessChanges(c, a.process_id, a.accept_ids, a.edits || {});
      if (!a.reject_id && !a.accept_ids?.length) D.fail(400, 'Choose the changes to accept');
      return processOut(c, await findView(Docs.processViews(c), a.process_id, 'Process not found'), true);
    },
  },
  {
    name: 'list_agreements', title: 'List agreements', scope: 'read', annotations: RO,
    description: 'Agreements you are a party of (Owner/Admin don’t see others’), their status (pending, in_force, needs_review, terminated) and whose consent a pending version waits for.',
    inputSchema: obj({ team_id: S.team, waiting_for_me: S.bool('Only agreements waiting for your response') }),
    async run(s, a) {
      const c = await teamCtx(s, a);
      return { agreements: (await Docs.agreementViews(c)).filter((x) => !a.waiting_for_me || x.needsMe).map((x) => agreementOut(c, x)) };
    },
  },
  {
    name: 'get_agreement', title: 'Get an agreement', scope: 'read', annotations: RO,
    description: 'Clauses in force and of the version on approval, consents, earlier versions and the advocate checklist.',
    inputSchema: obj({ team_id: S.team, agreement_id: S.str('Agreement id') }, ['agreement_id']),
    async run(s, a) { const c = await teamCtx(s, a); return agreementOut(c, await findView(Docs.agreementViews(c), a.agreement_id, 'Agreement not found'), true); },
  },
  {
    name: 'propose_agreement_change', title: 'Propose an agreement change', scope: 'write', annotations: W,
    description: 'As a party: proposes a new version of one clause (clause_id, or none for a new clause; empty text removes it). The version replaces any version on approval and resets consents given so far; it comes into force when every party accepts. The version in force stays until then. TeamOS records agreement between people; it is not a legal document.',
    inputSchema: obj({ team_id: S.team, agreement_id: S.str('Agreement id'), clause_id: S.str('Clause to change'), clause_title: S.str('Clause title'), text: S.str('The complete new wording of the clause'), note: S.str('What changes and why') }, ['agreement_id', 'text']),
    async run(s, a) {
      const c = await teamCtx(s, a);
      const x = await Docs.proposeAgreementChange(c, a.agreement_id, { clause: { id: a.clause_id || null, title: a.clause_title, text: a.text }, note: a.note }, { source: { itemTitle: provenance(s) } });
      return agreementOut(c, Docs.agreementView(c, x), true);
    },
  },
  {
    name: 'respond_to_agreement', title: 'Respond to an agreement', scope: 'write', annotations: W,
    description: 'Your own response, as a party, to the version on approval: accept, or reject with a reason. Only do this when the user explicitly asks you to give their consent.',
    inputSchema: obj({ team_id: S.team, agreement_id: S.str('Agreement id'), decision: S.enum(['accept', 'reject'], 'Your decision'), note: S.str('Reason (required to reject)') }, ['agreement_id', 'decision']),
    async run(s, a) { const c = await teamCtx(s, a); return agreementOut(c, Docs.agreementView(c, await Docs.respondToAgreement(c, a.agreement_id, { decision: a.decision, note: a.note })), true); },
  },
  {
    name: 'review_with_advocate', title: 'Review with TeamOS Advocate', scope: 'write', annotations: W,
    description: 'TeamOS Advocate reviews a process or an agreement: what is missing, risks and 2–3 alternatives. It changes nothing; propose a change to act on its advice. Needs AI configured on the server; otherwise returns the checklist only.',
    inputSchema: obj({ team_id: S.team, process_id: S.str('Process id'), agreement_id: S.str('Agreement id') }),
    async run(s, a) {
      const c = await teamCtx(s, a);
      const kind = a.process_id ? 'process' : a.agreement_id ? 'agreement' : D.fail(400, 'Pass process_id or agreement_id');
      const id = a.process_id || a.agreement_id;
      let note;
      try { await Docs.runAdvocate(c, kind, id); } catch (e) { if (e.status === 503) note = render(c.lang, e.i18n); else throw e; }
      const out = kind === 'process' ? processOut(c, await findView(Docs.processViews(c), id, 'Process not found'), true) : agreementOut(c, await findView(Docs.agreementViews(c), id, 'Agreement not found'), true);
      return note ? { ...out, note } : out;
    },
  },

  /* ---- manage ---- */
  {
    name: 'create_team', title: 'Create a team', scope: 'manage', annotations: W,
    description: 'Creates a new team with you as Owner. Then invite people with invite_member.',
    inputSchema: obj({ name: S.str('Team name') }, ['name']),
    async run(s, a) {
      if (s.grant.teams) D.fail(403, 'This connection is limited to one workspace. Reconnect with access to all workspaces to create teams.');
      const t = await D.createTeam(s.user, a.name, s.lang);
      return { team_id: t.id, name: t.name, role: 'owner' };
    },
  },
  {
    name: 'invite_member', title: 'Invite a member', scope: 'manage', annotations: W,
    description: 'Creates an invite to a team (Owner/Admin) and returns a join link to send to the person. With an email, only that address can use it, once; without, the link works for anyone until revoked.',
    inputSchema: obj({ team_id: S.team, email: S.str('Email of the person to invite'), role: S.enum(['member', 'admin'], 'Role after joining (default member)') }),
    async run(s, a) {
      const c = await teamCtx(s, a);
      const inv = await D.createInvite(c, { email: a.email, role: a.role });
      return clean({ token: inv.token, email: inv.email, role: inv.role, join_link: joinLink(inv), note: tr(c.lang, 'Send this link to the person. TeamOS does not email invites yet.') });
    },
  },
  {
    name: 'revoke_invite', title: 'Revoke an invite', scope: 'manage', annotations: DEL,
    description: 'Revokes a pending invite (Owner/Admin). Get tokens from list_members.',
    inputSchema: obj({ team_id: S.team, token: S.str('Invite token') }, ['token']),
    async run(s, a) { const c = await teamCtx(s, a); return { revoked: await D.revokeInvite(c, a.token) }; },
  },
  {
    name: 'change_member_role', title: 'Change a member’s role', scope: 'manage', annotations: W,
    description: 'Changes a member’s role between admin and member (Owner/Admin). The Owner role changes only by transferring ownership in TeamOS.',
    inputSchema: obj({ team_id: S.team, user_id: S.str('Member id'), role: S.enum(['admin', 'member'], 'New role') }, ['user_id', 'role']),
    async run(s, a) { const c = await teamCtx(s, a); const m = await D.changeRole(c, a.user_id, a.role); return { user_id: m.userId, name: c.names.get(m.userId), role: m.role }; },
  },
  {
    name: 'remove_member', title: 'Remove a member', scope: 'manage', annotations: DEL,
    description: 'Removes a member from a team (Owner/Admin), or leaves the team when user_id is your own id. The Owner cannot be removed. With hand_over_commitments, you become the owner of their open commitments; ask the user first.',
    inputSchema: obj({ team_id: S.team, user_id: S.str('Member id'), hand_over_commitments: S.bool('Make you the owner of their open tasks owed to others (default false)') }, ['user_id']),
    async run(s, a) { const c = await teamCtx(s, a); const name = c.names.get(a.user_id); const { handedOver } = await D.removeMember(c, a.user_id, { handOver: Boolean(a.hand_over_commitments) }); return { removed: a.user_id, name, handed_over: handedOver }; },
  },
];
const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));
const toolInfo = ({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations: { title, ...annotations } });

/* ---------------- resources: team visions ---------------- */

async function listResources(s) {
  return (await allowedTeams(s)).map((t) => ({ uri: `teamos://teams/${t.id}/vision`, name: `${t.kind === 'personal' ? 'Personal' : t.name} — vision`, mimeType: 'text/markdown', description: 'Team vision document' }));
}
async function readResource(s, uri) {
  const m = /^teamos:\/\/teams\/([A-Za-z0-9_-]{1,80})\/vision$/.exec(uri || '');
  if (!m) throw rpcError(-32002, 'Resource not found');
  const c = await teamCtx(s, { team_id: m[1] });
  return { contents: [{ uri, mimeType: 'text/markdown', text: await store.getVision(c.tid) }] };
}

/* ---------------- JSON-RPC ---------------- */

const rpcError = (code, message, data) => Object.assign(new Error(message), { rpc: { code, message, ...(data ? { data } : {}) } });
const allowed = (s, tool) => s.grant.scope.includes(tool.scope);

async function callTool(s, params) {
  const tool = TOOL_BY_NAME.get(params?.name);
  if (!tool) throw rpcError(-32602, `Unknown tool: ${params?.name}`);
  if (!allowed(s, tool)) return { isError: true, content: [{ type: 'text', text: tr(s.lang, 'This connection doesn’t allow “{tool}”. Reconnect TeamOS with a higher access level.', { tool: tool.name }) }] };
  const args = params.arguments && typeof params.arguments === 'object' ? params.arguments : {};
  try {
    const out = await tool.run(s, args);
    return { content: [{ type: 'text', text: JSON.stringify(out, null, 1) }] };
  } catch (e) {
    const status = e.status || (e.$metadata ? 503 : 500);
    if (status >= 500) console.error(`[mcp] ${tool.name}`, e);
    return { isError: true, content: [{ type: 'text', text: render(s.lang, D.errorMsg(e)) }] };
  }
}

async function handle(s, m) {
  switch (m.method) {
    case 'initialize': {
      const requested = m.params?.protocolVersion;
      return {
        protocolVersion: PROTOCOLS.includes(requested) ? requested : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
        serverInfo: { ...SERVER, websiteUrl: origin },
        instructions: INSTRUCTIONS,
      };
    }
    case 'ping': return {};
    case 'tools/list': return { tools: TOOLS.filter((t) => allowed(s, t)).map(toolInfo) };
    case 'tools/call': return callTool(s, m.params);
    case 'resources/list': return { resources: await listResources(s) };
    case 'resources/templates/list': return { resourceTemplates: [] };
    case 'resources/read': return readResource(s, m.params?.uri);
    case 'prompts/list': return { prompts: [] };
    case 'logging/setLevel': return {};
    default: throw rpcError(-32601, `Method not found: ${m.method}`);
  }
}

async function respond(s, m) {
  if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') {
    return m && 'id' in m && !('result' in m || 'error' in m) ? { jsonrpc: '2.0', id: m.id ?? null, error: { code: -32600, message: 'Invalid Request' } } : null;
  }
  if (!('id' in m)) return null; // notification (e.g. notifications/initialized)
  try { return { jsonrpc: '2.0', id: m.id, result: await handle(s, m) }; }
  catch (e) {
    if (!e.rpc) console.error('[mcp]', e);
    return { jsonrpc: '2.0', id: m.id, error: e.rpc || { code: -32603, message: 'Internal error' } };
  }
}

export function mountMcp(app) {
  const headers = (req, res, next) => {
    res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id', 'Cache-Control': 'no-store' });
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };
  // Cookies never authorize MCP calls: only OAuth Bearer tokens.
  const bearer = async (req, res, next) => {
    try {
      const auth = await authenticate(req);
      if (!auth) {
        challenge(res, req.get('Authorization') ? 'invalid_token' : undefined);
        return res.status(401).json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized: connect TeamOS with OAuth.' } });
      }
      const lang = LANGS.includes(auth.user.lang) ? auth.user.lang : 'en';
      req.mcp = { ...auth, lang };
      next();
    } catch (e) { console.error('[mcp] auth', e); res.status(503).json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Storage is temporarily unavailable.' } }); }
  };

  app.use('/mcp', headers);
  app.post('/mcp', bearer, async (req, res) => {
    const body = req.body;
    if (body === undefined || (typeof body !== 'object')) return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    const batch = Array.isArray(body);
    const replies = (await Promise.all((batch ? body : [body]).map((m) => respond(req.mcp, m)))).filter(Boolean);
    if (!replies.length) return res.sendStatus(202);
    res.json(batch ? replies : replies[0]);
  });
  // Stateless server: no server-initiated SSE stream and no sessions to delete.
  app.get('/mcp', bearer, (_req, res) => res.set('Allow', 'POST').status(405).json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Method not allowed. Use POST.' } }));
  app.delete('/mcp', bearer, (_req, res) => res.sendStatus(200));
}

export { RESOURCE };
