import type { Router as ExpressRouter } from 'express'
import { Router, Request, Response } from 'express'
import { config } from '../config'
import {
  startRecording,
  stopRecording,
  manualCapture,
  getLiveScreenshot,
  activeBrowserCount,
} from '../recorder/browser'
import { getObjectJson, putObject, listObjects, headObject, deleteObjects } from '../storage/s3'
import type { Session, SessionSummary } from '../recorder/types'

export const recorderRouter: ExpressRouter = Router()

// ── M-01: SessionId format validation ─────────────────────────────────────────

/** Session IDs: alphanumeric and hyphens only (UUID-like, no path traversal). */
const SESSION_ID_PATTERN = /^[a-z0-9-]+$/i

/**
 * Validate that sessionId matches the expected format (alphanumeric + hyphens).
 * Prevents path traversal and special character injection in S3 keys.
 * Returns an error string if invalid, or null if OK.
 */
function validateSessionId(sessionId: string): string | null {
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length === 0) {
    return 'sessionId is required and must be a non-empty string'
  }
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    return 'sessionId must contain only alphanumeric characters and hyphens'
  }
  return null
}

// ── C-02: SSRF origin validation ──────────────────────────────────────────────

const PRIVATE_IPV4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/

/**
 * Validate that the URL is safe to navigate to with Playwright.
 * Returns an error string if invalid, or null if OK.
 */
function validateRecordingUrl(raw: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return 'url must be a valid URL'
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'url must use http or https protocol'
  }

  const hostname = parsed.hostname.toLowerCase()

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  ) {
    return 'url must not target localhost'
  }

  const m = hostname.match(PRIVATE_IPV4)
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    if (
      a === 10 ||                          // 10.0.0.0/8
      a === 127 ||                         // 127.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) ||           // 192.168.0.0/16
      (a === 169 && b === 254)              // 169.254.0.0/16 link-local
    ) {
      return 'url must not target private IP ranges'
    }
  }

  return null
}

// ── H-01: robust S3 error classification ─────────────────────────────────────

function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as Record<string, unknown>
  if (e['name'] === 'NoSuchKey') return true
  if ((e['$metadata'] as Record<string, unknown>)?.['httpStatusCode'] === 404) return true
  return false
}

function isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as Record<string, unknown>
  const code = e['code']
  return code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT'
}

// ── Routes ────────────────────────────────────────────────────────────────────

/** POST /recorder/start — begin a new recording session */
recorderRouter.post('/start', async (req: Request, res: Response) => {
  const { url, title } = req.body as { url?: string; title?: string }

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'url is required' })
    return
  }

  // H-02: field length limits
  if (url.length > 2048) {
    res.status(400).json({ error: 'url must not exceed 2048 characters' })
    return
  }
  if (title !== undefined && (typeof title !== 'string' || title.length > 256)) {
    res.status(400).json({ error: 'title must be a string of at most 256 characters' })
    return
  }

  // C-02: SSRF origin validation (replaces bare `new URL(url)` syntax check)
  const urlError = validateRecordingUrl(url)
  if (urlError) {
    res.status(400).json({ error: urlError })
    return
  }

  if (activeBrowserCount() >= config.recorder.maxBrowsers) {
    res.status(429).json({ error: 'Maximum concurrent recording sessions reached' })
    return
  }

  try {
    const session = await startRecording(url, title)
    res.status(201).json({ sessionId: session.id, status: 'recording', startedAt: session.startedAt })
  } catch (err) {
    console.error('[recorder] start failed:', err)
    res.status(500).json({ error: 'Failed to start recording session' })
  }
})

/** POST /recorder/capture — manually trigger a capture step */
recorderRouter.post('/capture', async (req: Request, res: Response) => {
  const { sessionId } = req.body as { sessionId?: string }

  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({ error: 'sessionId is required' })
    return
  }

  // M-01: validate sessionId format before using it
  const sessionIdError = validateSessionId(sessionId)
  if (sessionIdError) {
    res.status(400).json({ error: sessionIdError })
    return
  }

  try {
    const steps = await manualCapture(sessionId)
    res.json({ steps })
  } catch (err) {
    const e = err as { message?: string }
    if (e?.message?.startsWith('Session not found') || e?.message?.startsWith('Browser not found')) {
      res.status(404).json({ error: e.message })
    } else {
      console.error('[recorder] capture failed:', err)
      res.status(500).json({ error: 'Failed to capture' })
    }
  }
})

/** POST /recorder/stop — stop a session and persist the full recording to Garage */
recorderRouter.post('/stop', async (req: Request, res: Response) => {
  const { sessionId } = req.body as { sessionId?: string }

  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({ error: 'sessionId is required' })
    return
  }

  // M-01: validate sessionId format before using it in S3 key construction
  const sessionIdError = validateSessionId(sessionId)
  if (sessionIdError) {
    res.status(400).json({ error: sessionIdError })
    return
  }

  try {
    const activeSession = await stopRecording(sessionId)

    const persistedSession: Session = {
      id:          activeSession.id,
      url:         activeSession.url,
      title:       activeSession.title,
      status:      'finished',
      startedAt:   activeSession.startedAt,
      finishedAt:  new Date().toISOString(),
      steps:       activeSession.steps,
    }

    const key = `recordings/${sessionId}/session.json`
    await putObject(key, Buffer.from(JSON.stringify(persistedSession), 'utf8'), 'application/json')

    res.json(persistedSession)
  } catch (err) {
    const e = err as { message?: string }
    if (e?.message?.startsWith('Session not found')) {
      res.status(404).json({ error: e.message })
    } else {
      console.error('[recorder] stop failed:', err)
      res.status(500).json({ error: 'Failed to stop recording session' })
    }
  }
})

