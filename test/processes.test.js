import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const directory = mkdtempSync(path.join(tmpdir(), 'teamos-processes-'));
Object.assign(process.env, { DATA_DIR: directory, S3_BUCKET: '', SESSION_SECRET: 'processes-test', AI_PROVIDER: 'none' });
const store = await import('../server/store.js');
const D = await import('../server/domain.js');
const Docs = await import('../server/processes.js');
after(() => rmSync(directory, { recursive: true, force: true }));

async function workspace(id) {
  const org = await store.saveOrg({ id: `org-${id}`, name: 'Org', owners: ['anna'], admins: [], createdAt: store.now() });
  const team = { id, name: 'Team', kind: 'team', orgId: org.id, members: [
    { userId: 'anna', role: 'owner' }, { userId: 'bohdan', role: 'member' }, { userId: 'viktor', role: 'member' },
  ], invites: [] };
  for (const m of team.members) await store.saveUser({ id: m.userId, name: m.userId[0].toUpperCase() + m.userId.slice(1), email: `${m.userId}@example.test` });
  await store.saveTeam(team);
  await store.projects.save(id, { id: 'release', name: 'Release', owner: 'bohdan', members: ['bohdan', 'viktor'], status: 'active' });
  const [anna, bohdan, viktor] = await Promise.all(team.members.map(({ userId }) => D.ctxFor({ id: userId, name: userId }, id, 'en')));
  return { anna, bohdan, viktor };
}

test('a process is approved by the owner of its level, and accepted changes make one new version', async () => {
  const { anna, bohdan, viktor } = await workspace('proc');
  const draft = await Docs.createProcess(viktor, { level: 'team', title: 'Weekly planning', summary: 'Every Monday' });
  assert.equal(draft.status, 'draft');
  await assert.rejects(Docs.approveProcess(viktor, draft.id), /approves changes/);
  assert.equal((await Docs.approveProcess(anna, draft.id)).version, 1);

  const release = await Docs.createProcess(bohdan, { level: 'project', project: 'release', title: 'Release', sections: { steps: ['Build', 'Deploy'] } });
  assert.equal(release.status, 'active');
  const [build, deploy] = release.sections.steps;
  await assert.rejects(Docs.getProcess((await D.ctxFor({ id: 'anna' }, 'proc', 'en')), 'nope-id'), /Process not found/);
  const a1 = await Docs.proposeProcessChange(viktor, release.id, { kind: 'add', target: 'steps', before: deploy.id, text: 'Smoke test on staging' });
  const a2 = await Docs.proposeProcessChange(viktor, release.id, { kind: 'add', target: 'metric', text: 'No rollbacks' });
  const [x1, x2] = a2.amendments;
  assert.ok(a1);
  await assert.rejects(Docs.acceptProcessChanges(viktor, release.id, [x1.id]), /approves changes/);
  const v2 = await Docs.acceptProcessChanges(bohdan, release.id, [x1.id, x2.id], { [x2.id]: 'Zero rollbacks a month' });
  assert.equal(v2.version, 2);
  assert.deepEqual(v2.sections.steps.map((s) => s.text), ['Build', 'Smoke test on staging', 'Deploy']);
  assert.equal(v2.sections.metric, 'Zero rollbacks a month');
  assert.equal(v2.versions.at(-1).amendments.length, 2);
  assert.equal(v2.versions[0].sections.steps.length, 2);
  // A team Owner can approve a project process as a fallback; the change refers to a removed step.
  const rm = await Docs.proposeProcessChange(viktor, release.id, { kind: 'remove', target: 'steps', step: build.id });
  const rm2 = await Docs.proposeProcessChange(viktor, release.id, { kind: 'replace', target: 'steps', step: build.id, text: 'Build twice' });
  await Docs.acceptProcessChanges(anna, release.id, [rm.amendments.at(-1).id]);
  await assert.rejects(Docs.acceptProcessChanges(bohdan, release.id, [rm2.amendments.at(-1).id]), /no longer in the process/);
  const rejected = await Docs.rejectProcessChange(bohdan, release.id, rm2.amendments.at(-1).id, 'Not needed');
  assert.equal(rejected.amendments.at(-1).status, 'rejected');

  const views = await Docs.processViews(bohdan);
  assert.equal(views.find((p) => p.id === release.id).canApprove, true);
  assert.equal((await Docs.processViews(viktor)).find((p) => p.id === release.id).canApprove, false);
});

