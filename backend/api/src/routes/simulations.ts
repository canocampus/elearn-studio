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
        console.error('[simulations] JSON parse error for session:', sessionId, parseErr)
        res.status(422).json({ success: false, error: 'Session file is corrupted' })
        return
      }
    } catch (err: unknown) {
      const name = (err as { name?: string }).name ?? ''
      if (name === 'NoSuchKey' || name === 'NotFound') {
        res.status(404).json({ success: false, error: `Session '${sessionId}' not found` })
        return
      }
      console.error('[simulations] getObject error:', err)
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
        }
      },
    )

    const simConfig: SimConfig = {
      sessionId,
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
      console.error('[simulations] screenshot proxy error:', err)
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