/** GET /recorder/sessions — list all persisted sessions from Garage */
recorderRouter.get('/sessions', async (_req: Request, res: Response) => {
  try {
    const keys = await listObjects('recordings/')
    const sessionJsonKeys = keys.filter(k => k.endsWith('/session.json'))

    const summaries: SessionSummary[] = []

    await Promise.allSettled(
      sessionJsonKeys.map(async (key) => {
        try {
          const session = await getObjectJson<Session>(key)
          summaries.push({
            id:          session.id,
            url:         session.url,
            title:       session.title,
            status:      session.status,
            startedAt:   session.startedAt,
            finishedAt:  session.finishedAt,
            stepCount:   session.steps.length,
          })
        } catch {
          // Skip corrupted session files
        }
      })
    )

    // Sort newest first
    summaries.sort((a, b) => b.startedAt.localeCompare(a.startedAt))

    res.json({ sessions: summaries, total: summaries.length })
  } catch (err) {
    console.error('[recorder] list sessions failed:', err)
    res.status(500).json({ error: 'Failed to list sessions' })
  }
})

/** GET /recorder/sessions/:id — fetch a full persisted session */
recorderRouter.get('/sessions/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string

  // M-01: validate sessionId format before using it in S3 key construction
  const sessionIdError = validateSessionId(id)
  if (sessionIdError) {
    res.status(400).json({ error: sessionIdError })
    return
  }

  try {
    const session = await getObjectJson<Session>(`recordings/${id}/session.json`)
    res.json(session)
  } catch (err: unknown) {
    // H-01: robust error classification
    if (isNotFoundError(err)) {
      res.status(404).json({ error: `Session not found: ${id}` })
    } else if (err instanceof SyntaxError) {
      console.error('[recorder] corrupted session JSON:', id, err)
      res.status(500).json({ error: 'Session data is corrupted' })
    } else if (isNetworkError(err)) {
      console.error('[recorder] storage network error fetching session:', id, err)
      res.status(503).json({ error: 'Storage unavailable' })
    } else {
      console.error('[recorder] get session failed:', id, err)
      res.status(500).json({ error: 'Failed to retrieve session' })
    }
  }
})

/**
 * DELETE /recorder/sessions/:id — remove a persisted session + all its screenshots.
 *
 * TD-014.8b (audit R-04): primary use case is E2E test cleanup (TD-014.23) so
 * the recordings bucket does not accumulate orphan sessions across CI runs.
 * Not surfaced in the user-manual UI; internal admin/test endpoint only.
 *
 * Flow: validate id → HeadObject(session.json) → 404 if absent → ListObjects
 * under `recordings/{id}/` → bulk DeleteObjects → 204 No Content.
 */
recorderRouter.delete('/sessions/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string

  const sessionIdError = validateSessionId(id)
  if (sessionIdError) {
    res.status(400).json({ error: sessionIdError })
    return
  }

  const sessionKey = `recordings/${id}/session.json`
  let exists: boolean
  try {
    exists = await headObject(sessionKey)
  } catch (err: unknown) {
    if (isNetworkError(err)) {
      console.error('[recorder] storage network error checking session:', id, err)
      res.status(503).json({ error: 'Storage unavailable' })
      return
    }
    console.error('[recorder] head session failed:', id, err)
    res.status(500).json({ error: 'Failed to check session' })
    return
  }

  if (!exists) {
    res.status(404).json({ error: `Session not found: ${id}` })
    return
  }

  try {
    const keys = await listObjects(`recordings/${id}/`)
    await deleteObjects(keys)
    res.status(204).end()
  } catch (err: unknown) {
    if (isNetworkError(err)) {
      console.error('[recorder] storage network error deleting session:', id, err)
      res.status(503).json({ error: 'Storage unavailable' })
      return
    }
    console.error('[recorder] delete session failed:', id, err)
    res.status(500).json({ error: 'Failed to delete session' })
  }
})

/** GET /recorder/sessions/:id/screenshot — live JPEG preview of active recording */
recorderRouter.get('/sessions/:id/screenshot', async (req: Request, res: Response) => {
  const id = req.params.id as string

  // M-01: validate sessionId format before passing to browser lookup
  const sessionIdError = validateSessionId(id)
  if (sessionIdError) {
    res.status(400).json({ error: sessionIdError })
    return
  }

  try {
    const jpeg = await getLiveScreenshot(id)
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Cache-Control', 'no-store')
    res.send(jpeg)
  } catch (err) {
    const e = err as { message?: string }
    if (e?.message?.startsWith('Browser not found')) {
      res.status(404).json({ error: e.message })
    } else {
      console.error('[recorder] screenshot failed:', err)
      res.status(500).json({ error: 'Failed to capture screenshot' })
    }
  }
})