test('organization processes follow their visibility', async () => {
  const { anna, bohdan } = await workspace('orgproc');
  const secret = await Docs.createProcess(anna, { level: 'org', visibility: 'owner', title: 'Spending over $500' });
  const open = await Docs.createProcess(anna, { level: 'org', visibility: 'all', title: 'Onboarding' });
  assert.equal(secret.status, 'active');
  const seen = (await Docs.processViews(bohdan)).map((p) => p.id);
  assert.ok(seen.includes(open.id));
  assert.ok(!seen.includes(secret.id));
  await assert.rejects(Docs.createProcess(bohdan, { level: 'org', visibility: 'owner', title: 'Hidden' }), /on this level/);
  const proposed = await Docs.createProcess(bohdan, { level: 'org', visibility: 'all', title: 'Hiring' });
  assert.equal(proposed.status, 'draft');
});

test('an agreement comes into force only when every party accepts the same text', async () => {
  const { anna, bohdan, viktor } = await workspace('agr');
  const a = await Docs.createAgreement(anna, { type: 'partnership', title: 'Partnership', parties: ['bohdan', 'viktor'], clauses: [{ title: 'Shares', text: '40 / 40 / 20' }] });
  assert.equal(Docs.agreementStatus(a), 'pending');
  // The author accepts as a separate step, like everyone else.
  assert.deepEqual(a.pending.consents, []);
  assert.ok(Docs.agreementView(anna, a).needsMe);
  await Docs.respondToAgreement(bohdan, a.id, { decision: 'accept' });
  assert.equal(Docs.agreementStatus(await Docs.respondToAgreement(viktor, a.id, { decision: 'accept' })), 'pending');
  const v1 = await Docs.respondToAgreement(anna, a.id, { decision: 'accept' });
  assert.equal(Docs.agreementStatus(v1), 'in_force');
  assert.equal(v1.current.n, 1);
  assert.equal(v1.current.consents.length, 3);

  const shares = v1.current.clauses[0].id;
  const v2 = await Docs.proposeAgreementChange(viktor, a.id, { clause: { id: shares, text: '45 / 45 / 10' } });
  assert.equal(v2.pending.n, 2);
  assert.deepEqual(v2.pending.consents, []);
  await Docs.respondToAgreement(viktor, a.id, { decision: 'accept' });
  await Docs.respondToAgreement(anna, a.id, { decision: 'accept' });
  await assert.rejects(Docs.respondToAgreement(bohdan, a.id, { decision: 'reject' }), /reason/);
  await Docs.respondToAgreement(bohdan, a.id, { decision: 'reject', note: 'Should be 42 / 42 / 16' });
  // A counter-proposal resets every consent: people agree to an exact text.
  const counter = await Docs.proposeAgreementChange(bohdan, a.id, { clause: { id: shares, text: '42 / 42 / 16' } });
  assert.equal(counter.pending.counterTo, 'viktor');
  assert.deepEqual(counter.pending.consents, []);
  assert.equal(counter.current.clauses[0].text, '40 / 40 / 20');
  await Docs.respondToAgreement(bohdan, a.id, { decision: 'accept' });
  await Docs.respondToAgreement(anna, a.id, { decision: 'accept' });
  // A clause is changed or removed on its own; the last one can't be removed.
  await assert.rejects(Docs.proposeAgreementChange(anna, a.id, { clause: { id: shares, text: '' } }), /at least one clause/);
  const done = await Docs.respondToAgreement(viktor, a.id, { decision: 'accept' });
  assert.equal(done.current.n, 2);
  assert.equal(done.current.clauses[0].text, '42 / 42 / 16');
  assert.equal(done.versions[0].n, 1);

  // Only parties see an agreement, even the team Owner otherwise.
  const other = await Docs.createAgreement(bohdan, { type: 'other', title: 'Private', parties: ['viktor'], clauses: [{ title: 'Scope', text: 'Designs' }] });
  assert.ok(!(await Docs.agreementViews(anna)).some((x) => x.id === other.id));
  await assert.rejects(Docs.getAgreement(anna, other.id), /Agreement not found/);
  assert.ok(Docs.agreementView(viktor, await Docs.getAgreement(viktor, other.id)).needsMe);
});

