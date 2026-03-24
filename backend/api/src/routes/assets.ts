import express, { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { randomUUID } from 'crypto'
import path from 'path'
import { putObject, getPresignedUrl, statObject } from '../storage/s3'
import { logger } from '../lib/logger'

export const assetsRouter: express.Router = Router()

// ── SVG sanitization ──────────────────────────────────────────────────────────

// T154-004 fix: strip active content from SVG files on upload.
// SVGs are served as Content-Disposition: attachment, but we also sanitize at
// rest to prevent stored XSS if the content-disposition header is ever bypassed.
// Removes <script> elements, <foreignObject> (can embed HTML), and inline event
// handlers (on*="...") without requiring an external dependency.
function sanitizeSvg(buffer: Buffer): Buffer {
  let svg = buffer.toString('utf8')

  // Remove <script> ... </script> blocks (case-insensitive, with attributes)
  svg = svg.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')

  // Remove <foreignObject> blocks (can embed arbitrary HTML/JS)
  svg = svg.replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/gi, '')

  // Remove inline event handler attributes: onclick="...", onload="...", etc.
  svg = svg.replace(/\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')

  // Remove javascript: URIs in href / xlink:href / src attributes
  svg = svg.replace(/\s+(?:href|xlink:href|src)\s*=\s*(?:"[^"]*javascript:[^"]*"|'[^']*javascript:[^']*')/gi, '')

  return Buffer.from(svg, 'utf8')
}

// ── MIME / extension configuration ───────────────────────────────────────────

// Default allowlist. Override via ALLOWED_MIME_TYPES env var (comma-separated).
const DEFAULT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'application/pdf',
]

const ALLOWED_MIME_TYPES = new Set(
  process.env.ALLOWED_MIME_TYPES
    ? process.env.ALLOWED_MIME_TYPES.split(',').map((t) => t.trim()).filter(Boolean)
    : DEFAULT_MIME_TYPES,
)

// Canonical extensions per MIME type.
// Used to normalise the stored object name and prevent extension spoofing
// (e.g. uploading a file as photo.php with MIME image/jpeg).
const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg':      ['.jpg', '.jpeg'],
  'image/png':       ['.png'],
  'image/gif':       ['.gif'],
  'image/webp':      ['.webp'],
  'image/svg+xml':   ['.svg'],
  'image/bmp':       ['.bmp'],
  'video/mp4':       ['.mp4'],
  'video/webm':      ['.webm'],
  'audio/mpeg':      ['.mp3'],
  'audio/ogg':       ['.ogg'],
  'audio/wav':       ['.wav'],
  'application/pdf': ['.pdf'],
}

// Extensions that must be served as attachment (not inline) to prevent XSS.
// SVG can contain <script> tags; PDF can execute JavaScript via PDF engines.
const ATTACHMENT_EXTENSIONS = new Set(['.svg', '.pdf'])

// C-01: objectName must be UUID + explicitly whitelisted extension.
// Using a character range (\.[a-z0-9]{1,10}) would allow dangerous extensions
// like .phtml, .shtml, .php3 that browsers may execute.
// C-02 fix: no 'i' flag — objects are always stored as lowercase UUID + lowercase ext.
// Requests with uppercase chars intentionally fail (400) to prevent case-mismatch 404s.
const OBJECT_NAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpe?g|png|gif|webp|svg|bmp|mp4|webm|mp3|ogg|wav|pdf)$/

// ── Upload size configuration ─────────────────────────────────────────────────

const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_ASSET_SIZE_MB ?? '50', 10)
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

// ── Per-endpoint rate limiter ─────────────────────────────────────────────────

// Stricter per-user limit for uploads (expensive S3 writes).
// C-01 fix: key by req.user.sub only — requireAuth middleware guarantees it is set.
// Falling back to req.ip in Docker would map all users to the gateway IP, defeating
// the per-user limit.
const uploadLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  limit:           20,
  keyGenerator:    (req: Request) => req.user?.sub ?? 'unknown',
  standardHeaders: 'draft-7',
  legacyHeaders:   false,
  message:         { success: false, error: 'Too many upload requests, please try again later' },
})

// ── Multer configuration ──────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    // H-03: reject disallowed MIME types at upload time
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const err = new Error(`File type not allowed: ${file.mimetype}`) as Error & { code: string }
      err.code = 'MIME_NOT_ALLOWED'
      cb(err)
      return
    }
    cb(null, true)
  },
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function multerErrorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ success: false, error: `File exceeds the ${MAX_FILE_SIZE_MB} MB size limit` })
      return
    }
    res.status(400).json({ success: false, error: err.message })
    return
  }
  if (err instanceof Error) {
    if ((err as Error & { code?: string }).code === 'MIME_NOT_ALLOWED') {
      res.status(415).json({ success: false, error: err.message })
      return
    }
    res.status(400).json({ success: false, error: err.message })
    return
  }
  res.status(500).json({ success: false, error: 'Upload failed' })
}

