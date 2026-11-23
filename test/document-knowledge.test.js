import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { after, test } from 'node:test';

const directory = mkdtempSync(path.join(tmpdir(), 'teamos-document-test-'));
Object.assign(process.env, { DATA_DIR: directory, S3_BUCKET: '', AI_PROVIDER: 'openai', OPENAI_API_KEY: 'test' });
const store = await import('../server/store.js');
const { analyze } = await import('../server/ai.js');
const { askAssistant } = await import('../server/assistant.js');
const { applyProposals, assistantDocuments, reanalyzeInboxItem, reviewProposals, runAnalysis } = await import('../server/domain.js');
after(() => rmSync(directory, { recursive: true, force: true }));

function model(t, respond) {
  t.mock.method(globalThis, 'fetch', async (_url, request) => {
    const result = respond(JSON.parse(request.body));
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] }] });
  });
}

test('PDF knowledge uses the supporting lines on the original physical page', async (t) => {
  const text = '[p. 1]\nLibrary proposal\n\n[p. 4]\nBudget\nFiction 60%\nPoetry 40%\nVote pending.';
  const entry = { type: 'agreement', preliminary: true, text: 'The proposed budget assigns 60% to fiction and 40% to poetry.', why: null,
    scope: 'team', project_id: null, hypothesis_id: null, conflicts_with_id: null, conflict_note: null, vision_conflict: null, confidence: 'high', first_line: 2, last_line: 4 };
  model(t, (request) => {
    assert.ok(request.input.includes('[p. 4]\n1 | Budget\n2 | Fiction 60%'));
    return { summary: [], participants: [], commitments: [], status_updates: [], new_projects: [], new_hypotheses: [],
      knowledge: [{ page: 4, entries: [entry, { ...entry, last_line: 8 }] }, { page: 2, entries: [entry] }] };
  });
  const result = await analyze({ pdf: true, text, title: 'Library', type: 'doc', uploader: { id: 'reader' }, context: {} });
  assert.equal(result.knowledge.length, 1);
  assert.equal(result.knowledge[0].type, 'context');
  assert.equal(result.knowledge[0].evidence_timestamp, 'p. 4');
  assert.equal(result.knowledge[0].evidence_quote, 'Fiction 60% Poetry 40% Vote pending.');
});

test('the viewer can ask about a private upload before review and a teammate can cite the approved source', async (t) => {
  const team = { id: 'library', kind: 'team' };
  const owner = { tid: team.id, uid: 'reader', me: { name: 'Reader' }, team };
  const teammate = { ...owner, uid: 'visitor' };
  const text = '[p. 1]\nReading club proposal\n\n[p. 3]\nOpening depends on the vote.';
  const item = { id: 'upload', owner: owner.uid, type: 'doc', title: 'Reading club', status: 'review', date: '2026-01-01',
    file: { name: 'club.pdf', pages: 3 }, proposals: [{ id: 'proposal', kind: 'kn', type: 'context', text: 'A club is proposed.', on: true, scope: 'team' }] };
  await store.saveInboxItem(owner.uid, team.id, item, text);
  await store.saveInboxFile(owner.uid, team.id, item.id, Buffer.from('%PDF-test'));
  await store.saveInboxItem(owner.uid, team.id, { ...item, id: 'ignored', status: 'ignored' }, 'Removed from consideration');
  await store.saveInboxItem(owner.uid, 'elsewhere', { ...item, id: 'elsewhere' }, 'Other workspace');
  await store.saveSource(team.id, { id: 'private', scope: 'private', author: 'another', date: item.date }, { text: 'Another person’s file' });
  model(t, ({ input }) => {
    const { records } = JSON.parse(input);
    assert.equal(records.length, 2);
    const page = records.find((r) => r.data.page === 3);
    assert.equal(page.data.text, 'Opening depends on the vote.');
    assert.equal(page.data.workspaceRecordDate, item.date);
    assert.equal(page.data.date, undefined);
    return { focus: 'ordinary',
      answer: 'A vote is still required.', sources: [page.key, 'invented'] };
  });
  const ask = (c) => askAssistant({ question: 'Can it open?', turns: [], tasks: [], knowledge: [], projects: [], hypotheses: [],
    viewerId: c.uid, documents: assistantDocuments(c) });
  assert.deepEqual((await ask(teammate)).sources, []);
  const before = (await ask(owner)).sources;
  assert.deepEqual(before.map(({ kind, target, page }) => [kind, target, page]), [['inbox', item.id, 3]]);
  await applyProposals(owner, item);
  const after = (await ask(teammate)).sources;
  assert.deepEqual(after.map(({ kind, target, page }) => [kind, target, page]), [['source', item.sourceId, 3]]);
  assert.deepEqual((await ask(owner)).sources, after);
});


