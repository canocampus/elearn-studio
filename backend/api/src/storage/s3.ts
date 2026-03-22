import {
  S3Client,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { Readable } from 'stream'

function buildEndpoint(): string {
  const host = process.env.GARAGE_ENDPOINT ?? 'localhost'
  const port = process.env.GARAGE_PORT ?? '3900'
  const ssl  = process.env.GARAGE_USE_SSL === 'true'
  // H-05: validate host to prevent SSRF via malformed endpoint value
  if (!/^[a-zA-Z0-9._-]+$/.test(host)) {
    throw new Error(`Invalid GARAGE_ENDPOINT value: "${host}"`)
  }
  return `${ssl ? 'https' : 'http'}://${host}:${port}`
}

// C-02: fail loudly at startup if credentials are not configured
const accessKeyId     = process.env.GARAGE_ACCESS_KEY
const secretAccessKey = process.env.GARAGE_SECRET_KEY
if (!accessKeyId || !secretAccessKey) {
  throw new Error(
    'GARAGE_ACCESS_KEY and GARAGE_SECRET_KEY environment variables are required'
  )
}

export const s3Client = new S3Client({
  endpoint:        buildEndpoint(),
  region:          process.env.GARAGE_REGION ?? 'garage',
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,  // required for Garage (and any non-AWS S3-compatible store)
})

export const BUCKET = process.env.GARAGE_BUCKET ?? 'elearn-assets'

// ── Thin wrappers (routes depend on these, tests mock this module) ────────────

/** Upload a file buffer to the bucket. */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
  contentLength: number,
): Promise<void> {
  // H-01: validate contentLength matches buffer to prevent data corruption
  if (body.length !== contentLength) {
    throw new Error(
      `Content-Length mismatch: buffer is ${body.length} bytes but contentLength is ${contentLength}`
    )
  }
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    ContentLength: contentLength,
  }))
}

/** Download an object — returns a readable stream plus its stored metadata. */
export async function getObject(
  key: string,
): Promise<{ stream: Readable; contentType: string; contentLength: number | undefined }> {
  const result = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  return {
    stream:        result.Body as Readable,
    contentType:   result.ContentType ?? 'application/octet-stream',
    // H-02: do not default to 0 — undefined signals unknown length to the caller
    contentLength: result.ContentLength,
  }
}

/** Probe object existence/metadata without downloading the body. */
export async function statObject(
  key: string,
): Promise<{ contentType: string; contentLength: number | undefined }> {
  const result = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
  return {
    contentType:   result.ContentType ?? 'application/octet-stream',
    contentLength: result.ContentLength,
  }
}

/**
 * Verify that the bucket is accessible.
 * Called at startup and by the /health endpoint.
 * Bucket creation is handled by the garage-init Docker service — this function
 * only checks that the bucket already exists and the credentials are valid.
 */
export async function initStorage(): Promise<void> {
  // C-03: HeadBucketCommand confirms endpoint reachable, credentials valid, bucket exists
  await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }))
  console.log(`Connected to Garage storage — bucket: ${BUCKET} at ${buildEndpoint()}`)
}
