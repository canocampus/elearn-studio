import {
  S3Client,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Readable } from 'stream'
import { logger } from '../lib/logger'

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
// T154-008 fix: validate key format so bad values are caught at startup, not at first request.
// Garage access keys begin with 'GK' followed by 22 alphanumeric chars (26 total).
// Secret keys are 64 lowercase hex characters.
const accessKeyId     = process.env.GARAGE_ACCESS_KEY
const secretAccessKey = process.env.GARAGE_SECRET_KEY
if (!accessKeyId || !secretAccessKey) {
  throw new Error(
    'GARAGE_ACCESS_KEY and GARAGE_SECRET_KEY environment variables are required'
  )
}
if (!/^GK[A-Za-z0-9]{22,}$/.test(accessKeyId)) {
  throw new Error(
    `GARAGE_ACCESS_KEY format invalid — expected 'GK' followed by alphanumeric characters (got "${accessKeyId}")`
  )
}
if (!/^[0-9a-f]{64}$/.test(secretAccessKey)) {
  throw new Error(
    'GARAGE_SECRET_KEY format invalid — expected 64 lowercase hex characters'
  )
}

export const s3Client = new S3Client({
  endpoint:        buildEndpoint(),
  region:          process.env.GARAGE_REGION ?? 'garage',
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,  // required for Garage (and any non-AWS S3-compatible store)
})

export const BUCKET = process.env.GARAGE_BUCKET ?? 'elearn-assets'

// ── Public-facing client for pre-signed URL generation ────────────────────────
// If S3_PUBLIC_ENDPOINT is configured, generated URLs will use that host so
// they are reachable from client browsers (the internal GARAGE_ENDPOINT may
// only be accessible within Docker's network).
const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT
const publicS3Client = publicEndpoint
  ? new S3Client({
      endpoint:       publicEndpoint,
      region:         process.env.GARAGE_REGION ?? 'garage',
      credentials:    { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    })
  : s3Client

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
 * Generate a time-limited pre-signed GET URL for an object.
 *
 * @param key                  Object key in the bucket.
 * @param options.contentDisposition  Passed as ResponseContentDisposition — use
 *                             'attachment' to force browser download for types
 *                             that could otherwise execute (SVG, PDF).
 * @param options.contentType  Passed as ResponseContentType — overrides the stored
 *                             Content-Type header, guarding against corrupted metadata
 *                             (T154-009). Pass the canonical MIME type derived from
 *                             the object extension so clients always receive a
 *                             trustworthy Content-Type.
 * @param expiresIn            URL validity in seconds (default: 3600).
 */
export async function getPresignedUrl(
  key: string,
  options?: { contentDisposition?: string; contentType?: string },
  expiresIn = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket:                     BUCKET,
    Key:                        key,
    ResponseContentDisposition: options?.contentDisposition,
    ResponseContentType:        options?.contentType,
  })
  return getSignedUrl(publicS3Client, command, { expiresIn })
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
  logger.info({ bucket: BUCKET, endpoint: buildEndpoint() }, 'Connected to Garage storage')
}
