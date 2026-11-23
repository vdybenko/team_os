// TeamOS storage. S3 is the sole runtime backend when S3_BUCKET is set.
//
// Local files use the same relative paths as S3, plus generated Markdown indexes.
// Older explicitly configured directories are read in their original layout.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as s3 from './s3-records.js';

const defaultStorage = fileURLToPath(new URL('../storage', import.meta.url));
const formerDefault = fileURLToPath(new URL('../data', import.meta.url));
const legacyLayoutMarkers = ['users', 'teams', '.secret', '.signin-links'];
const usesLegacyLayout = (dir) => legacyLayoutMarkers.some((name) => fs.existsSync(path.join(dir, name)));
function emptyDirectory(dir) {
  const stat = fs.lstatSync(dir, { throwIfNoEntry: false });
  return !stat || (stat.isDirectory() && fs.readdirSync(dir).length === 0);
}

export const S3_RECORDS = s3.enabled;
const configuredStorage = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : defaultStorage;
const hasFormerDefault = configuredStorage === defaultStorage && usesLegacyLayout(formerDefault);
export const DATA_DIR = S3_RECORDS && hasFormerDefault && emptyDirectory(defaultStorage) ? formerDefault : configuredStorage;
const legacyLayout = usesLegacyLayout(DATA_DIR);

/* ---------------- low-level helpers ---------------- */