test('text notes, emails and chats retain their original and respect source visibility', async () => {
  const team = { id: 'text-sources', kind: 'team' };
  const owner = { tid: team.id, uid: 'reader', me: { name: 'Reader' }, team };
  for (const [type, scope] of [['note', 'private'], ['email', 'team'], ['chat', 'team']]) {
    const item = { id: type, owner: owner.uid, type, title: type, date: '2026-01-01', status: 'review', sourceScope: scope,
      proposals: [{ id: 'proposal', kind: 'kn', type: 'fact', text: `Knowledge from ${type}`, on: true, scope: 'team' }] };
    const text = `Original ${type} text`;
    await store.saveInboxItem(owner.uid, team.id, item, text);
    await applyProposals(owner, item);
    const source = await store.findSource(team.id, item.sourceId, owner.uid);
    assert.equal(source.kind, type);
    assert.equal(await store.getSourceText(team.id, source), text);
    const knowledge = await store.findKnowledge(team.id, item.proposals[0].applied, owner.uid);
    assert.equal(knowledge.sourceId, source.id);
    assert.equal(knowledge.sourceItem, item.id);
    assert.ok(source.derived.some((d) => d.kind === 'knowledge' && d.id === knowledge.id));
    assert.equal(Boolean(await store.findSource(team.id, item.sourceId, 'visitor')), scope === 'team');
  }
});

test('focused status reading uses dated primary evidence and excludes administrative dates and earlier guesses', async (t) => {
  const document = { id: 'vote', kind: 'source', title: 'Board notes', pdf: true, date: '2026-11-20',
    text: '[p. 1]\nOctober 5. Budget approval proposed.\n\n[p. 2]\nNovember 2. The board approved the budget.' };
  let calls = 0;
  model(t, ({ input }) => {
    calls++;
    const payload = JSON.parse(input);
    if (payload.records) {
      const page = payload.records.find((r) => r.data.page === 2);
      return { focus: 'current_status', answer: 'An unverified guess', sources: [page.key] };
    }
    assert.doesNotMatch(input, /2026-11-20|unverified guess/);
    assert.ok(payload.evidence.find((r) => r.page === 1).lines.includes('October 5'));
    const page = payload.evidence.find((r) => r.page === 2);
    assert.ok(page.lines.includes('November 2. The board approved'));
    return { answer: 'The board approved the budget on November 2.', sources: [page.key], status_basis: 'documented_progress',
      language: 'en', date_key: page.key, printed_date: 'November 2', open_items: [] };
  });
  const reply = await askAssistant({ question: 'What is the latest documented status?', turns: [], tasks: [], knowledge: [], projects: [], hypotheses: [], documents: [document] });
  assert.equal(calls, 2);
  assert.deepEqual(reply.sources.map((s) => s.page), [2]);
  assert.equal(reply.answer, 'The board approved the budget on November 2.');
});

