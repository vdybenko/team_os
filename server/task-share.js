import crypto from 'node:crypto';
import * as store from './store.js';
import { canEditTask, fail, getTaskFor, isMember } from './domain.js';

async function shareKey() {
  return crypto.createHmac('sha256', await store.sessionSecret()).update('TeamOS task share v1').digest();
}

export async function taskForSharing(c, id) {
  const task = await getTaskFor(c, id);
  if (!canEditTask(c, task)) fail(403, 'Only the requester can manage the share link.');
  return task;
}

export async function replaceTaskShare(c, task) {
  // The link can locate its task without exposing the workspace, member or task IDs.
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', await shareKey(), iv);
  const locator = JSON.stringify([c.tid, task.id, c.uid]);
  const encrypted = Buffer.concat([cipher.update(locator, 'utf8'), cipher.final()]);
  const token = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
  await store.saveTaskShare(c.tid, task, token);
  return token;
}

export async function getSharedTask(token) {
  // Three storage IDs of up to 80 ASCII characters, plus the IV and authentication tag.
  if (!/^[A-Za-z0-9_-]{40,380}$/.test(token)) return null;
  const key = await shareKey();
  let tid, id, uid;
  try {
    const bytes = Buffer.from(token, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const locator = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]);
    [tid, id, uid] = JSON.parse(locator.toString('utf8'));
  } catch { return null; }

  const task = await store.findTask(tid, id, uid);
  if (task?.shareToken !== token || !canEditTask({ uid }, task)) return null;
  const team = await store.getTeam(tid);
  if (!team || !isMember(team, uid)) return null;
  return { title: task.title, description: task.description, due: task.due };
}
