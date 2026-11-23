// Upgrade existing workspaces before deploying the OKR/organization release.
// Run with application writes paused and a verified backup; default is read-only.
import { pathToFileURL } from 'node:url';
import * as store from './store.js';
import * as domain from './domain.js';

export async function migrateOkr({ apply = false } = {}) {
  const teams = await store.listTeams();
  const prepared = [];
  for (const team of teams) {
    const projects = await store.projects.list(team.id);
    const legacyProjects = projects.filter((project) => project.goals?.length);
    const owner = team.members?.find((member) => member.role === 'owner')?.userId;
    if ((legacyProjects.length || (team.kind !== 'personal' && !team.orgId)) && !owner) throw new Error(`Workspace ${team.id} needs migration but has no owner.`);
    prepared.push({ team, projects, legacyProjects, owner });
  }
  const plan = {
    teams: teams.length,
    organizationsToCreate: prepared.filter(({ team }) => team.kind !== 'personal' && !team.orgId).length,
    projectsWithLegacyGoals: prepared.reduce((sum, entry) => sum + entry.legacyProjects.length, 0),
    legacyGoals: prepared.reduce((sum, entry) => sum + entry.legacyProjects.reduce((n, project) => n + project.goals.length, 0), 0),
  };
  if (apply) {
    await domain.ensureOrgs(teams);
    for (const { team, projects, legacyProjects, owner } of prepared) {
      if (legacyProjects.length) await domain.listGoals({ tid: team.id, team, uid: owner, admin: true }, projects);
    }
  }
  return plan;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && args[0] !== '--apply')) {
    console.error('Usage: node --env-file-if-exists=.env server/migrate-okr.js [--apply]');
    process.exitCode = 1;
  } else {
    try {
      const apply = args[0] === '--apply';
      console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', ...await migrateOkr({ apply }) }, null, 2));
    } catch (error) {
      console.error('Migration failed:', error.message);
      process.exitCode = 1;
    }
  }
}
