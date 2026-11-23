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
after(() => rmSync(directory, { recursive: true, force: true }));

async function workspace(id) {
  const team = { id, name: 'Workspace', kind: 'team', members: [
    { userId: 'requester', role: 'member' }, { userId: 'teammate', role: 'owner' },
  ] };
  await store.saveTeam(team);
  return Promise.all(team.members.map(({ userId }) => tasks.ctxFor({ id: userId }, id, 'en')));
}

test('a private task link exposes only read-only details and grants no workspace visibility', async () => {
  const [requester, teammate] = await workspace('private-tasks');
  const task = await tasks.createTask(requester, { title: 'Review report', description: 'Compare the totals', due: '2026-11-27', status: 'progress' }, {
    source: { quote: 'Internal transcript' },
  });
  await tasks.commentOnTask(requester, task.id, 'Internal progress update');
  const token = await share.replaceTaskShare(requester, await share.taskForSharing(requester, task.id));
  assert.deepEqual(await share.getSharedTask(token), { title: task.title, description: task.description, due: task.due });
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
