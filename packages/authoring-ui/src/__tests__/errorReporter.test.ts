/**
 * T163 — Client Error Reporter
 *
 * Tests:
 *   - captureError builds correct payload and calls apiFetch
 *   - throttle: max 10 events per 60-second window
 *   - events beyond the window are dropped silently
 *   - send failures are logged but do not throw
 *   - initErrorReporter wires window 'error' and 'unhandledrejection' listeners
 *   - initErrorReporter is idempotent (safe to call twice)
 *   - userId read from authStore (null when logged out)
 *   - buildVersion read from VITE_BUILD_VERSION env var
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAuthStore } from '../store/authStore'

// Mock apiFetch so we never hit the network
vi.mock('../api/apiClient', () => ({
  apiFetch: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
}))

import { apiFetch } from '../api/apiClient'
import { captureError, initErrorReporter, _resetForTesting } from '../lib/errorReporter'

beforeEach(() => {
  _resetForTesting()
  vi.useFakeTimers()
  useAuthStore.setState({ accessToken: 'tok', user: { id: 'u1', email: 'a@b.com', role: 'author' } })
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  useAuthStore.setState({ accessToken: null, user: null })
})

// ── captureError ──────────────────────────────────────────────────────────────

describe('captureError', () => {
  it('calls apiFetch with POST /telemetry/client-errors', () => {
    captureError(new Error('boom'))

    expect(apiFetch).toHaveBeenCalledOnce()
    const [path, init] = vi.mocked(apiFetch).mock.calls[0]
    expect(path).toBe('/telemetry/client-errors')
    expect(init?.method).toBe('POST')
  })

  it('payload contains message, stack, timestamp, buildVersion', () => {
    const err = new Error('test error')
    captureError(err)

    const [, init] = vi.mocked(apiFetch).mock.calls[0]
    const body = JSON.parse(init!.body as string)

    expect(body.message).toBe('test error')
    expect(body.stack).toBeDefined()
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(body.buildVersion).toBeDefined()
  })

  it('payload includes userId from authStore', () => {
    captureError(new Error('x'))

    const [, init] = vi.mocked(apiFetch).mock.calls[0]
    const body = JSON.parse(init!.body as string)
    expect(body.userId).toBe('u1')
  })

  it('payload userId is null when not authenticated', () => {
    useAuthStore.setState({ accessToken: null, user: null })
    captureError(new Error('x'))

    const [, init] = vi.mocked(apiFetch).mock.calls[0]
    const body = JSON.parse(init!.body as string)
    expect(body.userId).toBeNull()
  })

  it('payload includes optional context', () => {
    captureError(new Error('x'), { panel: 'SlideList' })

    const [, init] = vi.mocked(apiFetch).mock.calls[0]
    const body = JSON.parse(init!.body as string)
    expect(body.context).toEqual({ panel: 'SlideList' })
  })

  it('buildVersion uses VITE_BUILD_VERSION env var', () => {
    vi.stubEnv('VITE_BUILD_VERSION', '2.0.0-abc')
    _resetForTesting()
    captureError(new Error('x'))

    const [, init] = vi.mocked(apiFetch).mock.calls[0]
    const body = JSON.parse(init!.body as string)
    expect(body.buildVersion).toBe('2.0.0-abc')
  })

  it('buildVersion falls back to "unknown" when env var not set', () => {
    captureError(new Error('x'))

    const [, init] = vi.mocked(apiFetch).mock.calls[0]
    const body = JSON.parse(init!.body as string)
    expect(body.buildVersion).toBe('unknown')
  })

  it('does not throw if apiFetch rejects (fire-and-forget)', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('network down'))

    expect(() => captureError(new Error('app error'))).not.toThrow()
    // Let the promise settle — should not cause unhandled rejection
    await vi.runAllTimersAsync()
  })
})

// ── Throttle ──────────────────────────────────────────────────────────────────

describe('throttle — max 10 events per 60s', () => {
  it('allows up to 10 events within 60 seconds', () => {
    for (let i = 0; i < 10; i++) captureError(new Error(`e${i}`))
    expect(apiFetch).toHaveBeenCalledTimes(10)
  })

  it('drops the 11th event within the same 60-second window', () => {
    for (let i = 0; i < 11; i++) captureError(new Error(`e${i}`))
    expect(apiFetch).toHaveBeenCalledTimes(10)
  })

  it('allows new events after the 60-second window expires', () => {
    for (let i = 0; i < 10; i++) captureError(new Error(`e${i}`))

    // Advance clock past the throttle window
    vi.advanceTimersByTime(61_000)

    captureError(new Error('after window'))
    expect(apiFetch).toHaveBeenCalledTimes(11)
  })
})

// ── initErrorReporter ─────────────────────────────────────────────────────────

describe('initErrorReporter', () => {
  it('attaches window error listener that calls captureError', () => {
    initErrorReporter()

    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'script error',
        error: new Error('script error'),
        lineno: 42,
        colno: 7,
        filename: 'http://localhost/app.js',
      }),
    )

    expect(apiFetch).toHaveBeenCalledOnce()
    const [, init] = vi.mocked(apiFetch).mock.calls[0]
    const body = JSON.parse(init!.body as string)
    expect(body.message).toBe('script error')
  })

  it('attaches window unhandledrejection listener', () => {
    initErrorReporter()

    window.dispatchEvent(
      new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.resolve(),
        reason: new Error('rejected promise'),
      }),
    )

    expect(apiFetch).toHaveBeenCalledOnce()
    const [, init] = vi.mocked(apiFetch).mock.calls[0]
    const body = JSON.parse(init!.body as string)
    expect(body.message).toBe('rejected promise')
  })

  it('is idempotent — calling twice does not double-fire events', () => {
    initErrorReporter()
    initErrorReporter()

    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'once',
        error: new Error('once'),
        lineno: 1,
        colno: 1,
        filename: 'http://localhost/app.js',
      }),
    )

    expect(apiFetch).toHaveBeenCalledOnce()
  })
})
