import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { once } from 'node:events';
import { after, test } from 'node:test';
import { S3Client } from '@aws-sdk/client-s3';

Object.assign(process.env, { S3_BUCKET: 'test-bucket', S3_REGION: 'eu-central-1', S3_OWNER_ACCOUNT: '123456789012', SESSION_SECRET: 'test-session-secret', PORT: '0', TEAMOS_HOST: '127.0.0.1' });
const objects = new Map();
let sequence = 0;
const putFixture = (key, value) => objects.set(key, { body: JSON.stringify(value), etag: `"${++sequence}"`, metadata: {} });
putFixture('settings/users/user1.json', { id: 'user1', email: 'user@example.test', name: 'User', lang: 'en' });
putFixture('records/primary/teams/team1/team.json', { id: 'team1', name: 'Legacy team', kind: 'team', members: [{ userId: 'user1', role: 'owner' }] });
putFixture('records/primary/teams/team1/projects/project1.json', { id: 'project1', name: 'Project', owner: 'user1', goals: [{ id: 'goal1', goal: 'Launch', metric: 'Users', current: '1', target: '10' }] });
const originalSend = S3Client.prototype.send;
S3Client.prototype.send = async function (command) {
  const { Key: key, Prefix: prefix = '', Delimiter: delimiter, IfMatch, IfNoneMatch, Body, Metadata } = command.input;
  const missing = () => { throw Object.assign(new Error('Not found'), { $metadata: { httpStatusCode: 404 } }); };
  switch (command.constructor.name) {
    case 'GetObjectCommand': {
      const object = objects.get(key); if (!object) return missing();
      return { ETag: object.etag, Metadata: object.metadata, Body: { transformToString: async () => object.body, transformToByteArray: async () => Buffer.from(object.body) } };
    }
    case 'ListObjectsV2Command': {
      const keys = [...objects.keys()].filter((k) => k.startsWith(prefix));
      const direct = [], dirs = new Set();
      for (const k of keys) { const rest = k.slice(prefix.length); const i = delimiter ? rest.indexOf(delimiter) : -1; if (i >= 0) dirs.add(prefix + rest.slice(0, i + 1)); else direct.push({ Key: k }); }
      return { Contents: direct, CommonPrefixes: [...dirs].map((Prefix) => ({ Prefix })) };
    }
    case 'PutObjectCommand': {
      const old = objects.get(key);
      if ((IfNoneMatch === '*' && old) || (IfMatch && old?.etag !== IfMatch)) throw Object.assign(new Error('Conflict'), { $metadata: { httpStatusCode: 412 } });
      const etag = `"${++sequence}"`; objects.set(key, { body: String(Body), etag, metadata: Metadata || {} }); return { ETag: etag };
    }
    default: throw new Error(`Unexpected S3 command: ${command.constructor.name}`);
  }
};
const { server } = await import('../server/index.js');
if (!server.listening) await once(server, 'listening');
after(async () => { S3Client.prototype.send = originalSend; await new Promise((resolve) => server.close(resolve)); });
const payload = Buffer.from(JSON.stringify({ uid: 'user1', exp: Date.now() + 60000 })).toString('base64url');
const signature = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url');
const base = `http://127.0.0.1:${server.address().port}`;
const get = (url) => fetch(base + url, { headers: { Cookie: `sid=${payload}.${signature}` } });

test('authenticated startup migrates a legacy workspace and its goals on S3', async () => {
  const meResponse = await get('/api/me');
  assert.equal(meResponse.status, 200, await meResponse.clone().text());
  const me = await meResponse.json();
  assert.equal(me.user.id, 'user1');
  assert.equal(me.teams.find((t) => t.id === 'team1').orgId, me.orgs[0].id);
  assert.ok(objects.has(`records/primary/orgs/${me.orgs[0].id}/org.json`));
  const stateResponse = await get('/api/teams/team1/state');
  assert.equal(stateResponse.status, 200, await stateResponse.clone().text());
  const state = await stateResponse.json();
  assert.equal(state.goals.find((g) => g.id === 'goal1').title, 'Launch');
  assert.ok(objects.has('records/primary/teams/team1/goals/goal1.json'));
  const again = await get('/api/me');
  assert.equal(again.status, 200);
  assert.equal((await again.json()).orgs[0].id, me.orgs[0].id);
});

test('explicit migration plans without writes, applies and can be repeated', async () => {
  putFixture('records/primary/teams/team2/team.json', { id: 'team2', name: 'Older team', kind: 'team', members: [{ userId: 'user1', role: 'owner' }] });
  putFixture('records/primary/teams/team2/projects/project2.json', { id: 'project2', name: 'Older project', owner: 'user1', goals: [{ id: 'goal2', goal: 'Grow', metric: 'Users', current: '3', target: '20' }] });
  const { migrateOkr } = await import('../server/migrate-okr.js');
  const before = [...objects.entries()].map(([key, value]) => [key, { ...value }]);
  assert.deepEqual(await migrateOkr(), { teams: 2, organizationsToCreate: 1, projectsWithLegacyGoals: 1, legacyGoals: 1 });
  assert.deepEqual([...objects.entries()], before);
  assert.equal((await migrateOkr({ apply: true })).legacyGoals, 1);
  assert.ok(objects.has('records/primary/teams/team2/goals/goal2.json'));
  assert.deepEqual(await migrateOkr({ apply: true }), { teams: 2, organizationsToCreate: 0, projectsWithLegacyGoals: 0, legacyGoals: 0 });
});
