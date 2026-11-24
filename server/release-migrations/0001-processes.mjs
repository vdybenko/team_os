import { migrateProcesses } from '../migrate-processes.js';
import * as store from '../store.js';

const phase = process.argv[2];
if (process.env.TEAMOS_RELEASE_MIGRATION === '1' && !store.S3_RECORDS) {
  throw new Error('S3 is required for production release migrations');
}

async function snapshot() {
  const teams = await store.listTeams();
  return Promise.all(teams.map(async (team) => {
    const owner = team.members.find((member) => member.role === 'owner')?.userId;
    const knowledge = (await store.listKnowledgeFor(team.id, owner || '_'))
      .filter((entry) => entry.type === 'process' && !entry.supersededBy && (team.kind === 'personal' || entry.scope === 'team'));
    const processes = await store.processes.list(team.id);
    return { teamId: team.id, knowledge, processes };
  }));
}

switch (phase) {
  case 'plan':
    console.log(JSON.stringify(await migrateProcesses()));
    break;
  case 'backup':
    console.log(JSON.stringify(await snapshot()));
    break;
  case 'check-backup': {
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    const backup = JSON.parse(input);
    if (!Array.isArray(backup) || backup.some((team) => !team.teamId || !Array.isArray(team.knowledge) || !Array.isArray(team.processes))) {
      throw new Error('Invalid process migration backup');
    }
    break;
  }
  case 'apply':
    console.log(JSON.stringify(await migrateProcesses({ apply: true })));
    break;
  case 'verify': {
    const plan = await migrateProcesses();
    if (plan.processDraftsToCreate) throw new Error('Some process drafts still need migration');
    console.log(JSON.stringify(plan));
    break;
  }
  default:
    throw new Error('Unknown process migration phase');
}
