import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const directory = mkdtempSync(path.join(tmpdir(), 'teamos-process-draft-'));
Object.assign(process.env, { DATA_DIR: directory, S3_BUCKET: '', AI_PROVIDER: 'openai', OPENAI_API_KEY: 'test', TEAMOS_ADVOCATE_AUTO: '0' });
const store = await import('../server/store.js');
const D = await import('../server/domain.js');
const Docs = await import('../server/processes.js');
after(() => rmSync(directory, { recursive: true, force: true }));

function model(t, respond) {
  t.mock.method(globalThis, 'fetch', async (_url, request) => {
    const result = respond(JSON.parse(request.body));
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] }] });
  });
}
const empty = { text: '', evidence_quote: '', knowledge_id: '' };

async function workspace(id) {
  const team = { id, name: 'Team', kind: 'team', members: [{ userId: 'anna', role: 'owner' }, { userId: 'bohdan', role: 'member' }], invites: [] };
  await store.saveTeam(team);
  return Promise.all(['anna', 'bohdan'].map((uid) => D.ctxFor({ id: uid, name: uid }, id, 'en')));
}

test('a draft from a source becomes pending changes with grounded quotes, filling only what is missing', async (t) => {
  const [anna, bohdan] = await workspace('draft-src');
  const text = 'Anna: Every video starts from an approved post idea. Bohdan: Then we write a script, shoot it and edit it in two days.';
  await store.saveSource('draft-src', { id: 's_video', title: 'Video sync', kind: 'transcript', date: '2026-11-24', author: 'anna', scope: 'team', derived: [], createdAt: store.now() }, { text });
  await store.saveSource('draft-src', { id: 's_mine', title: 'My notes', kind: 'note', date: '2026-11-24', author: 'bohdan', scope: 'private', derived: [], createdAt: store.now() }, { text: 'private' });
  const p = await Docs.createProcess(anna, { level: 'team', title: 'Video for posts', sections: { purpose: 'Engaging video' } });
  let seen;
  model(t, (req) => {
    seen = JSON.parse(req.input);
    return {
      summary: { text: 'From an approved idea to an edited video.', evidence_quote: 'Every video starts from an approved post idea', knowledge_id: '' },
      sections: [
        { section: 'purpose', text: 'Should be skipped: purpose is filled', evidence_quote: 'approved post idea', knowledge_id: '' },
        { section: 'trigger', text: 'An approved post idea.', evidence_quote: 'video starts from an approved post idea', knowledge_id: '' },
        { section: 'inputs', text: 'Made up', evidence_quote: 'words that are not in the source at all', knowledge_id: '' },
      ],
      steps: [{ text: 'Write a script', evidence_quote: 'Then we write a script, shoot it and edit it', knowledge_id: '' }, { text: 'Shoot and edit', evidence_quote: '', knowledge_id: '' }],
    };
  });
  const r = await Docs.generateProcessDraft(bohdan, p.id, { from: 'source', sourceId: 's_video' });
  assert.equal(seen.material.kind, 'source');
  assert.equal(seen.current.sections.purpose, 'Engaging video');
  assert.equal(r.added, 5);
  const am = r.process.amendments;
  assert.deepEqual(am.map((a) => a.target), ['summary', 'trigger', 'inputs', 'steps', 'steps']);
  assert.ok(am.every((a) => a.status === 'pending' && a.by === 'bohdan' && a.generated === 'source' && a.source.sourceId === 's_video'));
  assert.equal(am[1].source.quote, 'video starts from an approved post idea');
  assert.equal(am[2].source.quote, undefined);
  assert.equal(r.process.version, 1);
  await assert.rejects(Docs.generateProcessDraft(bohdan, p.id, { from: 'source', sourceId: 's_mine' }), /Source not found|shared with the team/);
  // Accepting all of them makes one version.
  const v2 = await Docs.acceptProcessChanges(anna, p.id, am.map((a) => a.id));
  assert.equal(v2.version, 2);
  assert.equal(v2.sections.trigger, 'An approved post idea.');
  assert.deepEqual(v2.sections.steps.map((s) => s.text), ['Write a script', 'Shoot and edit']);
});

test('a draft from the knowledge base must point to shared entries', async (t) => {
  const [anna] = await workspace('draft-kn');
  const shared = await D.createKnowledge(anna, { type: 'process', text: 'Videos are published on Tuesdays' });
  const secret = await D.createKnowledge(anna, { type: 'process', text: 'Private routine', scope: 'private' });
  const p = await Docs.createProcess(anna, { level: 'team', title: 'Video for posts' });
  let ids;
  model(t, (req) => {
    ids = JSON.parse(req.input).material.entries.map((k) => k.id);
    return { summary: empty, sections: [{ section: 'review', text: 'Unsupported', evidence_quote: '', knowledge_id: 'k_unknown' }], steps: [{ text: 'Publish on Tuesday', evidence_quote: 'published on Tuesdays', knowledge_id: shared.id }] };
  });
  const r = await Docs.generateProcessDraft(anna, p.id, { from: 'knowledge' });
  assert.deepEqual(ids, [shared.id]);
  assert.ok(!ids.includes(secret.id));
  assert.equal(r.added, 1);
  assert.equal(r.process.amendments[0].source.knowledgeId, shared.id);
  model(t, () => ({ summary: empty, sections: [], steps: [{ text: 'Publish on Tuesday', evidence_quote: '', knowledge_id: shared.id }] }));
  await assert.rejects(Docs.generateProcessDraft(anna, p.id, { from: 'knowledge' }), /nothing to add/);
});
