import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const { S3_BUCKET: bucket, S3_REGION: region, S3_OWNER_ACCOUNT: owner } = process.env;
export const enabled = Boolean(bucket);
const versions = new WeakMap();
const prefix = 'records/primary/teams/';
let client;
const collectionKey = (team, collection) => `${prefix}${team}/${collection}/`;

async function send(Command, input) {
  if (!region || !/^\d{12}$/.test(owner || '')) throw new Error('Set S3_REGION and S3_OWNER_ACCOUNT.');
  client ||= new S3Client({ region, requestHandler: { connectionTimeout: 3000, requestTimeout: 10000 } });
  return client.send(new Command({ Bucket: bucket, ExpectedBucketOwner: owner, ...input }));
}

async function read(key, decode) {
  try {
    const response = await send(GetObjectCommand, { Key: key });
    const record = decode(await response.Body.transformToString());
    versions.set(record, response.ETag);
    return record;
  } catch (error) {
    if (error.$metadata?.httpStatusCode === 404) return null;
    // A prefix-scoped ListBucket permission can make a missing key return 403.
    if (error.$metadata?.httpStatusCode === 403) {
      const listed = await send(ListObjectsV2Command, { Prefix: key, MaxKeys: 1 });
      if (listed.Contents?.[0]?.Key !== key) return null;
    }
    throw error;
  }
}

export async function list(team, collection, extension, decode) {
  const keyPrefix = collectionKey(team, collection);
  const records = [];
  let continuation;
  do {
    const page = await send(ListObjectsV2Command, { Prefix: keyPrefix, ContinuationToken: continuation });
    const keys = (page.Contents || []).map(({ Key }) => Key).filter((key) => key.endsWith(extension));
    for (let i = 0; i < keys.length; i += 12) {
      records.push(...await Promise.all(keys.slice(i, i + 12).map((key) => read(key, decode))));
    }
    continuation = page.NextContinuationToken;
  } while (continuation);
  return records.filter(Boolean);
}

export const get = (team, collection, file, decode) => read(`${collectionKey(team, collection)}${file}`, decode);

function conflict(error) {
  if (![409, 412].includes(error.$metadata?.httpStatusCode)) throw error;
  throw Object.assign(new Error('Запис уже змінився. Онови сторінку й повтори дію.'), { status: 409 });
}

export async function put(team, collection, file, record, body, contentType) {
  const etag = versions.get(record);
  try {
    const result = await send(PutObjectCommand, {
      Key: `${collectionKey(team, collection)}${file}`, Body: body,
      ContentType: contentType, ServerSideEncryption: 'AES256',
      ...(etag ? { IfMatch: etag } : { IfNoneMatch: '*' }),
    });
    versions.set(record, result.ETag);
    return record;
  } catch (error) { conflict(error); }
}

export async function remove(team, collection, file, record) {
  const etag = versions.get(record);
  if (!etag) throw new Error('Cannot delete an S3 record without its version.');
  try {
    await send(DeleteObjectCommand, { Key: `${collectionKey(team, collection)}${file}`, IfMatch: etag });
  } catch (error) { conflict(error); }
}
