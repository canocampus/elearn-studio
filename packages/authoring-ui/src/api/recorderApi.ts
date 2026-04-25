/**
 * API client for the simulation-engine recorder service (TD-014.8).
 *
 * Unlike `courseApi.ts` (which targets `VITE_API_URL` on :3001), the recorder
 * service runs on its own Express app on :3002 — so every call uses an
 * absolute URL assembled from `VITE_SIMULATION_ENGINE_URL`. The helpers still
 * route through `apiFetch` so Bearer injection + silent 401 refresh continue
 * to work when the recorder eventually gets auth (currently CORS-only, per
 * TD-014.8a).
 *
 * Exports mirror the endpoints documented in
 * `packages/simulation-engine/src/routes/recorder.ts`.
 */

import { apiFetch, apiRequest } from './apiClient'
import type {
  Session,
  StartRecordingResponse,
  CaptureStepResponse,
  ListSessionsResponse,
} from '../types/recorder'

const RECORDER_BASE =
  import.meta.env.VITE_SIMULATION_ENGINE_URL ?? 'http://localhost:3002'

function recorderUrl(path: string): string {
  return `${RECORDER_BASE}${path}`
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

// All simulation-engine calls pass `credentials: 'omit'`. The recorder service
// intentionally rejects cookies (`simulation-engine/src/middleware/cors.ts`
// sets `credentials: false` because session-IDs flow in JSON body, never
// cookies). Sending `credentials: 'include'` — `apiFetch`'s default for the
// elearn backend — triggers a browser CORS preflight that demands an
// `Access-Control-Allow-Credentials: true` response header that simulation-
// engine does NOT send, surfacing in the launcher dialog as
// `TypeError: Failed to fetch`. `credentials: 'omit'` matches the recorder
// service contract.
const RECORDER_FETCH_INIT: Pick<RequestInit, 'credentials'> = { credentials: 'omit' }

/** POST /recorder/start — begin a new recording session. */
export function startRecording(url: string, title?: string): Promise<StartRecordingResponse> {
  return apiRequest<StartRecordingResponse>(recorderUrl('/recorder/start'), {
    method: 'POST',
    body: JSON.stringify(title !== undefined ? { url, title } : { url }),
    ...RECORDER_FETCH_INIT,
  })
}

/** POST /recorder/capture — manually trigger a capture on an active session. */
export function captureStep(sessionId: string): Promise<CaptureStepResponse> {
  return apiRequest<CaptureStepResponse>(recorderUrl('/recorder/capture'), {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
    ...RECORDER_FETCH_INIT,
  })
}

/** POST /recorder/stop — stop a session and persist to Garage. Returns the full Session. */
export function stopRecording(sessionId: string): Promise<Session> {
  return apiRequest<Session>(recorderUrl('/recorder/stop'), {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
    ...RECORDER_FETCH_INIT,
  })
}

// ── Persisted sessions ───────────────────────────────────────────────────────

/** GET /recorder/sessions — list persisted session summaries (newest first). */
export function listSessions(): Promise<ListSessionsResponse> {
  return apiRequest<ListSessionsResponse>(recorderUrl('/recorder/sessions'), { ...RECORDER_FETCH_INIT })
}

/** GET /recorder/sessions/:id — fetch a full persisted session. */
export function getSession(id: string): Promise<Session> {
  return apiRequest<Session>(recorderUrl(`/recorder/sessions/${encodeURIComponent(id)}`), { ...RECORDER_FETCH_INIT })
}

/**
 * DELETE /recorder/sessions/:id — remove a persisted session + screenshots.
 * Paired with the TD-014.8b server-side endpoint. Resolves with no value on
 * success (204); rejects on 4xx/5xx via `apiRequest`'s error path.
 */
export async function deleteSession(id: string): Promise<void> {
  const res = await apiFetch(recorderUrl(`/recorder/sessions/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    ...RECORDER_FETCH_INIT,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`DELETE /recorder/sessions/${id} → ${res.status}: ${body}`)
  }
}

// ── Live screenshot ──────────────────────────────────────────────────────────

/**
 * Build the URL for `<img src>` live-preview of an active recording session.
 *
 * Intentionally returns a plain URL string (no fetch, no Bearer header) — the
 * browser fetches it directly for `<img>`. The recorder endpoint responds with
 * `Cache-Control: no-store`, but callers MUST still append a rotating cache-
 * buster query parameter (e.g. `?t=${tick}` in `RecorderLiveView.tsx:160`,
 * incrementing on a `POLL_INTERVAL_MS` = 500ms timer). Two independent reasons
 * the rotating query is necessary, neither of which `no-store` solves:
 *
 *   (a) Network layer — some corporate proxies (notably those performing MITM
 *       TLS inspection) disregard `Cache-Control: no-store` and serve a stale
 *       cached response. The rotating segment makes each poll a distinct URL,
 *       defeating proxy caches that key on full URL.
 *
 *   (b) React layer — `<img>` only triggers a network fetch when its `src`
 *       attribute changes (string-identity comparison across renders). Re-
 *       rendering an `<img>` with the SAME `src` is a no-op even when the
 *       server's `no-store` would otherwise permit a refetch. The rotating
 *       query forces a fresh fetch on every poll tick by changing `src`.
 *
 * Polling cadence is the caller's responsibility — see `RecorderLiveView.tsx`
 * (tick state increments every `POLL_INTERVAL_MS`).
 */
export function getLiveScreenshotUrl(id: string): string {
  return recorderUrl(`/recorder/sessions/${encodeURIComponent(id)}/screenshot`)
}
