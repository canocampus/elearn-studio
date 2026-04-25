/**
 * Simulation import and screenshot proxy routes. (T024.3, T024.4)
 *
 * POST /courses/:courseId/simulations/import
 *   Fetches recordings/{sessionId}/session.json from Garage,
 *   converts raw SimStep[] → AuthoredSimStep[] with default hotspot, returns SimConfig.
 *
 * GET /simulations/screenshot?key=recordings/...
 *   Proxies a screenshot PNG/JPEG from Garage so the authoring UI never needs direct
 *   access to Garage credentials.
 */

import { Router, Request, Response } from 'express'
import { getObject } from '../storage/s3'
import { Readable } from 'stream'
import { logger } from '../lib/logger'
import type {
  AuthoredSimStep,
  SimConfig,
  SimHotspot,
  RawSimStep,
  RawSession,
} from '../types/simulation'

export const simulationsRouter: Router = Router()

// ---------------------------------------------------------------------------
// POST /courses/:courseId/simulations/import
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /courses/{courseId}/simulations/import:
 *   post:
 *     summary: Import a simulation recording into a course
 *     description: Fetches recordings/{sessionId}/session.json from Garage, converts RawSimStep[] to AuthoredSimStep[] with default hotspots, and returns a SimConfig.
 *     tags: [Simulations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId: { type: string, pattern: '^[a-zA-Z0-9_-]+$', example: session-abc123 }
 *     responses:
 *       200:
 *         description: SimConfig generated from recording
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/SimConfig' }
 *       400:
 *         description: Missing or invalid courseId / sessionId
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       404:
 *         description: Session recording not found in storage
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       422:
 *         description: Session file is corrupted (JSON parse error)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       500:
 *         description: Storage error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
simulationsRouter.post(
  '/courses/:courseId/simulations/import',
  async (req: Request, res: Response): Promise<void> => {
    const { courseId } = req.params
    const { sessionId } = req.body as { sessionId?: string }

    if (!courseId || typeof courseId !== 'string') {
      res.status(400).json({ success: false, error: 'courseId is required' })
      return
    }
    // H-03: whitelist validation — sessionId must be UUID-safe (alphanumeric + hyphens only)
    if (!sessionId || typeof sessionId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      res.status(400).json({ success: false, error: 'sessionId is required and must be alphanumeric' })
      return
    }

    const key = `recordings/${sessionId}/session.json`
    let session: RawSession
    try {
      const { stream } = await getObject(key)
      // H-04: handle stream errors to avoid unhandled promise rejections
      const chunks: Buffer[] = []
      await new Promise<void>((resolve, reject) => {
        (stream as Readable).on('error', reject)
        ;(stream as Readable).on('data', (chunk: unknown) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array))
        })
        ;(stream as Readable).on('end', resolve)
      })
      // M-02 (from review): distinguish JSON parse errors from storage errors
      try {
        session = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as RawSession
      } catch (parseErr) {
        logger.error({ err: parseErr, sessionId }, 'JSON parse error for simulation session')
        res.status(422).json({ success: false, error: 'Session file is corrupted' })
        return
      }
    } catch (err: unknown) {
      const name = (err as { name?: string }).name ?? ''
      if (name === 'NoSuchKey' || name === 'NotFound') {
        res.status(404).json({ success: false, error: `Session '${sessionId}' not found` })
        return
      }
      logger.error({ err, sessionId }, 'getObject error loading simulation session')
      res.status(500).json({ success: false, error: 'Failed to load session from storage' })
      return
    }

    const steps: AuthoredSimStep[] = session.steps.map(
      (raw: RawSimStep, i: number): AuthoredSimStep => {
        // Default hotspot: 80×40 rectangle centred on the captured click coordinates.
        // The author can drag/resize in HotspotCanvas.
        const hotspot: SimHotspot = deriveDefaultHotspot(raw)
        return {
          id: raw.id ?? `step-${i}`,
          order: i,
          description: raw.description ?? generateDescription(raw, i),
          instruction: '',
          hint: '',
          correctFeedback: 'Correct!',
          incorrectFeedback: 'Try again.',
          demoDelay: 1500,
          maxAttempts: -1,
          screenshotKey: raw.screenshotKey,
          screenshotUrl: `/simulations/screenshot?key=${encodeURIComponent(raw.screenshotKey)}`,
          hotspot,
          // TD-014.33 (F1): seed the interaction contract. The recorder only
          // captures click events — 'hover' / 'type' are author-only choices
          // toggled later via StepForm. Omitting this field before .33 left
          // the frontend union type violated at runtime (undefined where the
          // discriminant was expected) and the select default-value match
          // path in StepForm silently papered over it. `expectedText` stays
          // absent by design; it only applies to 'type' steps.
          interactionType: 'click',
        }
      },
    )

    const simConfig: SimConfig = {
      mode: 'practice',
      passingScore: 80,
      steps,
    }

    res.status(200).json({ success: true, data: simConfig })
  },
)