test('when a party leaves the team, the agreement needs a full review by those who remain', async () => {
  const { anna, bohdan, viktor } = await workspace('leave');
  const a = await Docs.createAgreement(anna, { type: 'roles', title: 'Roles', parties: ['bohdan', 'viktor'], clauses: [{ title: 'Viktor', text: 'Design' }, { title: 'Bohdan', text: 'Posts' }] });
  await Docs.respondToAgreement(anna, a.id, { decision: 'accept' });
  await Docs.respondToAgreement(bohdan, a.id, { decision: 'accept' });
  await Docs.respondToAgreement(viktor, a.id, { decision: 'accept' });
  await D.removeMember(anna, 'viktor');
  const ctx = await D.ctxFor({ id: 'anna' }, 'leave', 'en');
  const marked = await Docs.getAgreement(ctx, a.id);
  assert.equal(Docs.agreementStatus(marked), 'needs_review');
  assert.equal(marked.reviewReason.party, 'viktor');
  assert.ok(Docs.agreementView(ctx, marked).needsMe);
  const review = await Docs.proposeAgreementChange(ctx, a.id, { parties: ['anna', 'bohdan'], clauses: [{ id: marked.current.clauses[1].id, title: 'Bohdan', text: 'Posts and design' }] });
  assert.equal(review.pending.review, true);
  assert.deepEqual(Docs.requiredParties(ctx.team, review), ['anna', 'bohdan']);
  await Docs.respondToAgreement(ctx, a.id, { decision: 'accept' });
  const done = await Docs.respondToAgreement(await D.ctxFor({ id: 'bohdan' }, 'leave', 'en'), a.id, { decision: 'accept' });
  assert.equal(Docs.agreementStatus(done), 'in_force');
  assert.equal(done.current.n, 2);
});

test('advocate checklist and review proposals become drafts, not changes', async () => {
  const { anna, bohdan } = await workspace('inbox');
  const release = await Docs.createProcess(bohdan, { level: 'project', project: 'release', title: 'Release', sections: { steps: ['Deploy'] } });
  const a = await Docs.createAgreement(anna, { type: 'partnership', title: 'Partnership', parties: ['bohdan'], clauses: [{ title: 'Shares', text: 'Anna 50%, Bohdan 50%' }] });
  const list = Docs.agreementChecklist(a, 'uk');
  assert.equal(list.find((x) => x.key === 'equity').ok, true);
  assert.equal(list.find((x) => x.key === 'vesting').suggestion.title, 'Вестинг');
  assert.equal(Docs.processCoverage(release), 1);

  const item = { id: 'i_meeting', owner: 'anna', type: 'transcript', title: 'Sync', date: '2026-11-24', origin: 'Meet', status: 'review', summary: [], participants: [], createdAt: store.now(), proposals: [
    { id: 'p1', kind: 'proc', on: true, quote: 'smoke test before each release', process: release.id, akind: 'add', section: 'steps', before: release.sections.steps[0].id, text: 'Smoke test on staging' },
    { id: 'p2', kind: 'agr', on: true, quote: 'add vesting', agreement: a.id, clause: null, clauseTitle: 'Vesting', text: '4 years, 1-year cliff' },
    { id: 'p3', kind: 'newproc', on: true, quote: 'retro every two weeks', title: 'Retro', summary: 'Every two weeks', level: 'team', steps: ['What worked'] },
  ] };
  await store.saveInboxItem('anna', 'inbox', item, 'smoke test before each release. add vesting. retro every two weeks');
  const res = await D.applyProposals(anna, item);
  assert.deepEqual(res.lines.map((l) => l.plural), ['processDraft', 'newProcess', 'agreementDraft']);
  const p = await Docs.getProcess(anna, release.id);
  assert.equal(p.version, 1);
  assert.equal(p.amendments[0].status, 'pending');
  assert.equal(p.amendments[0].source.quote, 'smoke test before each release');
  const ag = await Docs.getAgreement(anna, a.id);
  assert.equal(ag.pending.clauses.at(-1).title, 'Vesting');
  assert.equal(ag.pending.consents.length, 0);
  // Applying again is idempotent.
  await D.applyProposals(anna, { ...item, proposals: item.proposals.map((x) => ({ ...x })) });
  assert.equal((await Docs.getProcess(anna, release.id)).amendments.length, 1);
  assert.equal((await Docs.getAgreement(anna, a.id)).pending.clauses.length, 2);
});