test('responsibility rows preserve leads, contributors and joint owners verbatim', async (t) => {
  const document = { id: 'roles', kind: 'inbox', title: 'Draft roles', pdf: true,
    text: '[p. 1]\nProposed assignments\nFunction Owner\nOutreach Jo, supported by Ari\nPlanning Jo and Ari' };
  model(t, ({ input }) => {
    const payload = JSON.parse(input);
    if (payload.records) return { focus: 'responsibilities', sources: [payload.records[0].key], answer: '' };
    const key = payload.evidence[0].key;
    return { answer: 'Unused paraphrase', qualification: 'Proposed roles', sources: [],
      assignment_rows: [{ key, line: 3, activity: 'Outreach', assigned_to: 'Ari' }, { key, line: 4, activity: 'Planning', assigned_to: 'Jo and Ari' }] };
  });
  const reply = await askAssistant({ question: 'Who owns outreach and planning?', turns: [], tasks: [], knowledge: [], projects: [], hypotheses: [], documents: [document] });
  assert.equal(reply.answer, 'Proposed roles\n\n- Outreach — Jo, supported by Ari\n- Planning — Jo and Ari');
  assert.deepEqual(reply.sources.map((s) => s.page), [1]);
});

test('a contribution follow-up can use a mixed table without repeating the previous profit split', async (t) => {
  const document = { id: 'studio', kind: 'inbox', pdf: true, text:
    '[p. 1]\nProposed partnership\n\n[p. 2]\nPartner | Contribution | Proposed share of profit\nAri | equipment | 50%\nJo | training | 30%\nSam | distribution | 20%\nThis profit split is a proposal.' };
  const split = 'This profit split is a proposal.\n\n- Ari — 50%\n- Jo — 30%\n- Sam — 20%';
  const contributions = 'Proposed contributions\n- Ari supplies equipment.\n- Jo provides training.\n- Sam handles distribution.';
  const shareQuestion = 'What profit split did we decide on?';
  const contributionQuestion = 'What does each partner bring?';
  const models = [];
  model(t, (request) => {
    models.push(request.model);
    const { records, question, history, evidence } = JSON.parse(request.input);
    if (records) {
      const key = records.find((r) => r.data.page === 2).key;
      if (question === shareQuestion) return { focus: 'decision', sources: [key], answer: '' };
      assert.equal(history[0].answer, split);
      return { focus: 'contributions', sources: [key], answer: contributions + '\n' + split };
    }
    if (question === shareQuestion) {
      const key = evidence.find((r) => r.page === 2).key;
      return { answer: 'The board approved the split.', sources: [key], allocation_tables: [{ key, status_line: 5, recipients: [
        { line: 2, name: 'Ari', percentage: '50%' }, { line: 3, name: 'Jo', percentage: '30%' }, { line: 4, name: 'Sam', percentage: '20%' },
      ] }] };
    }
    assert.deepEqual(history, [shareQuestion]);
    assert.equal(evidence.length, 1);
    assert.match(evidence[0].lines, /Jo \| training \| 30%/);
    return { answer: contributions, sources: [evidence[0].key], qualification: '', profiles: [] };
  });
  const ask = (question, turns = []) => askAssistant({ question, turns, tasks: [], knowledge: [], projects: [], hypotheses: [], documents: [document] });
  const first = await ask(shareQuestion);
  assert.equal(first.answer, split);
  const followup = await ask(contributionQuestion, [{ question: shareQuestion, ...first }]);
  assert.equal(followup.answer, contributions);
  assert.deepEqual(followup.sources.map((s) => s.page), [2]);
  assert.equal(models.length, 4);
  assert.equal(models[3], models[2]);
});

test('individual profiles preserve original contributions and end before shared responsibilities', async (t) => {
  const document = { id: 'library', kind: 'source', pdf: true,
    text: '[p. 2]\nЗапропоновані внески\nІрина\nНадає підтримку 24/7.\nОлег\nНадає каталог.\nСофія\nНавчає учасників.\nСтратегія спільна.' };
  model(t, ({ input }) => {
    const { records, evidence } = JSON.parse(input);
    if (records) return { focus: 'contributions', sources: [records[0].key], answer: '' };
    const key = evidence[0].key;
    return { answer: 'Олег відповідає за стратегію.', sources: [key], qualification: 'Затверджено на засіданні.', profiles: [
      { key, name: 'Ірина', name_line: 2, last_line: 3 }, { key, name: 'Олег', name_line: 4, last_line: 5 },
      { key, name: 'Софія', name_line: 6, last_line: 7 },
    ] };
  });
  const reply = await askAssistant({ question: 'Що кожен із трьох партнерів привносить у партнерство?', turns: [], tasks: [], knowledge: [], projects: [], hypotheses: [], documents: [document] });
  assert.equal(reply.answer, '- **Ірина** — Надає підтримку 24/7.\n- **Олег** — Надає каталог.\n- **Софія** — Навчає учасників.');
  assert.deepEqual(reply.sources.map((s) => s.page), [2]);
});