const SAFE_ID = /^[a-zA-Z0-9_-]{1,80}$/;
export function assertId(id, what = 'id') {
  if (typeof id !== 'string' || !SAFE_ID.test(id)) {
    const e = new Error(`Invalid ${what}`); e.status = 400; throw e;
  }
  return id;
}
export const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
export const now = () => new Date().toISOString();

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); }
function writeAtomic(file, content) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content, { mode: 0o600 });
  fs.renameSync(tmp, file);
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
function writeJson(file, obj) { writeAtomic(file, JSON.stringify(obj, null, 2) + '\n'); }
function readBytes(file) { try { return fs.readFileSync(file); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
function readText(file) { try { return fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
function rm(file) { try { fs.unlinkSync(file); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
function listFiles(dir, ext) {
  try { return fs.readdirSync(dir).filter((f) => f.endsWith(ext)).sort(); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}
function listDirs(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort(); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}
const rel = (from, to) => path.relative(path.dirname(from), to).split(path.sep).join('/');
const JSON_TYPE = 'application/json';
const MD_TYPE = 'text/markdown; charset=utf-8';
const PDF_TYPE = 'application/pdf';
// Write-once objects (source texts and files): an existing object is kept as it is.
async function writeOnce(key, body, type) {
  try { await s3.write(key, body, type); } catch (error) { if (error.status !== 409) throw error; }
}
async function eraseIfPresent(key, binary) {
  const object = binary ? await s3.bytes(key) : await s3.raw(key);
  if (object) await s3.erase(object);
}
const jsonBody = (record) => JSON.stringify(record, null, 2) + '\n';
const userSettings = 'settings/users/';
const teamRoot = 'records/primary/teams/';
const userRoot = 'records/primary/users/';
const userKey = (uid) => `${userSettings}${assertId(uid)}.json`;
const teamPrefix = (tid) => `${teamRoot}${assertId(tid)}/`;
const userTeamPrefix = (uid, tid) => `${userRoot}${assertId(uid)}/teams/${assertId(tid)}/`;
const teamKey = (tid) => teamPrefix(tid) + 'team.json';
const visionKey = (tid) => teamPrefix(tid) + 'vision.md';
const secretKey = 'settings/auth/session-secret';
const tokenPrefix = 'settings/auth/signin-links/';
const putJson = (key, record) => s3.put(key, record, jsonBody(record), JSON_TYPE);
const getJson = (key) => s3.get(key, JSON.parse);
const listJson = (prefix) => s3.list(prefix, '.json', JSON.parse);
const mdEsc = (s) => String(s ?? '').replace(/\r?\n/g, ' ').replace(/([\[\]])/g, '\\$1');

/* ---------------- paths ---------------- */

const P = {
  rootIndex: () => path.join(DATA_DIR, 'index.md'),
  secret: () => path.join(DATA_DIR, legacyLayout ? '.secret' : secretKey),
  users: () => path.join(DATA_DIR, legacyLayout ? 'users' : userRoot),
  teams: () => path.join(DATA_DIR, legacyLayout ? 'teams' : teamRoot),
  tokens: () => path.join(DATA_DIR, legacyLayout ? '.signin-links' : tokenPrefix),
  user: (uid) => path.join(P.users(), assertId(uid, 'user id')),
  userTeam: (uid, tid) => path.join(P.user(uid), 'teams', assertId(tid, 'team id')),
  team: (tid) => path.join(P.teams(), assertId(tid, 'team id')),
  profile: (uid) => legacyLayout ? path.join(P.user(uid), 'profile.json') : path.join(DATA_DIR, userKey(uid)),
};

export function initializeLocalStorage() {
  if (S3_RECORDS) return;
  if (hasFormerDefault && emptyDirectory(DATA_DIR)) {
    // Stage a complete copy before publishing it. The old store can still be
    // used explicitly and an interrupted copy cannot become the active store.
    const stage = fs.mkdtempSync(path.join(path.dirname(DATA_DIR), '.storage-migration-'));
    const copy = (source, key, filter) => {
      if (!fs.existsSync(source)) return;
      const target = path.join(stage, key);
      ensureDir(path.dirname(target));
      fs.cpSync(source, target, { recursive: true, filter });
    };
    const recordsOnly = (source) => path.basename(source) !== 'index.md';
    try {
      copy(path.join(formerDefault, '.secret'), secretKey);
      copy(path.join(formerDefault, '.signin-links'), tokenPrefix);
      copy(path.join(formerDefault, 'teams'), teamRoot, recordsOnly);
      for (const uid of listDirs(path.join(formerDefault, 'users'))) {
        const directory = path.join(formerDefault, 'users', uid);
        copy(path.join(directory, 'profile.json'), userKey(uid));
        const teams = `${userRoot}${assertId(uid)}/teams/`;
        copy(path.join(directory, 'teams'), teams, recordsOnly);
        for (const tid of listDirs(path.join(stage, teams))) {
          const knowledge = path.join(stage, teams, tid, 'knowledge');
          for (const name of listFiles(knowledge, '.md')) {
            const file = path.join(knowledge, name);
            const { meta, body } = fromMd(readText(file));
            if (meta.id && meta.scope === 'private' && meta.teamId !== tid) {
              writeAtomic(file, toMd({ ...meta, teamId: tid }, body));
            }
          }
        }
      }
      try { fs.renameSync(stage, DATA_DIR); }
      catch (error) {
        // A second process may have completed the same migration first.
        if (!['EEXIST', 'ENOTEMPTY'].includes(error.code) || emptyDirectory(DATA_DIR)) throw error;
      }
    } finally {
      fs.rmSync(stage, { recursive: true, force: true });
    }
    for (const team of localTeams()) {
      rebuildTeamIndex(team.id);
      for (const member of team.members) rebuildUserTeamIndex(member.userId, team.id);
    }
    for (const user of localUsers()) rebuildUserIndex(user.id);
  }
  rebuildRootIndex();
}

/* ---------------- markdown with JSON-valued front matter ---------------- */
// Front matter values are JSON literals, which are also valid YAML.

function toMd(meta, body) {
  const fm = Object.entries(meta).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
  return `---\n${fm}\n---\n\n${body.trim()}\n`;
}
function fromMd(text) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text || '');
  if (!m) return { meta: {}, body: text || '' };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':'); if (i < 0) continue;
    const k = line.slice(0, i).trim(), raw = line.slice(i + 1).trim();
    try { meta[k] = JSON.parse(raw); } catch { meta[k] = raw; }
  }
  return { meta, body: m[2].trim() };
}

/* ---------------- secret ---------------- */

let pendingSecret;

async function loadSecret() {
  const existing = await s3.raw(secretKey);
  if (existing) return existing.body.trim();
  const secret = crypto.randomBytes(32).toString('hex');
  try {
    await s3.write(secretKey, secret, 'text/plain');
    return secret;
  } catch (error) {
    if (error.status !== 409) throw error;
    const created = await s3.raw(secretKey);
    if (!created) throw error;
    return created.body.trim();
  }
}

export function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (S3_RECORDS) return pendingSecret ||= loadSecret().catch((error) => { pendingSecret = null; throw error; });
  let s = readText(P.secret());
  if (!s) { s = crypto.randomBytes(32).toString('hex'); writeAtomic(P.secret(), s); }
  return s.trim();
}

/* ---------------- users ---------------- */

const localUser = (uid) => readJson(P.profile(uid));
const localUsers = () => {
  const ids = legacyLayout ? listDirs(P.users()) : listFiles(path.join(DATA_DIR, userSettings), '.json').map((file) => file.slice(0, -5));
  return ids.map(localUser).filter(Boolean);
};
export const getUser = (uid) => S3_RECORDS ? getJson(userKey(uid)) : localUser(uid);
export const listUsers = () => S3_RECORDS ? listJson(userSettings) : localUsers();
export async function saveUser(u) {
  u.updatedAt = now();
  if (S3_RECORDS) return putJson(userKey(u.id), u);
  writeJson(P.profile(u.id), u);
  rebuildUserIndex(u.id);
  rebuildRootIndex();
  return u;
}

/* ---------------- teams ---------------- */

const localTeam = (tid) => readJson(path.join(P.team(tid), 'team.json'));
const localTeams = () => listDirs(P.teams()).map(localTeam).filter(Boolean);
export const getTeam = (tid) => S3_RECORDS ? getJson(teamKey(tid)) : localTeam(tid);
export async function listTeams() {
  if (!S3_RECORDS) return localTeams();
  const ids = (await s3.directories(teamRoot)).filter((id) => SAFE_ID.test(id));
  const teams = [];
  for (let i = 0; i < ids.length; i += 12) teams.push(...await Promise.all(ids.slice(i, i + 12).map(getTeam)));
  return teams.filter(Boolean);
}
export async function teamsOfUser(uid) { return (await listTeams()).filter((t) => t.members.some((m) => m.userId === uid)); }
export const initialVision = (team, lang = 'en') => (lang === 'uk'
  ? `# ${team.name} — vision\n\n## Місія\n\n_Опишіть, навіщо існує команда._\n\n## Як ми працюємо\n\n_Ритуали, домовленості, принципи._\n`
  : `# ${team.name} — vision\n\n## Mission\n\n_Describe why the team exists._\n\n## How we work\n\n_Rituals, agreements, principles._\n`);
export async function saveTeam(t) {
  t.updatedAt = now();
  if (S3_RECORDS) return putJson(teamKey(t.id), t);
  writeJson(path.join(P.team(t.id), 'team.json'), t);
  const vision = path.join(P.team(t.id), 'vision.md');
  if (!fs.existsSync(vision)) writeAtomic(vision, initialVision(t));
  for (const m of t.members) rebuildUserTeamIndex(m.userId, t.id);
  for (const m of t.members) rebuildUserIndex(m.userId);
  rebuildTeamIndex(t.id);
  rebuildRootIndex();
  return t;
}
export async function getVision(tid) {
  if (S3_RECORDS) {
    const object = await s3.raw(visionKey(tid));
    if (object) return object.body;
    const team = await getTeam(tid);
    return team ? initialVision(team) : '';
  }
  return readText(path.join(P.team(tid), 'vision.md')) || '';
}
export async function saveVision(tid, md) {
  const body = md.endsWith('\n') ? md : md + '\n';
  if (S3_RECORDS) {
    const current = await s3.raw(visionKey(tid));
    await s3.write(visionKey(tid), body, MD_TYPE, current?.etag);
    return;
  }
  writeAtomic(path.join(P.team(tid), 'vision.md'), body);
  rebuildTeamIndex(tid);
}

/* ---------------- one-time email links ---------------- */

const linkFile = (digest) => path.join(P.tokens(), assertId(digest) + '.json');
const linkKey = (digest) => tokenPrefix + assertId(digest) + '.json';
export async function createSigninLink(digest, record) {
  if (S3_RECORDS) return putJson(linkKey(digest), record);
  const file = linkFile(digest);
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, jsonBody(record), { flag: 'wx', mode: 0o600 });
}
export function getSigninLink(digest) {
  return S3_RECORDS ? getJson(linkKey(digest)) : readJson(linkFile(digest));
}
export async function consumeSigninLink(digest, record) {
  try {
    if (S3_RECORDS) await s3.remove(record);
    else fs.unlinkSync(linkFile(digest));
    return true;
  } catch (error) {
    if (error.status === 409 || error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function cleanupSigninLinks(now) {
  const digests = S3_RECORDS
    ? (await s3.keys(tokenPrefix, '.json')).map((key) => key.slice(tokenPrefix.length, -5))
    : listFiles(P.tokens(), '.json').map((file) => file.slice(0, -5));
  for (const digest of digests.filter((value) => /^[a-f0-9]{64}$/.test(value))) {
    const record = await getSigninLink(digest);
    if (record && record.expires <= now) await consumeSigninLink(digest, record);
  }
}

/* ---------------- OAuth records (MCP connectors) ---------------- */
// settings/oauth/<kind>/<id>.json — clients, grants, codes and pending authorization requests.

function settingsRecords(kind) {
  const prefix = `settings/oauth/${kind}/`;
  const file = (id) => path.join(DATA_DIR, prefix, assertId(id) + '.json');
  return {
    get: (id) => S3_RECORDS ? getJson(prefix + assertId(id) + '.json') : readJson(file(id)),
    async list() {
      if (S3_RECORDS) return listJson(prefix);
      const dir = path.join(DATA_DIR, prefix);
      return listFiles(dir, '.json').map((f) => readJson(path.join(dir, f))).filter(Boolean);
    },
    async save(record) {
      record.updatedAt = now();
      if (S3_RECORDS) return putJson(prefix + assertId(record.id) + '.json', record);
      writeJson(file(record.id), record);
      return record;
    },
    // Single-use consumption: true only for the caller that actually removed the record.
    async remove(record) {
      try {
        if (S3_RECORDS) await s3.remove(record);
        else fs.unlinkSync(file(record.id));
        return true;
      } catch (error) {
        if (error.status === 409 || error.code === 'ENOENT') return false;
        throw error;
      }
    },
  };
}
export const oauthClients = settingsRecords('clients');
export const oauthGrants = settingsRecords('grants');
export const oauthCodes = settingsRecords('codes');
export const oauthRequests = settingsRecords('requests');

/* ---------------- projects & hypotheses (team folder) ---------------- */

function collection(name) {
  const dir = (tid) => path.join(P.team(tid), name);
  const prefix = (tid) => teamPrefix(tid) + name + '/';
  const file = (id) => assertId(id) + '.json';
  const localList = (tid) => listFiles(dir(tid), '.json').map((f) => readJson(path.join(dir(tid), f))).filter(Boolean);
  return {
    localList,
    list: (tid) => S3_RECORDS ? listJson(prefix(tid)) : localList(tid),
    get: (tid, id) => S3_RECORDS ? getJson(prefix(tid) + file(id)) : readJson(path.join(dir(tid), file(id))),
    save(tid, obj) {
      obj.updatedAt = now();
      if (S3_RECORDS) return putJson(prefix(tid) + file(obj.id), obj);
      writeJson(path.join(dir(tid), file(obj.id)), obj);
      rebuildTeamIndex(tid);
      return obj;
    },
    remove(tid, obj) {
      if (S3_RECORDS) return s3.remove(obj);
      rm(path.join(dir(tid), file(obj.id)));
      rebuildTeamIndex(tid);
    },
  };
}
export const projects = collection('projects');
export const hypotheses = collection('hypotheses');
// Goals (Objective + Key Results) on every level: team, project and member. All of them are visible to the whole team.
export const goals = collection('goals');

/* ---------------- organizations ---------------- */
// records/primary/orgs/<orgId>/org.json — a container that groups teams. A team points to it with team.orgId.

const orgRoot = 'records/primary/orgs/';
const orgKey = (oid) => `${orgRoot}${assertId(oid)}/org.json`;
const orgFile = (oid) => path.join(DATA_DIR, orgKey(oid));
export const getOrg = (oid) => S3_RECORDS ? getJson(orgKey(oid)) : readJson(orgFile(oid));
export async function saveOrg(o) {
  o.updatedAt = now();
  if (S3_RECORDS) return putJson(orgKey(o.id), o);
  writeJson(orgFile(o.id), o);
  return o;
}

/* ---------------- tasks ---------------- */
// A task lives in the team folder when two or more team members take part in it
// (owner ≠ requester). Otherwise it is private and lives in that one member's folder.

export const isExternal = (who) => typeof who === 'string' && who.startsWith('ext:');
export function taskHolder(task) {
  const people = [...new Set([task.owner, task.requester].filter((x) => x && !isExternal(x)))];
  if (people.length >= 2) return { shared: true };
  return { shared: false, userId: people[0] || task.creator };
}
const sharedTaskDir = (tid) => path.join(P.team(tid), 'tasks');
const privateTaskDir = (uid, tid) => path.join(P.userTeam(uid, tid), 'tasks');

function localSharedTasks(tid) {
  const d = sharedTaskDir(tid);
  return listFiles(d, '.json').map((f) => readJson(path.join(d, f))).filter(Boolean);
}
function localPrivateTasks(uid, tid) {
  const d = privateTaskDir(uid, tid);
  return listFiles(d, '.json').map((f) => readJson(path.join(d, f))).filter(Boolean);
}
function taskFile(tid, task) {
  const h = taskHolder(task);
  return path.join(h.shared ? sharedTaskDir(tid) : privateTaskDir(h.userId, tid), `${assertId(task.id)}.json`);
}
function taskKey(tid, task) {
  const holder = taskHolder(task);
  const prefix = holder.shared ? teamPrefix(tid) : userTeamPrefix(holder.userId, tid);
  return prefix + 'tasks/' + assertId(task.id) + '.json';
}
export async function listTasksFor(tid, uid) {
  if (S3_RECORDS) {
    const [shared, personal] = await Promise.all([listJson(teamPrefix(tid) + 'tasks/'), listJson(userTeamPrefix(uid, tid) + 'tasks/')]);
    return [...shared.filter((t) => taskHolder(t).shared), ...personal.filter((t) => taskHolder(t).userId === uid)];
  }
  return [...localSharedTasks(tid), ...localPrivateTasks(uid, tid)];
}
export async function findTask(tid, id, uid) {
  assertId(id);
  if (S3_RECORDS) {
    const name = 'tasks/' + id + '.json';
    const shared = await getJson(teamPrefix(tid) + name);
    if (shared && taskHolder(shared).shared) return shared;
    const personal = uid ? await getJson(userTeamPrefix(uid, tid) + name) : null;
    return personal && taskHolder(personal).userId === uid ? personal : null;
  }
  const shared = readJson(path.join(sharedTaskDir(tid), `${id}.json`));
  if (shared) return shared;
  return uid ? readJson(path.join(privateTaskDir(uid, tid), `${id}.json`)) : null;
}
export async function saveTask(tid, task, previous) {
  task.updatedAt = now();
  if (S3_RECORDS) return putJson(taskKey(tid, task), task);
  const file = taskFile(tid, task);
  const old = previous ? taskFile(tid, previous) : file;
  // Local task edits can start before a link is regenerated. Keep the currently stored link.
  const current = readJson(old);
  if (current?.shareToken) task.shareToken = current.shareToken;
  else delete task.shareToken;
  if (old !== file) { rm(old); touchIndexesFor(tid, previous); }
  writeJson(file, task);
  touchIndexesFor(tid, task);
  return task;
}
export async function saveTaskShare(tid, task, token) {
  if (S3_RECORDS) {
    if (token) task.shareToken = token;
    else delete task.shareToken;
    await putJson(taskKey(tid, task), task);
    return;
  }
  const file = taskFile(tid, task);
  const current = readJson(file);
  if (!current || current.shareToken !== task.shareToken) {
    throw Object.assign(new Error('The record has changed. Refresh the page and try again.'), { status: 409 });
  }
  if (token) current.shareToken = token;
  else delete current.shareToken;
  writeJson(file, current);
}
export async function removeTask(tid, task) {
  if (S3_RECORDS) return s3.remove(task);
  rm(taskFile(tid, task)); touchIndexesFor(tid, task);
}
function touchIndexesFor(tid, task) {
  const h = taskHolder(task);
  if (h.shared) rebuildTeamIndex(tid); else rebuildUserTeamIndex(h.userId, tid);
}

/* ---------------- knowledge (Markdown) ---------------- */

const sharedKnDir = (tid) => path.join(P.team(tid), 'knowledge');
const privateKnDir = (uid, tid) => path.join(P.userTeam(uid, tid), 'knowledge');

function knToMd(k) {
  const { text, why, quote, ...meta } = k;
  let body = `# ${text}\n`;
  if (why) body += `\n**Why:** ${why}\n`;
  if (quote) body += `\n> ${String(quote).replace(/\n/g, '\n> ')}\n`;
  return toMd({ ...meta, why: why || undefined, quote: quote || undefined }, body);
}
function knFromMd(text) {
  const { meta, body } = fromMd(text);
  const title = /^#\s+(.+)$/m.exec(body);
  return { ...meta, text: title ? title[1].trim() : body.split('\n')[0] };
}
function listKnIn(dir) { return listFiles(dir, '.md').map((f) => knFromMd(readText(path.join(dir, f)))).filter((k) => k.id); }
function localSharedKnowledge(tid) { return listKnIn(sharedKnDir(tid)); }
function localPrivateKnowledge(uid, tid) { return listKnIn(privateKnDir(uid, tid)); }
function knFile(tid, k) { return path.join(k.scope === 'private' ? privateKnDir(k.author, tid) : sharedKnDir(tid), `${assertId(k.id)}.md`); }
function knowledgeKey(tid, k) {
  const prefix = k.scope === 'private' ? userTeamPrefix(k.author, tid) : teamPrefix(tid);
  return prefix + 'knowledge/' + assertId(k.id) + '.md';
}
export async function listKnowledgeFor(tid, uid) {
  if (S3_RECORDS) {
    const [shared, personal] = await Promise.all([
      s3.list(teamPrefix(tid) + 'knowledge/', '.md', knFromMd),
      s3.list(userTeamPrefix(uid, tid) + 'knowledge/', '.md', knFromMd),
    ]);
    return [...shared.filter((k) => k.scope === 'team'), ...personal.filter((k) => k.scope === 'private' && k.author === uid)];
  }
  return [...localSharedKnowledge(tid), ...localPrivateKnowledge(uid, tid)];
}
export async function findKnowledge(tid, id, uid) {
  assertId(id);
  if (S3_RECORDS) {
    const name = 'knowledge/' + id + '.md';
    const shared = await s3.get(teamPrefix(tid) + name, knFromMd);
    if (shared?.scope === 'team') return shared;
    const personal = uid ? await s3.get(userTeamPrefix(uid, tid) + name, knFromMd) : null;
    return personal?.scope === 'private' && personal.author === uid ? personal : null;
  }
  const t = readText(path.join(sharedKnDir(tid), `${id}.md`)) ?? (uid ? readText(path.join(privateKnDir(uid, tid), `${id}.md`)) : null);
  return t ? knFromMd(t) : null;
}
export async function saveKnowledge(tid, k, previous) {
  k.updatedAt = now();
  k.teamId = tid;
  if (S3_RECORDS) return s3.put(knowledgeKey(tid, k), k, knToMd(k), MD_TYPE);
  const file = knFile(tid, k);
  if (previous && knFile(tid, previous) !== file) { rm(knFile(tid, previous)); }
  writeAtomic(file, knToMd(k));
  rebuildTeamIndex(tid); rebuildUserTeamIndex(k.author, tid);
  return k;
}
export async function removeKnowledge(tid, k) {
  if (S3_RECORDS) return s3.remove(k);
  rm(knFile(tid, k)); rebuildTeamIndex(tid); rebuildUserTeamIndex(k.author, tid);
}

/* ---------------- inbox (user folder, per team) ---------------- */

const inboxDir = (uid, tid) => path.join(P.userTeam(uid, tid), 'inbox');
function localInbox(uid, tid) {
  const d = inboxDir(uid, tid);
  return listFiles(d, '.json').map((f) => readJson(path.join(d, f))).filter(Boolean).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
const inboxPrefix = (uid, tid) => userTeamPrefix(uid, tid) + 'inbox/';
export async function listInbox(uid, tid) {
  if (!S3_RECORDS) return localInbox(uid, tid);
  return (await listJson(inboxPrefix(uid, tid))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function getInboxItem(uid, tid, id) {
  const file = assertId(id) + '.json';
  return S3_RECORDS ? getJson(inboxPrefix(uid, tid) + file) : readJson(path.join(inboxDir(uid, tid), file));
}
export async function getInboxSource(uid, tid, id) {
  const file = assertId(id) + '.md';
  const text = S3_RECORDS ? (await s3.raw(inboxPrefix(uid, tid) + file))?.body : readText(path.join(inboxDir(uid, tid), file));
  return text == null ? '' : fromMd(text).body;
}
export async function saveInboxItem(uid, tid, item, sourceText) {
  item.updatedAt = now();
  const id = assertId(item.id);
  const source = sourceText === undefined ? undefined : toMd({ id, title: item.title, type: item.type, date: item.date, createdAt: item.createdAt }, sourceText);
  if (S3_RECORDS) {
    const prefix = inboxPrefix(uid, tid);
    if (source !== undefined) await s3.write(prefix + id + '.md', source, MD_TYPE);
    return putJson(prefix + id + '.json', item);
  }
  const d = inboxDir(uid, tid);
  if (source !== undefined) writeAtomic(path.join(d, id + '.md'), source);
  writeJson(path.join(d, id + '.json'), item);
  rebuildUserTeamIndex(uid, tid);
  return item;
}
// Original audio of a dictated item, kept next to its transcript (<id>.audio). Its type is stored on the item.
export async function saveInboxAudio(uid, tid, id, buf) {
  const file = assertId(id) + '.audio';
  if (S3_RECORDS) return void await s3.write(inboxPrefix(uid, tid) + file, buf, 'application/octet-stream');
  writeAtomic(path.join(inboxDir(uid, tid), file), buf);
}
export async function getInboxAudio(uid, tid, id) {
  const file = assertId(id) + '.audio';
  if (S3_RECORDS) return (await s3.bytes(inboxPrefix(uid, tid) + file))?.body || null;
  try { return fs.readFileSync(path.join(inboxDir(uid, tid), file)); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
// The original uploaded PDF of an inbox item, kept next to its extracted text (<id>.pdf).
export async function saveInboxFile(uid, tid, id, buf) {
  const file = assertId(id) + '.pdf';
  if (S3_RECORDS) return writeOnce(inboxPrefix(uid, tid) + file, buf, PDF_TYPE);
  writeAtomic(path.join(inboxDir(uid, tid), file), buf);
}
export async function getInboxFile(uid, tid, id) {
  const file = assertId(id) + '.pdf';
  return S3_RECORDS ? (await s3.bytes(inboxPrefix(uid, tid) + file))?.body || null : readBytes(path.join(inboxDir(uid, tid), file));
}
export async function removeInboxItem(uid, tid, item) {
  const id = assertId(item.id);
  if (S3_RECORDS) {
    const prefix = inboxPrefix(uid, tid);
    const source = await s3.raw(prefix + id + '.md');
    const audio = item.audio ? await s3.bytes(prefix + id + '.audio') : null;
    await s3.remove(item);
    if (source) await s3.erase(source);
    if (audio) await s3.erase(audio);
    if (item.file) await eraseIfPresent(prefix + id + '.pdf', true);
    return;
  }
  rm(path.join(inboxDir(uid, tid), id + '.json'));
  rm(path.join(inboxDir(uid, tid), id + '.md'));
  rm(path.join(inboxDir(uid, tid), id + '.audio'));
  rm(path.join(inboxDir(uid, tid), id + '.pdf'));
  rebuildUserTeamIndex(uid, tid);
}

/* ---------------- sources (knowledge base) ---------------- */
// A source is the original material — a transcript or a PDF — that tasks and knowledge were derived from.
// <id>.json holds the record, <id>.md the full text, <id>.pdf the original file (when there is one).
// Team sources live in the team folder; private ones in the author's folder for that team.

const sharedSrcDir = (tid) => path.join(P.team(tid), 'sources');
const privateSrcDir = (uid, tid) => path.join(P.userTeam(uid, tid), 'sources');
const srcDir = (tid, s) => (s.scope === 'private' ? privateSrcDir(s.author, tid) : sharedSrcDir(tid));
const srcPrefix = (tid, s) => (s.scope === 'private' ? userTeamPrefix(s.author, tid) : teamPrefix(tid)) + 'sources/';
const localSources = (dir) => listFiles(dir, '.json').map((f) => readJson(path.join(dir, f))).filter(Boolean);
const visibleSource = (s, uid) => s && (s.scope === 'team' || (s.scope === 'private' && s.author === uid));

export async function listSourcesFor(tid, uid) {
  const all = S3_RECORDS
    ? (await Promise.all([listJson(teamPrefix(tid) + 'sources/'), listJson(userTeamPrefix(uid, tid) + 'sources/')])).flat()
    : [...localSources(sharedSrcDir(tid)), ...localSources(privateSrcDir(uid, tid))];
  return all.filter((s) => visibleSource(s, uid)).sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : a.date < b.date ? 1 : -1));
}
export async function findSource(tid, id, uid) {
  const name = assertId(id) + '.json';
  const read = (prefix, dir) => (S3_RECORDS ? getJson(prefix + name) : readJson(path.join(dir, name)));
  const shared = await read(teamPrefix(tid) + 'sources/', sharedSrcDir(tid));
  if (shared?.scope === 'team') return shared;
  const personal = uid ? await read(userTeamPrefix(uid, tid) + 'sources/', privateSrcDir(uid, tid)) : null;
  return visibleSource(personal, uid) && personal.scope === 'private' ? personal : null;
}
// text and file are written only when the source is first created.
export async function saveSource(tid, src, { text, file } = {}) {
  src.updatedAt = now();
  src.teamId = tid;
  const id = assertId(src.id);
  const front = { id, title: src.title, kind: src.kind, date: src.date, author: src.author, scope: src.scope };
  if (S3_RECORDS) {
    const prefix = srcPrefix(tid, src);
    if (text !== undefined) await writeOnce(prefix + id + '.md', toMd(front, text), MD_TYPE);
    if (file) await writeOnce(prefix + id + '.pdf', file, PDF_TYPE);
    return putJson(prefix + id + '.json', src);
  }
  const dir = srcDir(tid, src);
  if (text !== undefined && !fs.existsSync(path.join(dir, id + '.md'))) writeAtomic(path.join(dir, id + '.md'), toMd(front, text));
  if (file && !fs.existsSync(path.join(dir, id + '.pdf'))) { ensureDir(dir); fs.writeFileSync(path.join(dir, id + '.pdf'), file, { mode: 0o600 }); }
  writeJson(path.join(dir, id + '.json'), src);
  if (src.scope === 'private') rebuildUserTeamIndex(src.author, tid); else rebuildTeamIndex(tid);
  return src;
}
export async function getSourceText(tid, src) {
  const name = assertId(src.id) + '.md';
  const text = S3_RECORDS ? (await s3.raw(srcPrefix(tid, src) + name))?.body : readText(path.join(srcDir(tid, src), name));
  return text == null ? '' : fromMd(text).body;
}
export async function getSourceFile(tid, src) {
  const name = assertId(src.id) + '.pdf';
  return S3_RECORDS ? (await s3.bytes(srcPrefix(tid, src) + name))?.body || null : readBytes(path.join(srcDir(tid, src), name));
}
// Original recording of a dictated source (<id>.audio), written once like the PDF.
export async function saveSourceAudio(tid, src, buf) {
  const name = assertId(src.id) + '.audio';
  if (S3_RECORDS) return writeOnce(srcPrefix(tid, src) + name, buf, 'application/octet-stream');
  const file = path.join(srcDir(tid, src), name);
  if (!fs.existsSync(file)) writeAtomic(file, buf);
}
export async function getSourceAudio(tid, src) {
  const name = assertId(src.id) + '.audio';
  return S3_RECORDS ? (await s3.bytes(srcPrefix(tid, src) + name))?.body || null : readBytes(path.join(srcDir(tid, src), name));
}
export async function removeSource(tid, src) {
  const id = assertId(src.id);
  if (S3_RECORDS) {
    const prefix = srcPrefix(tid, src);
    await s3.remove(src);
    await eraseIfPresent(prefix + id + '.md');
    if (src.file) await eraseIfPresent(prefix + id + '.pdf', true);
    if (src.audio) await eraseIfPresent(prefix + id + '.audio', true);
    return;
  }
  const dir = srcDir(tid, src);
  for (const ext of ['.json', '.md', '.pdf', '.audio']) rm(path.join(dir, id + ext));
  if (src.scope === 'private') rebuildUserTeamIndex(src.author, tid); else rebuildTeamIndex(tid);
}

/* ---------------- assistant conversations ---------------- */

const assistantDir = (uid, tid) => path.join(P.userTeam(uid, tid), 'assistant');
const assistantPrefix = (uid, tid) => userTeamPrefix(uid, tid) + 'assistant/';
const chatFilename = (id) => assertId(id, 'chat id') + '.json';
export function getAssistantChat(uid, tid, id) {
  const file = chatFilename(id);
  return S3_RECORDS ? getJson(assistantPrefix(uid, tid) + file) : readJson(path.join(assistantDir(uid, tid), file));
}
export async function listAssistantChats(uid, tid) {
  const dir = assistantDir(uid, tid);
  const chats = S3_RECORDS
    ? await listJson(assistantPrefix(uid, tid))
    : listFiles(dir, '.json').map((file) => readJson(path.join(dir, file))).filter(Boolean);
  return chats.map(({ id, title, updatedAt }) => ({ id, title, updatedAt })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function saveAssistantChat(uid, tid, chat) {
  chat.updatedAt = now();
  const file = chatFilename(chat.id);
  if (S3_RECORDS) return putJson(assistantPrefix(uid, tid) + file, chat);
  writeJson(path.join(assistantDir(uid, tid), file), chat);
  return chat;
}

/* ---------------- index.md generation ---------------- */

const STATUS = { open: 'Open', progress: 'In progress', waiting: 'Waiting', done: 'Done', cancelled: 'Cancelled' };
const HSTATUS = { draft: 'Draft', testing: 'Testing', validated: 'Validated', invalidated: 'Invalidated' };
const PSTATUS = { active: 'Active', paused: 'Paused', done: 'Completed', archived: 'Archived' };

function nameOf(who, users) {
  if (!who) return '—';
  if (isExternal(who)) return `${who.slice(4)} (external)`;
  return users[who]?.name || who;
}
function userMap() { return Object.fromEntries(localUsers().map((u) => [u.id, u])); }

function taskLine(file, dir, t, users) {
  return `- [${mdEsc(t.title)}](${rel(file, path.join(dir, t.id + '.json'))}) — ${STATUS[t.status] || t.status} · ${mdEsc(nameOf(t.owner, users))} → ${mdEsc(nameOf(t.requester, users))}${t.due ? ` · due ${t.due}` : ''}`;
}
function knLine(file, dir, k) {
  return `- [${mdEsc(k.text)}](${rel(file, path.join(dir, k.id + '.md'))}) — ${k.type}${k.supersededBy ? ' · superseded' : ''} · ${k.date || ''}`;
}

export function rebuildTeamIndex(tid) {
  const team = localTeam(tid); if (!team) return;
  const dir = P.team(tid), file = path.join(dir, 'index.md'), users = userMap();
  const prj = projects.localList(tid), hyp = hypotheses.localList(tid);
  const L = [];
  L.push(`# ${team.name}`, '', `> Entry point to the team's shared space. Generated automatically ${now()} — do not edit by hand.`, '');
  L.push(`- [team.json](team.json) — settings, members, roles`, `- [vision.md](vision.md) — Team vision`, '');
  L.push('## Members', '');
  for (const m of team.members) L.push(`- ${mdEsc(users[m.userId]?.name || m.userId)} (${m.role}) — personal folder: [${m.userId}](${rel(file, path.join(P.userTeam(m.userId, tid), 'index.md'))})`);
  L.push('', `## Projects (${prj.length})`, '');
  for (const p of prj) {
    L.push(`- [${mdEsc(p.name)}](${rel(file, path.join(dir, 'projects', p.id + '.json'))}) — ${PSTATUS[p.status] || p.status}`);
    for (const h of hyp.filter((h) => h.project === p.id)) L.push(`  - hypothesis [${mdEsc(h.statement || h.if)}](${rel(file, path.join(dir, 'hypotheses', h.id + '.json'))}) — ${HSTATUS[h.status] || h.status}`);
  }
  const gl = goals.localList(tid);
  if (gl.length) {
    const kr = new Map(gl.flatMap((g) => (g.keyResults || []).map((k) => [k.id, k])));
    L.push('', `## Goals (${gl.length})`, '');
    for (const g of gl.sort((a, b) => (a.period < b.period ? 1 : -1))) {
      const parent = g.alignedTo?.[0] && kr.get(g.alignedTo[0].krId);
      L.push(`- [${mdEsc(g.title)}](goals/${g.id}.json) — ${g.level}${g.project ? ' · ' + mdEsc(prj.find((p) => p.id === g.project)?.name || '') : ''} · ${g.period}${parent ? ` · contributes to “${mdEsc(parent.title)}”` : ''}`);
      for (const k of g.keyResults || []) L.push(`  - KR ${mdEsc(k.title)}: ${k.current} / ${k.target}${k.unit ? ' ' + mdEsc(k.unit) : ''}`);
    }
  }
  const orphan = hyp.filter((h) => !prj.some((p) => p.id === h.project));
  if (orphan.length) { L.push('', '### Hypotheses without a project', ''); for (const h of orphan) L.push(`- [${mdEsc(h.statement || h.if)}](hypotheses/${h.id}.json) — ${HSTATUS[h.status]}`); }
  const tasks = localSharedTasks(tid), kn = localSharedKnowledge(tid);
  L.push('', `## Shared tasks (${tasks.length})`, '');
  for (const s of Object.keys(STATUS)) {
    const ts = tasks.filter((t) => t.status === s); if (!ts.length) continue;
    L.push(`### ${STATUS[s]}`, ''); for (const t of ts) L.push(taskLine(file, path.join(dir, 'tasks'), t, users)); L.push('');
  }
  L.push(`## Shared knowledge base (${kn.length})`, '');
  for (const k of kn.sort((a, b) => (a.date < b.date ? 1 : -1))) L.push(knLine(file, path.join(dir, 'knowledge'), k));
  const src = localSources(sharedSrcDir(tid));
  L.push('', `## Sources (${src.length})`, '');
  for (const s of src) L.push(srcLine(path.join(dir, 'sources'), file, s));
  writeAtomic(file, L.join('\n') + '\n');
}
function srcLine(dir, file, s) {
  const pdf = fs.existsSync(path.join(dir, s.id + '.pdf')) ? ` · [PDF](${rel(file, path.join(dir, s.id + '.pdf'))})` : '';
  return `- [${mdEsc(s.title)}](${rel(file, path.join(dir, s.id + '.md'))}) — ${s.kind} · ${s.date || ''}${pdf}`;
}

export function rebuildUserTeamIndex(uid, tid) {
  const team = localTeam(tid); if (!team || !localUser(uid)) return;
  const dir = P.userTeam(uid, tid), file = path.join(dir, 'index.md'), users = userMap();
  const inbox = localInbox(uid, tid);
  const L = [];
  L.push(`# ${users[uid]?.name || uid} · ${team.name}`, '', `> Personal folder in the team. Visible only to its owner. Generated automatically ${now()}.`, '');
  L.push(`- The team's shared space: [${mdEsc(team.name)}](${rel(file, path.join(P.team(tid), 'index.md'))})`, '');
  L.push(`## Inbox (${inbox.length})`, '');
  for (const i of inbox) L.push(`- [${mdEsc(i.title)}](inbox/${i.id}.json) — ${i.status} · ${i.date || ''}${fs.existsSync(path.join(dir, 'inbox', i.id + '.md')) ? ` · [source](inbox/${i.id}.md)` : ''}`);
  const tasks = localPrivateTasks(uid, tid), kn = localPrivateKnowledge(uid, tid);
  L.push('', `## Private tasks (${tasks.length})`, '');
  for (const t of tasks) L.push(taskLine(file, path.join(dir, 'tasks'), t, users));
  L.push('', `## Private knowledge (${kn.length})`, '');
  for (const k of kn) L.push(knLine(file, path.join(dir, 'knowledge'), k));
  const src = localSources(privateSrcDir(uid, tid));
  L.push('', `## Private sources (${src.length})`, '');
  for (const s of src) L.push(srcLine(path.join(dir, 'sources'), file, s));
  writeAtomic(file, L.join('\n') + '\n');
}

export function rebuildUserIndex(uid) {
  const u = localUser(uid); if (!u) return;
  const file = path.join(P.user(uid), 'index.md');
  const L = [`# ${u.name}`, '', `> Entry point to all of the user's files. Generated automatically ${now()}.`, '', `- [profile.json](${rel(file, P.profile(uid))}) — ${mdEsc(u.email)}`, '', '## Teams', ''];
  for (const t of localTeams().filter((team) => team.members.some((m) => m.userId === uid))) {
    const role = t.members.find((m) => m.userId === uid)?.role;
    L.push(`- **${mdEsc(t.name)}** (${t.kind === 'personal' ? 'personal space' : role}) — my files: [teams/${t.id}](teams/${t.id}/index.md) · shared: [${t.id}](${rel(file, path.join(P.team(t.id), 'index.md'))})`);
  }
  writeAtomic(file, L.join('\n') + '\n');
}

export function rebuildRootIndex() {
  const file = P.rootIndex();
  const L = ['# TeamOS data', '', `> Storage root. Generated automatically ${now()}.`, '', '## Teams', ''];
  for (const t of localTeams()) L.push(`- [${mdEsc(t.name)}](${rel(file, path.join(P.team(t.id), 'index.md'))})${t.kind === 'personal' ? ' — personal space' : ''}`);
  L.push('', '## Users', '');
  for (const u of localUsers()) L.push(`- [${mdEsc(u.name)}](${rel(file, path.join(P.user(u.id), 'index.md'))})`);
  writeAtomic(file, L.join('\n') + '\n');
}

/* ---------------- offline migration ---------------- */

export async function migrateToS3({ from }) {
  if (!S3_RECORDS) throw new Error('S3_BUCKET must be set.');
  if (!['files', 'split'].includes(from)) throw new Error('Select the source layout: files or split.');

  const counts = { users: 0, teams: 0, projects: 0, goals: 0, hypotheses: 0, tasks: 0, knowledge: 0, privateTasks: 0, privateKnowledge: 0, visions: 0, inbox: 0, sources: 0, chats: 0, signinLinks: 0 };
  async function copy(key, body, type) {
    if (body === null) return false;
    try { await s3.write(key, body, type); }
    catch (error) { if (error.status !== 409) throw error; }
    const stored = await s3.raw(key);
    if (!stored || stored.body !== body || stored.metadata.from || stored.metadata.to) {
      throw new Error(`Migration stopped at conflicting object: ${key}`);
    }
    return true;
  }
  async function copyFolder(dir, prefix, extension, type, count) {
    for (const file of listFiles(dir, extension)) {
      if (file === 'index.md') continue;
      assertId(file.slice(0, -extension.length));
      const body = readText(path.join(dir, file));
      if (await copy(prefix + file, body, type)) counts[count]++;
    }
  }

  if (!process.env.SESSION_SECRET) await copy(secretKey, readText(P.secret()), 'text/plain');
  for (const file of listFiles(P.tokens(), '.json')) {
    if (!/^[a-f0-9]{64}\.json$/.test(file)) continue;
    const body = readText(path.join(P.tokens(), file));
    if (body && JSON.parse(body).expires > Date.now() && await copy(tokenPrefix + file, body, JSON_TYPE)) counts.signinLinks++;
  }

  const users = localUsers();
  for (const user of users) {
    if (await copy(userKey(user.id), readText(P.profile(user.id)), JSON_TYPE)) counts.users++;
  }
  for (const oid of listDirs(path.join(DATA_DIR, orgRoot)).filter((id) => SAFE_ID.test(id))) {
    await copy(orgKey(oid), readText(orgFile(oid)), JSON_TYPE);
  }
  const teams = localTeams();
  for (const team of teams) {
    const tid = team.id;
    const dir = P.team(tid);
    const prefix = teamPrefix(tid);
    if (await copy(teamKey(tid), readText(path.join(dir, 'team.json')), JSON_TYPE)) counts.teams++;
    if (await copy(visionKey(tid), readText(path.join(dir, 'vision.md')), MD_TYPE)) counts.visions++;
    await copyFolder(path.join(dir, 'projects'), prefix + 'projects/', '.json', JSON_TYPE, 'projects');
    await copyFolder(path.join(dir, 'hypotheses'), prefix + 'hypotheses/', '.json', JSON_TYPE, 'hypotheses');
    await copyFolder(path.join(dir, 'goals'), prefix + 'goals/', '.json', JSON_TYPE, 'goals');

    for (const user of users) {
      const personal = userTeamPrefix(user.id, tid);
      await copyFolder(inboxDir(user.id, tid), personal + 'inbox/', '.json', JSON_TYPE, 'inbox');
      await copyFolder(inboxDir(user.id, tid), personal + 'inbox/', '.md', MD_TYPE, 'sources');
      await copyFolder(assistantDir(user.id, tid), personal + 'assistant/', '.json', JSON_TYPE, 'chats');
    }

    const records = [
      { name: 'tasks', file: '.json', type: JSON_TYPE, decode: JSON.parse, encode: (task, body) => body, keyOf: taskKey, privateCount: 'privateTasks',
        local: () => [...localSharedTasks(tid), ...users.flatMap((user) => localPrivateTasks(user.id, tid))],
        localFile: taskFile },
      { name: 'knowledge', file: '.md', type: MD_TYPE, decode: knFromMd, encode: (knowledge, body) => knowledge.scope === 'private' ? knToMd({ ...knowledge, teamId: tid }) : body, keyOf: knowledgeKey, privateCount: 'privateKnowledge',
        local: () => [...localSharedKnowledge(tid), ...users.flatMap((user) => localPrivateKnowledge(user.id, tid))],
        localFile: knFile },
    ];
    for (const { name, file, type, decode, encode, keyOf, privateCount, local, localFile } of records) {
      const shared = prefix + name + '/';
      if (from === 'files') {
        for (const value of local()) {
          const key = keyOf(tid, value);
          if (await copy(key, encode(value, readText(localFile(tid, value))), type)) {
            counts[name]++;
            if (!key.startsWith(shared)) counts[privateCount]++;
          }
        }
        continue;
      }
      for (const key of await s3.keys(shared, file)) {
        if (key === shared + 'index.md') continue;
        const source = await s3.raw(key);
        if (!source) continue;
        if (source.metadata.to) {
          await s3.resumeMove(source, type);
          continue;
        }
        const value = decode(source.body);
        const target = keyOf(tid, value);
        if (target !== key) {
          const moved = await s3.move(source, target, encode(value, source.body), type);
          if ((await s3.raw(target))?.body !== moved.body || await s3.raw(key)) {
            throw new Error(`Migration could not verify moved object: ${key}`);
          }
        }
      }
      counts[name] += (await s3.keys(shared, file)).filter((key) => key !== shared + 'index.md').length;
      for (const user of users) {
        const personal = userTeamPrefix(user.id, tid) + name + '/';
        const count = (await s3.keys(personal, file)).filter((key) => key !== personal + 'index.md').length;
        counts[name] += count;
        counts[privateCount] += count;
      }
    }
  }
  return counts;
}
