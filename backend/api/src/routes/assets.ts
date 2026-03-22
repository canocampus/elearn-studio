import express, { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { randomUUID } from 'crypto'
import path from 'path'
import { putObject, getObject, statObject } from '../storage/s3'
import { apiKeyAuth } from '../middleware/auth'

export const assetsRouter: express.Router = Router()

// H-03: allowlist safe MIME types only
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'application/pdf',
])

// Types safe to serve inline (no Content-Disposition: attachment needed).
// M-01: SVG excluded — SVG can contain executable JavaScript (script tags, event handlers).
// SVG files are served as attachment to prevent stored XSS.
const INLINE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
])

// C-01: objectName must be UUID + explicitly whitelisted extension.
// Using a character range (\.[a-z0-9]{1,10}) would allow dangerous extensions
// like .phtml, .shtml, .php3 that browsers may execute.
const OBJECT_NAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpe?g|png|gif|webp|svg|mp4|webm|mp3|ogg|wav|pdf)$/i

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    // H-03: reject disallowed MIME types at upload time
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error(`File type not allowed: ${file.mimetype}`))
      return
    }
    cb(null, true)
  },
})

// Multer error → 400 (file type rejected, size exceeded, etc.)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function multerErrorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof multer.MulterError || err instanceof Error) {
    res.status(400).json({ success: false, error: err.message })
    return
  }
  res.status(500).json({ success: false, error: 'Upload failed' })
}

// POST /assets — multipart upload → Garage, return URL
assetsRouter.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file provided' })
    return
  }

  const ext = path.extname(req.file.originalname).toLowerCase()
  const objectName = `${randomUUID()}${ext}`

  // H-03: catch storage errors and return 503 instead of letting Express crash
  try {
    await putObject(objectName, req.file.buffer, req.file.mimetype, req.file.size)
  } catch (err) {
    console.error('Storage upload failed:', err)
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

// GET /assets/:objectName — proxy from Garage
// T154-001: require API key auth to prevent unauthenticated asset access
assetsRouter.get('/:objectName', apiKeyAuth, async (req, res) => {
  const { objectName } = req.params

  // C-01: validate objectName against UUID + whitelisted-extension pattern
  if (!OBJECT_NAME_RE.test(objectName)) {
    res.status(400).json({ success: false, error: 'Invalid asset name' })
    return
  }

  try {
    const { stream, contentType, contentLength } = await getObject(objectName)

    // Serve non-inline types as attachment to prevent stored XSS
    if (!INLINE_MIME_TYPES.has(contentType)) {
      res.setHeader('Content-Disposition', 'attachment')
    }

    res.setHeader('Content-Type', contentType)
    // H-02: only set Content-Length when value is known (avoid "0 bytes" responses)
    if (contentLength !== undefined) {
      res.setHeader('Content-Length', String(contentLength))
    }
    stream.pipe(res)
  } catch (err: unknown) {
    // H-04: differentiate 404 (not found) from 5xx (storage failure)
    const s3Err = err as { name?: string; $metadata?: { httpStatusCode?: number } }
    const httpStatus = s3Err.$metadata?.httpStatusCode
    if (
      s3Err.name === 'NoSuchKey' ||
      s3Err.name === 'NotFound' ||
      httpStatus === 404
    ) {
      res.status(404).json({ success: false, error: 'Asset not found' })
    } else {
      console.error('Storage retrieval failed:', err)
      res.status(503).json({ success: false, error: 'Storage service unavailable' })
    }
  }
})

// statObject is exported for use by other routes (e.g. HEAD /assets/:objectName)
export { statObject }