test('a combined request includes both contributions and the proposed shares', async (t) => {
  const answer = 'Jo contributes equipment. The proposed profit split is Jo 60%, Ari 40%.';
  model(t, ({ input }) => {
    const [record] = JSON.parse(input).records;
    return { focus: 'ordinary', sources: [record.key], answer };
  });
  const reply = await askAssistant({ question: 'What does Jo bring and how would profits be split?', turns: [], tasks: [], knowledge: [], projects: [], hypotheses: [],
    documents: [{ id: 'studio', kind: 'source', text: 'Jo brings equipment. Proposed profit share: Jo 60%, Ari 40%.' }] });
  assert.equal(reply.answer, answer);
});

test('a dated proposal supplies a cutoff, not evidence of a later launch', async (t) => {
  const document = { id: 'club', kind: 'source', pdf: true, date: '2027-01-10',
    text: '[p. 1]\nProposal · 5 November 2026\n\n[p. 3]\nDiscuss the venue and budget.' };
  model(t, ({ input }) => {
    const { records, evidence } = JSON.parse(input);
    if (records) return { focus: 'current_status', sources: [records.find((r) => r.data.page === 3).key], answer: '' };
    return { status_basis: 'proposal_only', language: 'en', date_key: '', printed_date: '', open_items: ['venue and budget'],
      answer: 'The club has already launched.', sources: [evidence.find((r) => r.page === 3).key] };
  });
  const reply = await askAssistant({ question: 'What is the current status?', turns: [], tasks: [], knowledge: [], projects: [], hypotheses: [], documents: [document] });
  assert.match(reply.answer, /5 November 2026/);
  assert.match(reply.answer, /current status is unknown/);
  assert.doesNotMatch(reply.answer, /launched|2027/);
  assert.deepEqual(reply.sources.map((s) => s.page), [3, 1]);
});

test('the complete numbered plan preserves original actions, owners, numbers and timing', async (t) => {
  const document = { id: 'plan', kind: 'inbox', pdf: true,
    text: '[p. 3]\nNext steps\n01 Prepare a draft\nLee and Kai · this week\n02 Review\nThree to five readers · after the pilot' };
  model(t, ({ input }) => {
    const { records, evidence } = JSON.parse(input);
    if (records) return { focus: 'next_steps', sources: [records[0].key], answer: '' };
    return { copy_full_list: true, answer: 'Sign it tomorrow.', sources: [evidence[0].key] };
  });
  const reply = await askAssistant({ question: 'What are the next steps?', turns: [], tasks: [], knowledge: [], projects: [], hypotheses: [], documents: [document] });
  assert.equal(reply.answer, '1. **Prepare a draft** Lee and Kai · this week\n\n2. **Review** Three to five readers · after the pilot');
  assert.deepEqual(reply.sources.map((s) => s.page), [3]);
});

test('ordinary document lookups make one call on the configured lookup model', async (t) => {
  const previous = process.env.OPENAI_LOOKUP_MODEL;
  process.env.OPENAI_LOOKUP_MODEL = 'test-lookup-mini';
  t.after(() => { if (previous === undefined) delete process.env.OPENAI_LOOKUP_MODEL; else process.env.OPENAI_LOOKUP_MODEL = previous; });
  let calls = 0;
  model(t, (request) => {
    calls++;
    assert.equal(request.model, 'test-lookup-mini');
    const [record] = JSON.parse(request.input).records;
    return { focus: 'ordinary', sources: [record.key], answer: 'Reading groups.' };
  });
  const reply = await askAssistant({ question: 'What does the library offer?', turns: [], tasks: [], knowledge: [], projects: [], hypotheses: [],
    documents: [{ id: 'library', kind: 'source', text: 'The library offers reading groups.' }] });
  assert.equal(reply.answer, 'Reading groups.');
  assert.equal(calls, 1);
});