// ---------------------------------------------------------------------------
// GET /simulations/screenshot?key=<objectKey>
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /simulations/screenshot:
 *   get:
 *     summary: Proxy a simulation screenshot from Garage
 *     description: Streams a screenshot PNG/JPEG from Garage so the authoring UI never needs direct Garage credentials. Key must start with recordings/ and end with .png or .jpeg.
 *     tags: [Simulations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: key
 *         required: true
 *         schema: { type: string, example: recordings/session-abc123/step-1.png }
 *     responses:
 *       200:
 *         description: Screenshot image
 *         content:
 *           image/png:
 *             schema: { type: string, format: binary }
 *           image/jpeg:
 *             schema: { type: string, format: binary }
 *       400:
 *         description: Missing key parameter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       403:
 *         description: Key outside allowed recordings/ prefix or path traversal attempt
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       404:
 *         description: Screenshot not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       500:
 *         description: Storage error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
simulationsRouter.get(
  '/simulations/screenshot',
  async (req: Request, res: Response): Promise<void> => {
    const key = req.query['key']

    if (!key || typeof key !== 'string') {
      res.status(400).json({ success: false, error: 'key query parameter is required' })
      return
    }

    // Security: only allow keys under the recordings/ prefix (screenshots only).
    // CRITICAL: also block path traversal — reject any key containing ".." segments.
    if (
      !key.startsWith('recordings/') ||
      !key.match(/\.(png|jpe?g)$/i) ||
      key.includes('..')
    ) {
      res.status(403).json({ success: false, error: 'Forbidden key' })
      return
    }

    try {
      const { stream, contentType, contentLength } = await getObject(key)
      res.set('Content-Type', contentType ?? 'image/png')
      res.set('Cache-Control', 'private, max-age=3600')
      if (contentLength !== undefined) {
        res.set('Content-Length', String(contentLength))
      }
      ;(stream as Readable).pipe(res)
    } catch (err: unknown) {
      const name = (err as { name?: string }).name ?? ''
      if (name === 'NoSuchKey' || name === 'NotFound') {
        res.status(404).json({ success: false, error: 'Screenshot not found' })
        return
      }
      logger.error({ err, key }, 'Screenshot proxy error')
      res.status(500).json({ success: false, error: 'Failed to retrieve screenshot' })
    }
  },
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CANVAS_W = 640
const CANVAS_H = 360
const HOTSPOT_W = 80
const HOTSPOT_H = 40

function deriveDefaultHotspot(raw: RawSimStep): SimHotspot {
  // Use captured click coordinates if available, else centre the hotspot on canvas
  const cx = typeof raw.x === 'number' ? Math.round(raw.x * CANVAS_W) : CANVAS_W / 2
  const cy = typeof raw.y === 'number' ? Math.round(raw.y * CANVAS_H) : CANVAS_H / 2
  return {
    x: Math.max(0, cx - HOTSPOT_W / 2),
    y: Math.max(0, cy - HOTSPOT_H / 2),
    width: HOTSPOT_W,
    height: HOTSPOT_H,
    tolerance: 10,
  }
}

function generateDescription(raw: RawSimStep, index: number): string {
  if (raw.type === 'click' && raw.targetText) return `Click "${raw.targetText}"`
  if (raw.type === 'click') return `Step ${index + 1}: Click`
  if (raw.type === 'input' && raw.value) return `Type "${raw.value}"`
  return `Step ${index + 1}`
}