test('the migration collects team process knowledge into drafts once and leaves agreements alone', async () => {
  const { anna } = await workspace('migrate');
  await store.saveUser({ id: 'anna', name: 'Anna', email: 'anna@example.test', lang: 'uk' });
  const c = await D.ctxFor({ id: 'anna', name: 'Anna' }, 'migrate', 'en');
  await D.createKnowledge(c, { type: 'process', text: 'Demo every Friday at 16:00' });
  await D.createKnowledge(c, { type: 'process', text: 'Release on Tuesdays', project: 'release' });
  await D.createKnowledge(c, { type: 'process', text: 'My private routine', scope: 'private' });
  await D.createKnowledge(c, { type: 'agreement', text: 'Shares 50/50' });
  const { migrateProcesses } = await import('../server/migrate-processes.js');
  const dry = await migrateProcesses();
  const mine = (await Docs.processViews(anna)).length;
  assert.equal(mine, 0);
  assert.ok(dry.processDraftsToCreate >= 2);
  await migrateProcesses({ apply: true });
  const created = (await Docs.processViews(anna)).filter((p) => p.teamId === 'migrate');
  assert.deepEqual(created.map((p) => [p.level, p.status, p.sections.steps.length]).sort(), [['project', 'draft', 1], ['team', 'draft', 1]]);
  assert.match(created.find((p) => p.level === 'team').title, /Як ми працюємо/);
  assert.ok(created.every((p) => p.sections.steps[0].source.knowledgeId));
  const again = await migrateProcesses();
  assert.equal(again.processDraftsToCreate, 0);
  assert.ok(again.agreementKnowledgeLeftAsIs >= 1);
});

test('an existing process is linked to a project and a hypothesis by people who work in it', async () => {
  const { anna, bohdan, viktor } = await workspace('links');
  await store.hypotheses.save('links', { id: 'h1', project: 'release', owner: 'viktor', if: 'a', then: 'b', status: 'draft' });
  const weekly = await Docs.createProcess(anna, { level: 'team', title: 'Weekly planning' });
  const secret = await Docs.createProcess(anna, { level: 'org', visibility: 'owner', title: 'Spending' });
  const p = await Docs.linkProcess(bohdan, { kind: 'project', id: 'release', process: weekly.id });
  assert.deepEqual(p.processLinks, [weekly.id]);
  const h = await Docs.linkProcess(viktor, { kind: 'hypothesis', id: 'h1', process: weekly.id });
  assert.deepEqual(h.processLinks, [weekly.id]);
  await assert.rejects(Docs.linkProcess(bohdan, { kind: 'project', id: 'release', process: secret.id }), /Process not found/);
  await store.saveTeam({ ...anna.team, members: [...anna.team.members, { userId: 'olena', role: 'member' }] });
  const olena = await D.ctxFor({ id: 'olena' }, 'links', 'en');
  await assert.rejects(Docs.linkProcess(olena, { kind: 'project', id: 'release', process: weekly.id, on: false }), /work in the project/);
  assert.deepEqual((await Docs.linkProcess(bohdan, { kind: 'project', id: 'release', process: weekly.id, on: false })).processLinks, []);
  assert.equal((await Docs.getProcess(anna, weekly.id)).level, 'team');
});
