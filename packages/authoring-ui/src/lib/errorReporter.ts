/**
 * T163 — Client Error Reporter
 *
 * Captures unhandled JS errors and promise rejections, throttles to
 * max 10 events per 60-second sliding window, and forwards them to
 * POST /telemetry/client-errors (requires Bearer auth).
 *
 * Usage:
 *   Call initErrorReporter() once in main.tsx before rendering.
 *   Call captureError(err, context?) from ErrorBoundary.componentDidCatch.
 *
 * Throttle note:
 *   Events beyond the limit are silently dropped. This prevents cascading
 *   render crashes from flooding the backend. The window resets naturally
 *   as old timestamps expire.
 *
 * Send failures:
 *   Network errors are logged to console.error only. The reporter never
 *   re-queues failed sends to avoid infinite retry loops.
 */

import { useAuthStore } from '../store/authStore'
import { apiFetch } from '../api/apiClient'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClientErrorPayload {
  message: string
  stack?: string
  url: string
  line: number
  column: number
  userId: string | null
  timestamp: string
  buildVersion: string
  context?: Record<string, unknown>
}

// ── Module-level throttle state ───────────────────────────────────────────────

const WINDOW_MS = 60_000
const MAX_EVENTS = 10

let eventTimestamps: number[] = []
let initialized = false
let buildVersion = import.meta.env.VITE_BUILD_VERSION ?? 'unknown'
let abortController: AbortController | null = null

// ── Context sanitisation ──────────────────────────────────────────────────────

const MAX_CONTEXT_BYTES = 1024

function sanitizeContext(
  ctx: Record<string, unknown>,
): Record<string, unknown> {
  try {
    const serialized = JSON.stringify(ctx)
    if (serialized.length <= MAX_CONTEXT_BYTES) return ctx
    return { _truncated: true, _originalSize: serialized.length }
  } catch {
    return { _serializationError: true }
  }
}

// ── Throttle helpers ──────────────────────────────────────────────────────────

function pruneWindow(): void {
  const cutoff = Date.now() - WINDOW_MS
  eventTimestamps = eventTimestamps.filter((t) => t > cutoff)
}

function isThrottled(): boolean {
  pruneWindow()
  return eventTimestamps.length >= MAX_EVENTS
}

function recordEvent(): void {
  eventTimestamps.push(Date.now())
}

// ── Send ──────────────────────────────────────────────────────────────────────

async function send(payload: ClientErrorPayload): Promise<void> {
  try {
    const res = await apiFetch('/telemetry/client-errors', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error(`[errorReporter] Server rejected error report: HTTP ${res.status}`)
    }
  } catch (err) {
    console.error('[errorReporter] Failed to send error report:', err)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Capture and forward an error. Safe to call from ErrorBoundary.componentDidCatch
 * or any catch block. Silently no-ops when throttled.
 *
 * @param error   The error to report.
 * @param context Optional key/value bag of extra diagnostic data (e.g. panel name,
 *                route, slide id). Capped at 1 KB serialized — larger objects are
 *                replaced with `{ _truncated: true, _originalSize: N }`.
 */
export function captureError(
  error: Error,
  context?: Record<string, unknown>,
): void {
  if (isThrottled()) return
  recordEvent()

  const { user } = useAuthStore.getState()

  const payload: ClientErrorPayload = {
    message: error.message,
    stack: error.stack,
    url: typeof window !== 'undefined' ? window.location.href : '',
    line: 0,
    column: 0,
    userId: user?.id ?? null,
    timestamp: new Date().toISOString(),
    buildVersion,
    context: context ? sanitizeContext(context) : undefined,
  }

  void send(payload)
}

/**
 * Attach global window listeners for uncaught errors and unhandled rejections.
 * Idempotent — safe to call multiple times (only registers listeners once).
 */
export function initErrorReporter(): void {
  if (initialized) return
  initialized = true

  abortController = new AbortController()
  const { signal } = abortController

  window.addEventListener('error', (event: ErrorEvent) => {
    if (isThrottled()) return
    recordEvent()

    const { user } = useAuthStore.getState()

    const payload: ClientErrorPayload = {
      message: event.message || 'Unknown error',
      stack: event.error instanceof Error ? event.error.stack : undefined,
      url: event.filename || window.location.href,
      line: event.lineno ?? 0,
      column: event.colno ?? 0,
      userId: user?.id ?? null,
      timestamp: new Date().toISOString(),
      buildVersion,
    }

    void send(payload)
  }, { signal })

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    if (isThrottled()) return
    recordEvent()

    const { user } = useAuthStore.getState()
    const reason = event.reason
    const error = reason instanceof Error ? reason : new Error(String(reason))

    const payload: ClientErrorPayload = {
      message: error.message,
      stack: error.stack,
      url: window.location.href,
      line: 0,
      column: 0,
      userId: user?.id ?? null,
      timestamp: new Date().toISOString(),
      buildVersion,
    }

    void send(payload)
  }, { signal })
}

/**
 * Resets internal state for unit tests. Never call in production code.
 */
export function _resetForTesting(): void {
  abortController?.abort()  // removes all listeners registered with { signal }
  abortController = null
  eventTimestamps = []
  initialized = false
  // Re-read env var so tests that stub VITE_BUILD_VERSION get the updated value
  buildVersion = import.meta.env.VITE_BUILD_VERSION ?? 'unknown'
}
