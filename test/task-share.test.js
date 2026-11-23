import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const directory = mkdtempSync(path.join(tmpdir(), 'teamos-task-share-'));
Object.assign(process.env, { DATA_DIR: directory, S3_BUCKET: '', SESSION_SECRET: 'task-share-test' });
const store = await import('../server/store.js');
const tasks = await import('../server/domain.js');
const share = await import('../server/task-share.js');
const { taskSharePage } = await import('../server/task-share-page.js');
after(() => rmSync(directory, { recursive: true, force: true }));

async function workspace(id) {
  const team = { id, name: 'Workspace', kind: 'team', members: [
    { userId: 'requester', role: 'member' }, { userId: 'teammate', role: 'owner' },
  ] };
  await store.saveTeam(team);
  return Promise.all(team.members.map(({ userId }) => tasks.ctxFor({ id: userId }, id, 'en')));
}

test('a private task link shows the read-only card and hides current and historic statuses', async () => {
  const [requester, teammate] = await workspace('private-tasks');
  await store.saveUser({ id: requester.uid, name: 'Report writer', email: 'writer@example.test' });
  const project = await store.projects.save(requester.tid, { id: 'report', name: 'Reporting', vision: 'Workspace plan' });
  const hypothesis = await store.hypotheses.save(requester.tid, { id: 'quarterly', project: project.id, then: 'Reconcile the totals', learnings: ['Private learning'] });
  const task = await tasks.createTask(requester, {
    title: 'Review report', description: 'Compare the totals', due: '2026-11-27', status: 'progress', important: true,
    project: project.id, hypothesis: hypothesis.id,
  }, { source: { itemId: 'inbox-entry', sourceId: 'transcript-record', itemTitle: 'Reporting call', ts: '1:15', quote: 'Check the <totals>' } });
  task.history.push(
    { at: task.createdAt, by: requester.uid, text: 'виконавець: First writer → Report writer' },
    { at: task.createdAt, by: requester.uid, text: 'Відкрито → В роботі', source: 'Private legacy status source' },
  );
  await store.saveTask(requester.tid, task);
  const token = await share.replaceTaskShare(requester, await share.taskForSharing(requester, task.id));
  assert.deepEqual((await share.getSharedTask(token)).comments, []);
  const updated = await tasks.commentOnTask(requester, task.id, 'Check the second column');
  const changed = await tasks.updateTask(requester, updated, { status: 'done', due: '2026-11-28', urgent: true }, 'Private status source');
  const card = await share.getSharedTask(token, 'uk');
  assert.deepEqual(card, {
    title: task.title, description: task.description, due: changed.due, owner: 'Report writer', requester: 'Report writer',
    important: true, urgent: true, project: 'Reporting', hypothesis: 'Reconcile the totals',
    source: { title: 'Reporting call', timestamp: '1:15', quote: 'Check the <totals>' },
    comments: [{ author: 'Report writer', text: 'Check the second column', at: updated.comments[0].at }],
    history: [
      { author: 'Report writer', at: task.history[0].at, text: 'Створено вручну', source: 'Reporting call' },
      { author: 'Report writer', at: task.createdAt, text: 'виконавець: First writer → Report writer', source: undefined },
      { author: 'Report writer', at: changed.history.at(-1).at, text: 'дедлайн → 2026-11-28', source: undefined },
    ],
  });
  const page = taskSharePage('uk', card);
  assert.match(page, /Лише читання/);
  assert.match(page, /Check the &lt;totals&gt;/);
  assert.match(page, /Історія/);
  assert.doesNotMatch(page, /<form|<button|<script|<select|<textarea|readBy|status source|В роботі|Готово|transcript-record|Workspace plan|Private learning/);
  const altered = (token[0] === 'A' ? 'B' : 'A') + token.slice(1);
  assert.equal(await share.getSharedTask(altered), null);
  assert.deepEqual(await tasks.visibleTasks(teammate), []);
  await assert.rejects(share.taskForSharing(teammate, task.id), { status: 404 });
  const [visible] = await tasks.visibleTasks(requester);
  assert.equal(Object.hasOwn(tasks.taskView(requester, visible), 'shareToken'), false);
});

test('rotation, revocation and deletion invalidate links even after a stale task edit', async () => {
  const [requester, teammate] = await workspace('rotating-tasks');
  const task = await tasks.createTask(requester, { title: 'Review report', owner: teammate.uid });
  await assert.rejects(share.taskForSharing(teammate, task.id), { status: 403 });
  const getTask = () => share.taskForSharing(requester, task.id);
  const first = await share.replaceTaskShare(requester, await getTask());
  const stale = await getTask();
  const second = await share.replaceTaskShare(requester, await getTask());
  assert.notEqual(first, second);
  await assert.rejects(store.saveTaskShare(requester.tid, stale, null), { status: 409 });
  await tasks.updateTask(requester, stale, { title: 'Review revised report', status: 'done', owner: requester.uid });
  assert.equal(await share.getSharedTask(first), null);
  assert.equal((await share.getSharedTask(second)).title, 'Review revised report');
  assert.deepEqual(await tasks.visibleTasks(teammate), []);

  const beforeRevoke = await getTask();
  await store.saveTaskShare(requester.tid, await getTask(), null);
  await tasks.updateTask(requester, beforeRevoke, { description: 'Revised instructions' });
  assert.equal(await share.getSharedTask(second), null);
  const last = await share.replaceTaskShare(requester, await getTask());
  await tasks.deleteTask(requester, task.id);
  assert.equal(await share.getSharedTask(last), null);
});
