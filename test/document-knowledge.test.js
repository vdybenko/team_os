import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const directory = mkdtempSync(path.join(tmpdir(), 'teamos-document-test-'));
Object.assign(process.env, { DATA_DIR: directory, S3_BUCKET: '', AI_PROVIDER: 'openai', OPENAI_API_KEY: 'test' });
const store = await import('../server/store.js');
const { analyze } = await import('../server/ai.js');
const { askAssistant } = await import('../server/assistant.js');
const { applyProposals, assistantDocuments } = await import('../server/domain.js');
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
    scope: 'team', project_id: null, conflicts_with_id: null, confidence: 'high', first_line: 2, last_line: 4 };
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