test('knowledge proposals carry placement, earlier-agreement conflicts and vision tensions', async (t) => {
  const team = { id: 'studio', kind: 'team', name: 'Studio', members: [{ userId: 'lead', role: 'owner' }] };
  const c = { tid: team.id, uid: 'lead', me: { name: 'Lead' }, team, admin: true };
  await store.saveVision(team.id, '# Studio\n\nWe never sell user data.');
  await store.projects.save(team.id, { id: 'p_app', name: 'App', vision: 'Privacy-first notes' });
  await store.hypotheses.save(team.id, { id: 'h_ads', project: 'p_app', if: 'we add ads', then: 'revenue grows' });
  await store.saveKnowledge(team.id, { id: 'k_old', type: 'decision', text: 'The app stays ad-free.', scope: 'team', author: 'lead', date: '2026-01-01' });
  const text = 'Lead: we agreed to share usage data with advertisers starting next month.';
  await store.saveInboxItem(c.uid, team.id, { id: 'meet', owner: c.uid, type: 'transcript', title: 'Sync', status: 'analyzing', date: '2026-11-20' }, text);
  model(t, ({ input }) => {
    assert.ok(input.includes('We never sell user data.'));
    assert.ok(input.includes('"project_id": "p_app"') && input.includes('we add ads'));
    const entry = { type: 'agreement', text: 'Usage data will be shared with advertisers from next month.', why: null, scope: 'team',
      project_id: null, hypothesis_id: 'h_ads', conflicts_with_id: 'k_old', conflict_note: 'Earlier the app was to stay ad-free.',
      vision_conflict: 'The vision says the team never sells user data.', confidence: 'high',
      first_line: 1, last_line: 1 };
    return { summary: [], participants: [], commitments: [], status_updates: [], new_projects: [], new_hypotheses: [],
      knowledge: [entry, { ...entry, text: 'Unrelated note.', hypothesis_id: 'invented', conflicts_with_id: 'invented', conflict_note: 'x', vision_conflict: '' }] };
  });
  await runAnalysis(c, 'meet');
  const [kn, other] = (await store.getInboxItem(c.uid, team.id, 'meet')).proposals;
  assert.deepEqual([kn.project, kn.hypothesis, kn.conflict, kn.res], ['p_app', 'h_ads', 'k_old', 'replace']);
  assert.equal(kn.conflictNote, 'Earlier the app was to stay ad-free.');
  assert.equal(kn.visionConflict, 'The vision says the team never sells user data.');
  assert.deepEqual([other.project, other.hypothesis, other.conflict, other.conflictNote, other.visionConflict], [null, null, null, null, null]);
});

