import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3'
import { Readable } from 'stream'
import { config } from '../config'

let _client: S3Client | null = null

function getClient(): S3Client {
  if (_client) return _client
  const { endpoint, port, useSsl, region, accessKey, secretKey } = config.garage
  _client = new S3Client({
    endpoint:       `${useSsl ? 'https' : 'http'}://${endpoint}:${port}`,
    region,
    credentials: {
      accessKeyId:     accessKey!,
      secretAccessKey: secretKey!,
    },
    forcePathStyle: true,
  })
  return _client
}

const BUCKET = config.garage.bucket

/** Upload a Buffer to the bucket. */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await getClient().send(new PutObjectCommand({
    Bucket:        BUCKET,
    Key:           key,
    Body:          body,
    ContentType:   contentType,
    ContentLength: body.length,
  }))
}

/** Download an object and return it as a Buffer. */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const result = await getClient().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const stream = result.Body as Readable
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

/** Download a JSON object and parse it. */
export async function getObjectJson<T>(key: string): Promise<T> {
  const buf = await getObjectBuffer(key)
  return JSON.parse(buf.toString('utf8')) as T
}

/** List all object keys under a given prefix. */
export async function listObjects(prefix: string): Promise<string[]> {
  const keys: string[] = []
  let continuationToken: string | undefined

  do {
    const result = await getClient().send(new ListObjectsV2Command({
      Bucket:            BUCKET,
      Prefix:            prefix,
      ContinuationToken: continuationToken,
    }))
    for (const obj of result.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key)
    }
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined
  } while (continuationToken)

  return keys
}

/** Check that the bucket is reachable and credentials are valid. */
export async function checkStorage(): Promise<void> {
  await getClient().send(new HeadBucketCommand({ Bucket: BUCKET }))
}

/**
 * Check whether an object exists. Returns true on success; false on NotFound.
 * Non-404 errors (network, auth) propagate so the caller can map them correctly
 * (e.g. 503 vs 404 in HTTP responses).
 */
export async function headObject(key: string): Promise<boolean> {
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch (err: unknown) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } }
    if (e?.name === 'NotFound' || e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) {
      return false
    }
    throw err
  }
}

/** Delete a single object by key. */
export async function deleteObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

/**
 * Bulk-delete up to 1000 keys in a single call (S3 / Garage multi-object delete).
 * Chunks larger lists into 1000-key batches. Empty input is a no-op.
 */
export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  const client = getClient()
  const BATCH = 1000
  for (let i = 0; i < keys.length; i += BATCH) {
    const chunk = keys.slice(i, i + BATCH)
    await client.send(new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: chunk.map(Key => ({ Key })), Quiet: true },
    }))
  }
}