/**
 * @openapi
 * /assets:
 *   post:
 *     summary: Upload an asset
 *     description: Multipart upload to Garage S3. Allowed types — jpeg, png, gif, webp, svg, mp4, webm, mp3, ogg, wav, pdf. Max 50 MB (configurable via MAX_ASSET_SIZE_MB env). Rate limited to 20 uploads per 15 min per user.
 *     tags: [Assets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Asset uploaded
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Asset' }
 *       400:
 *         description: No file provided
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       413:
 *         description: File exceeds size limit
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       415:
 *         description: MIME type not allowed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       429:
 *         description: Upload rate limit exceeded
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       503:
 *         description: Storage service unavailable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
// ── POST /assets — multipart upload → Garage, return URL ─────────────────────

// H-05 fix: reject obviously oversized requests before multer buffers the body into RAM.
// Content-Length is spoofable but gives an early exit for well-behaved clients without
// incurring memory cost. Multer's own limit catches spoofed lengths.
assetsRouter.post('/', uploadLimiter, (req, res, next) => {
  const cl = parseInt(req.headers['content-length'] ?? '', 10)
  if (!isNaN(cl) && cl > MAX_FILE_SIZE_BYTES) {
    res.status(413).json({ success: false, error: `File exceeds the ${MAX_FILE_SIZE_MB} MB size limit` })
    return
  }
  next()
}, upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file provided' })
    return
  }

  // T166: use canonical extension derived from MIME type to prevent extension spoofing.
  // If the original extension is acceptable for this MIME type, preserve it;
  // otherwise fall back to the first canonical extension.
  const originalExt = path.extname(req.file.originalname).toLowerCase()
  const allowedExts = MIME_TO_EXTENSIONS[req.file.mimetype] ?? []
  const ext = allowedExts.includes(originalExt) ? originalExt : (allowedExts[0] ?? '')
  const objectName = `${randomUUID()}${ext}`

  // T154-004 fix: sanitize SVG content before storing to strip active content
  const fileBuffer = req.file.mimetype === 'image/svg+xml'
    ? sanitizeSvg(req.file.buffer)
    : req.file.buffer

  try {
    await putObject(objectName, fileBuffer, req.file.mimetype, fileBuffer.length)
  } catch (err) {
    logger.error({ err }, 'Storage upload failed')
    res.status(503).json({ success: false, error: 'Storage service unavailable' })
    return
  }

  res.status(201).json({
    success: true,
    data: {
      url: `/assets/${objectName}`,
      objectName,
      originalName: req.file.originalname,
    },
  })
})

assetsRouter.use(multerErrorHandler)

/**
 * @openapi
 * /assets/{objectName}:
 *   get:
 *     summary: Retrieve an asset (redirects to pre-signed URL)
 *     description: Returns a 302 redirect to a time-limited Garage pre-signed URL. objectName must match UUID + whitelisted extension pattern. SVG and PDF are served with Content-Disposition attachment.
 *     tags: [Assets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: objectName
 *         required: true
 *         schema: { type: string, example: a1b2c3d4-e5f6-4789-abcd-ef0123456789.png }
 *     responses:
 *       302:
 *         description: Redirect to pre-signed asset URL
 *         headers:
 *           Location:
 *             schema: { type: string, format: uri }
 *       400:
 *         description: Invalid asset name
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       503:
 *         description: Storage service unavailable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
// ── GET /assets/:objectName — redirect to Garage pre-signed URL ───────────────
// H-04: auth is enforced by the global requireAuth middleware in app.ts (applied before
// all /assets routes). No explicit auth call needed here; the middleware guarantees
// req.user is populated before this handler runs.
//
// Switching from stream proxy to 302 redirect offloads bandwidth from the API
// server. The pre-signed URL is time-limited (1 hour) and signed with our
// Garage credentials — the client never receives raw credentials.
//
// Content-Disposition: attachment is encoded into the presigned URL for types
// that can execute code in the browser (SVG, PDF).
assetsRouter.get('/:objectName', async (req, res) => {
  const { objectName } = req.params

  // C-01: validate objectName against UUID + whitelisted-extension pattern
  if (!OBJECT_NAME_RE.test(objectName)) {
    res.status(400).json({ success: false, error: 'Invalid asset name' })
    return
  }

  const ext = path.extname(objectName).toLowerCase()
  const contentDisposition = ATTACHMENT_EXTENSIONS.has(ext) ? 'attachment' : undefined

  // T154-009 fix: derive canonical content-type from the whitelisted extension and
  // pass it as ResponseContentType so the presigned URL overrides any corrupted
  // metadata stored in Garage. This ensures clients always receive a trustworthy
  // Content-Type regardless of what Garage has recorded.
  const canonicalMime = Object.entries(MIME_TO_EXTENSIONS).find(([, exts]) =>
    exts.includes(ext)
  )?.[0]

  try {
    const presignedUrl = await getPresignedUrl(objectName, {
      contentDisposition,
      contentType: canonicalMime,
    })
    res.redirect(302, presignedUrl)
  } catch (err) {
    logger.error({ err }, 'Failed to generate presigned URL')
    res.status(503).json({ success: false, error: 'Storage service unavailable' })
  }
})

// statObject is exported for use by other routes (e.g. HEAD /assets/:objectName)
export { statObject }