test('long transcript review recovers evidence and retains both saved commitments without reopening them', { timeout: 1500 }, async (t) => {
  const team = { id: 'meeting-review', kind: 'team', members: [{ userId: 'lead', role: 'owner' }] };
  const c = { tid: team.id, uid: 'lead', me: { name: 'Lead' }, team, admin: true };
  const item = { id: 'sync', owner: c.uid, type: 'transcript', title: 'Sync', status: 'review', date: '2026-11-23',
    proposals: [
      { id: 'saved-drafts', kind: 'task', title: 'Investigate missing drafts', owner: 'lead', quote: 'I will investigate missing drafts.', on: true },
      { id: 'saved-outreach', kind: 'task', title: 'Test outreach', owner: 'lead', quote: 'I will test outreach.', on: true },
    ] };
  const text = '01:25 Lead: I will investigate missing drafts. I will test outreach.\n'
    + '02:30 Lead: Draft mode never sends messages automatically.\n\n'
    + `${'Context for the product demo. '.repeat(410)}\n\n`
    + '1:11:42 Lead: I will check the invitation logs.';
  await store.saveInboxItem(c.uid, team.id, item, text);
  await applyProposals(c, item);
  item.status = 'done';
  item.appliedAt = store.now();
  await store.saveInboxItem(c.uid, team.id, item);
  const savedIds = item.proposals.map((p) => p.applied);
  const task = (title, line, duplicate_of_task_id = null) => ({ title, owner_member_id: 'lead', owner_external_name: null,
    requester_member_id: 'lead', requester_external_name: null, due: null, project_id: null, hypothesis_id: null, important: false,
    duplicate_of_task_id, confidence: 'high', first_line: line, last_line: line });
  let sections = 0;
  model(t, ({ input, text: format }) => {
    sections++;
    assert.equal(format.format.name, 'teamos_transcript_analysis');
    const context = JSON.parse(input.split('<team_context>\n')[1].split('\n</team_context>')[0]);
    assert.deepEqual(new Set(context.applied_tasks.map(({ id }) => id)), new Set(savedIds));
    const source = input.split('<source>\n')[1];
    const result = { summary: [], participants: [], commitments: [], status_updates: [], new_projects: [], new_hypotheses: [], knowledge: [] };
    if (source.includes('Draft mode')) {
      result.knowledge.push({ type: 'process', text: 'Draft mode does not send automatically.', why: null, scope: 'team',
        project_id: null, hypothesis_id: null, conflicts_with_id: null, conflict_note: null, vision_conflict: null,
        confidence: 'high', first_line: 2, last_line: 2 });
      result.commitments.push(task('Find out why drafts disappeared', 1, savedIds[0]), task('Test outreach!', 1));
    } else {
      const line = Number(/(\d+) \| 1:11:42/.exec(source)[1]);
      result.commitments.push(task('Check the invitation logs', line), task('Check the invitation logs', line));
      result.knowledge.push({ type: 'fact', text: 'Out-of-section evidence.', why: null, scope: 'team',
        project_id: null, hypothesis_id: null, conflicts_with_id: null, conflict_note: null, vision_conflict: null,
        confidence: 'high', first_line: 1, last_line: 1 });
    }
    return result;
  });
  let reopened;
  for (let pass = 0; pass < 2; pass++) {
    assert.equal((await reanalyzeInboxItem(c, item.id)).status, 'processing');
    do {
      await setImmediate();
      reopened = await store.getInboxItem(c.uid, team.id, item.id);
    } while (reopened.status === 'processing');
    assert.equal(reopened.status, 'review');
    assert.deepEqual(reopened.proposals.filter((p) => p.appliedKind).map((p) => p.applied), savedIds);
    const [task, knowledge, ...extra] = reviewProposals(reopened);
    assert.equal(extra.length, 0);
    assert.equal(task.title, 'Check the invitation logs');
    assert.equal(task.ts, '1:11:42');
    assert.equal(knowledge.quote, '02:30 Lead: Draft mode never sends messages automatically.');
    assert.equal(knowledge.ts, '02:30');
  }
  assert.equal(sections, 4);
  assert.equal((await store.listTasksFor(c.tid, c.uid)).length, 2);
  await store.saveInboxItem(c.uid, team.id, { ...reopened, proposals: [] });
  await runAnalysis(c, item.id);
  reopened = await store.getInboxItem(c.uid, team.id, item.id);
  assert.deepEqual(reviewProposals(reopened).filter((p) => p.kind === 'task').map((p) => p.title), ['Check the invitation logs']);
  await applyProposals(c, reopened);
  assert.equal((await store.listTasksFor(c.tid, c.uid)).length, 3);
  const source = await store.findSource(c.tid, item.sourceId, c.uid);
  assert.equal(source.derived.filter((d) => d.kind === 'task').length, 3);
  assert.equal(source.derived.filter((d) => d.kind === 'knowledge').length, 1);
});
