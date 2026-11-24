// Prepare existing workspaces for the processes & agreements release.
//
// Knowledge entries of type "process" stay as atomic facts (spec §3.6). This migration collects the team-wide
// ones into draft process documents, one per placement: the team, each project and each hypothesis. Every step
// keeps a link to its knowledge entry and quote. A draft changes nothing until whoever owns its level approves it.
// Knowledge of type "agreement" is only counted: an agreement needs every party's explicit consent, so it is
// never created on anyone's behalf.
//
// Run with application writes paused and a verified backup; the default is a read-only dry run.
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import * as store from './store.js';
import * as D from './domain.js';
import * as Docs from './processes.js';
import { tr } from './i18n.js';

const migrationId = (tid, level, ref) => `pc_mig_${crypto.createHash('sha256').update(JSON.stringify([tid, level, ref || ''])).digest('hex').slice(0, 24)}`;

async function teamPlan(team) {
  const owner = team.members?.find((member) => member.role === 'owner')?.userId;
  const [knowledge, existing, projects, hypotheses] = await Promise.all([
    store.listKnowledgeFor(team.id, owner || '_'), store.processes.list(team.id), store.projects.list(team.id), store.hypotheses.list(team.id),
  ]);
  const collected = new Set(existing.flatMap((p) => p.fromKnowledge || []));
  const shared = knowledge.filter((k) => (team.kind === 'personal' || k.scope === 'team') && !k.supersededBy);
  const groups = new Map();
  for (const k of shared.filter((x) => x.type === 'process' && !collected.has(x.id))) {
    const h = k.hypothesis && hypotheses.find((x) => x.id === k.hypothesis);
    const p = !h && k.project && projects.find((x) => x.id === k.project);
    const [level, ref] = h ? ['hypothesis', h.id] : p ? ['project', p.id] : ['team', null];
    const id = migrationId(team.id, level, ref);
    if (!groups.has(id)) groups.set(id, { id, level, project: p?.id || h?.project || null, hypothesis: h?.id || null, name: h ? h.then || h.statement : p ? p.name : team.name, entries: [] });
    groups.get(id).entries.push(k);
  }
  // A process has up to 40 steps: a larger group becomes several drafts.
  const parts = [...groups.values()].flatMap((g) => (g.entries.length <= 40 ? [g] : Array.from({ length: Math.ceil(g.entries.length / 40) }, (_, i) => ({
    ...g, id: i ? migrationId(team.id, g.level, `${g.hypothesis || g.project || ''}#${i}`) : g.id, entries: g.entries.slice(i * 40, i * 40 + 40),
  }))));
  const ids = new Set(existing.map((p) => p.id));
  const toCreate = parts.filter((g) => !ids.has(g.id));
  const leftInKnowledge = parts.filter((g) => ids.has(g.id)).reduce((n, g) => n + g.entries.length, 0);
  if (toCreate.length && !owner) throw new Error(`Workspace ${team.id} needs migration but has no owner.`);
  return { team, owner, toCreate, leftInKnowledge, agreementKnowledge: shared.filter((k) => k.type === 'agreement').length };
}

export async function migrateProcesses({ apply = false } = {}) {
  const teams = await store.listTeams();
  const prepared = [];
  for (const team of teams) prepared.push(await teamPlan(team));
  const plan = {
    teams: teams.length,
    processDraftsToCreate: prepared.reduce((n, x) => n + x.toCreate.length, 0),
    processKnowledgeToCollect: prepared.reduce((n, x) => n + x.toCreate.reduce((m, g) => m + g.entries.length, 0), 0),
    processKnowledgeAddedSinceMigration: prepared.reduce((n, x) => n + x.leftInKnowledge, 0),
    agreementKnowledgeLeftAsIs: prepared.reduce((n, x) => n + x.agreementKnowledge, 0),
  };
  if (apply) {
    for (const { team, owner, toCreate } of prepared) {
      if (!toCreate.length) continue;
      const user = await store.getUser(owner) || { id: owner, name: owner };
      const lang = user.lang === 'uk' ? 'uk' : 'en';
      const c = await D.ctxFor(user, team.id, lang);
      for (const g of toCreate) {
        await Docs.collectProcess(c, {
          level: g.level, project: g.project, hypothesis: g.hypothesis, knowledge: g.entries.map((k) => k.id),
          title: tr(lang, 'How we work · {name}', { name: String(g.name || '').slice(0, 160) }),
          summary: tr(lang, 'Collected from {n} knowledge entries of type “process”. Edit it into one document and approve it.', { n: g.entries.length }),
        }, { id: g.id, draft: true });
      }
    }
  }
  return plan;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && args[0] !== '--apply')) {
    console.error('Usage: node --env-file-if-exists=.env server/migrate-processes.js [--apply]');
    process.exitCode = 1;
  } else {
    try {
      const apply = args[0] === '--apply';
      console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', ...await migrateProcesses({ apply }) }, null, 2));
    } catch (error) {
      console.error('Migration failed:', error.message);
      process.exitCode = 1;
    }
  }
}
