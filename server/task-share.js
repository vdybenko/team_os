import crypto from 'node:crypto';
import * as store from './store.js';
import { canEditTask, fail, getTaskFor, isMember, nameOf, today } from './domain.js';
import { render, tr } from './i18n.js';

const sharedHistoryMessages = new Set([
  'Created manually', 'Created via {app}', 'Created from “{title}”, confirmed by {name}',
  'owner: {from} → {to}', 'deadline → {due}', 'Mentioned again in “{title}”', 'Mentioned again in “{title}”: “{quote}”',
]);
// Older history stores only the rendered text. Match the supported non-status events in both languages.
const sharedLegacyHistory = /^(?:Created manually$|Створено вручну$|Created (?:from|via) |Створено (?:з|через) |(?:owner|виконавець): |(?:deadline|дедлайн) → |Mentioned again in |Згадано ще раз у )/;

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

export async function getSharedTask(token, lang = 'en') {
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

  const names = new Map();
  const displayName = (person) => {
    // Someone who left the team is shown as a deleted user, not by name.
    if (!names.has(person)) names.set(person, person && !person.startsWith('ext:') && !isMember(team, person) ? tr(lang, 'Deleted user') : nameOf(person));
    return names.get(person);
  };
  const visibleHistory = (task.history || []).filter((entry) => entry.msg ? sharedHistoryMessages.has(entry.msg.key) : sharedLegacyHistory.test(entry.text));
  const [owner, requester, project, hypothesis, comments, history] = await Promise.all([
    displayName(task.owner), displayName(task.requester),
    task.project ? store.projects.get(tid, task.project) : null,
    task.hypothesis ? store.hypotheses.get(tid, task.hypothesis) : null,
    Promise.all((task.comments || []).map(async ({ author, at, text }) => ({ author: await displayName(author), at, text }))),
    Promise.all(visibleHistory.map(async (entry) => ({
      author: await displayName(entry.by), at: entry.at,
      text: entry.msg ? render(lang, entry.msg) : entry.text,
      source: entry.sourceMsg ? render(lang, entry.sourceMsg) : entry.source,
    }))),
  ]);
  const urgent = task.urgent ?? Boolean(task.due && (Date.parse(task.due) - Date.parse(today())) / 86_400_000 <= (team.settings?.urgentDays ?? 2));
  const source = task.source && { title: task.source.itemTitle, timestamp: task.source.ts, quote: task.source.quote };
  return {
    title: task.title, description: task.description, due: task.due, owner, requester, urgent, important: Boolean(task.important),
    project: project?.name ?? null, hypothesis: hypothesis?.then || hypothesis?.statement || null, source: source || null, comments, history,
  };
}
