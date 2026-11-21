import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const { S3_BUCKET: bucket, S3_REGION: region, S3_OWNER_ACCOUNT: owner } = process.env;
export const enabled = Boolean(bucket);
const versions = new WeakMap();
let client;

async function send(Command, input) {
  if (!region || !/^\d{12}$/.test(owner || '')) throw new Error('Set S3_REGION and S3_OWNER_ACCOUNT.');
  client ||= new S3Client({
    region,
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
    requestHandler: { connectionTimeout: 3000, requestTimeout: 10000 },
  });
  return client.send(new Command({ Bucket: bucket, ExpectedBucketOwner: owner, ...input }));
}

async function readObject(Command, key) {
  try {
    return await send(Command, { Key: key });
  } catch (error) {
    if (error.$metadata?.httpStatusCode === 404) return null;
    // Scoped ListBucket access can make a missing object return 403.
    if (error.$metadata?.httpStatusCode === 403) {
      const page = await send(ListObjectsV2Command, { Prefix: key, MaxKeys: 1 });
      if (page.Contents?.[0]?.Key !== key) return null;
    }
    throw error;
  }
}

export async function raw(key) {
  const response = await readObject(GetObjectCommand, key);
  if (!response) return null;
  return { key, etag: response.ETag, body: await response.Body.transformToString(), metadata: response.Metadata || {} };
}

export async function get(key, decode) {
  const object = await raw(key);
  if (!object || object.metadata.to) return null;
  if (object.metadata.from) {
    const source = await readObject(HeadObjectCommand, object.metadata.from);
    if (source?.Metadata?.move !== object.metadata.move || source.Metadata.to !== key) return null;
  }
  const value = decode(object.body);
  if (value && typeof value === 'object') versions.set(value, object);
  return value;
}

async function listPages(prefix, delimiter, directoriesOnly = false) {
  const entries = [];
  let continuation;
  do {
    const page = await send(ListObjectsV2Command, { Prefix: prefix, Delimiter: delimiter, ContinuationToken: continuation });
    entries.push(...(directoriesOnly ? page.CommonPrefixes || [] : page.Contents || []));
    continuation = page.NextContinuationToken;
  } while (continuation);
  return entries;
}

export async function keys(prefix, extension = '') {
  return (await listPages(prefix)).map(({ Key }) => Key).filter((key) => key.endsWith(extension));
}

export async function directories(prefix) {
  return (await listPages(prefix, '/', true)).map(({ Prefix }) => Prefix.slice(prefix.length, -1));
}

export async function list(prefix, extension, decode) {
  const files = (await listPages(prefix, '/')).flatMap(({ Key }) => Key ? [Key] : []);
  // Delimiter listings report objects and common prefixes in separate fields.
  const records = [];
  const matching = files.filter((key) => key.endsWith(extension));
  for (let i = 0; i < matching.length; i += 12) {
    records.push(...await Promise.all(matching.slice(i, i + 12).map((key) => get(key, decode))));
  }
  return records.filter(Boolean);
}

function conflict(error) {
  if (![404, 409, 412].includes(error.$metadata?.httpStatusCode)) throw error;
  throw Object.assign(new Error('The record has changed. Refresh the page and try again.'), { status: 409 });
}

export async function write(key, body, contentType, etag, metadata = {}) {
  try {
    const result = await send(PutObjectCommand, {
      Key: key, Body: body, ContentType: contentType, ServerSideEncryption: 'AES256',
      ...(etag ? { IfMatch: etag } : { IfNoneMatch: '*' }),
      Metadata: metadata,
    });
    return { key, body, etag: result.ETag, metadata };
  } catch (error) { conflict(error); }
}

export async function erase({ key, etag }) {
  if (!etag) throw new Error('Cannot delete an S3 object without its ETag.');
  try { await send(DeleteObjectCommand, { Key: key, IfMatch: etag }); }
  catch (error) { conflict(error); }
}

const moves = new Set();
const moveConflict = () => Object.assign(new Error('The record is being moved. Refresh the page and try again.'), { status: 409 });

async function finishMove(target, contentType) {
  const source = await raw(target.metadata.from);
  if (source?.metadata.move !== target.metadata.move || source.metadata.to !== target.key) throw moveConflict();
  const completed = await write(target.key, target.body, contentType, target.etag);
  try { await erase(source); }
  catch (error) { if (error.status !== 409) console.error('[storage] Move marker cleanup failed:', error.name); }
  return completed;
}

export async function resumeMove(source, contentType) {
  const target = await raw(source.metadata.to);
  if (target?.metadata.from === source.key && target.metadata.move === source.metadata.move) {
    return finishMove(target, contentType);
  }
  if (target && !target.metadata.from && !target.metadata.to) {
    await erase(source);
    return target;
  }
  throw moveConflict();
}

export async function move(source, key, body, contentType) {
  // Prepare the destination, then atomically replace the old payload with a
  // marker. Readers only see staged data after that marker commits this move.
  if (moves.has(source.key)) throw moveConflict();
  moves.add(source.key);
  try {
    const staged = await raw(key);
    if (staged && staged.metadata.from !== source.key && staged.metadata.to !== source.key) throw moveConflict();
    const operation = randomUUID();
    const target = await write(key, body, contentType, staged?.etag, { from: source.key, move: operation });
    // Put the operation ID in the body as well, so each marker has its own ETag.
    await write(source.key, operation, 'text/plain', source.etag, { to: key, move: operation });
    return await finishMove(target, contentType);
  } finally { moves.delete(source.key); }
}

export async function put(key, record, body, contentType) {
  let source = versions.get(record);
  if (source?.metadata.from) source = await finishMove(source, contentType);
  const object = source && source.key !== key
    ? await move(source, key, body, contentType)
    : await write(key, body, contentType, source?.etag);
  versions.set(record, object);
  return record;
}

export async function remove(record) {
  const source = versions.get(record);
  if (!source) throw new Error('Cannot delete an S3 record without its version.');
  await erase(source);
  if (source.metadata.from) {
    const marker = await raw(source.metadata.from);
    if (marker?.metadata.move === source.metadata.move && marker.metadata.to === source.key) await erase(marker);
  }
}
