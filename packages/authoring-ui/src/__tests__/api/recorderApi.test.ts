/**
 * TD-014.8 — Unit tests for recorderApi.ts.
 *
 * The recorder service is hosted on a different origin than the primary API,
 * so the interesting invariants are:
 *   (a) every recorder URL is built from VITE_SIMULATION_ENGINE_URL, not VITE_API_URL
 *   (b) apiFetch's absolute-URL branch is exercised (added in this same task)
 *   (c) getLiveScreenshotUrl returns a plain string (no fetch)
 *   (d) deleteSession resolves on 204 and rejects on 4xx/5xx.
 *
 * Tests stub `global.fetch` the same way `courseApi.test.ts` does, then
 * inspect the URL argument to assert routing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  startRecording,
  captureStep,
  stopRecording,
  listSessions,
  getSession,
  deleteSession,
  getLiveScreenshotUrl,
} from '../../api/recorderApi'

const RECORDER_BASE = 'http://localhost:3002'

function makeResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response
}

describe('recorderApi — URL routing', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('startRecording: POST http://…:3002/recorder/start with url+title body', async () => {
    fetchSpy.mockResolvedValue(makeResponse({ sessionId: 's1', status: 'recording', startedAt: 't' }))
    await startRecording('https://example.com', 'Example')
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${RECORDER_BASE}/recorder/start`)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual({ url: 'https://example.com', title: 'Example' })
  })

  it('startRecording: omits title when not supplied', async () => {
    fetchSpy.mockResolvedValue(makeResponse({ sessionId: 's1', status: 'recording', startedAt: 't' }))
    await startRecording('https://example.com')
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({ url: 'https://example.com' })
  })

  it('captureStep: POST /recorder/capture with sessionId', async () => {
    fetchSpy.mockResolvedValue(makeResponse({ steps: [] }))
    await captureStep('abc')
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${RECORDER_BASE}/recorder/capture`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ sessionId: 'abc' })
  })

  it('stopRecording: POST /recorder/stop and returns Session', async () => {
    const session = { id: 'abc', url: 'u', title: 't', status: 'finished', startedAt: 't', steps: [] }
    fetchSpy.mockResolvedValue(makeResponse(session))
    const result = await stopRecording('abc')
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${RECORDER_BASE}/recorder/stop`)
    expect(init.method).toBe('POST')
    expect(result).toEqual(session)
  })

  it('listSessions: GET /recorder/sessions — no body, no Content-Type', async () => {
    fetchSpy.mockResolvedValue(makeResponse({ sessions: [], total: 0 }))
    await listSessions()
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${RECORDER_BASE}/recorder/sessions`)
    expect(init.method ?? 'GET').toBe('GET')
    // GET has no body — apiClient must not set Content-Type
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined()
  })

  it('getSession: GET /recorder/sessions/:id with URI-encoded id', async () => {
    fetchSpy.mockResolvedValue(makeResponse({ id: 'a-b-c' }))
    await getSession('a-b-c')
    const [url] = fetchSpy.mock.calls[0] as [string]
    expect(url).toBe(`${RECORDER_BASE}/recorder/sessions/a-b-c`)
  })

  it('deleteSession: DELETE /recorder/sessions/:id resolves on 204', async () => {
    fetchSpy.mockResolvedValue(makeResponse('', true, 204))
    await expect(deleteSession('abc')).resolves.toBeUndefined()
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${RECORDER_BASE}/recorder/sessions/abc`)
    expect(init.method).toBe('DELETE')
  })

  it('deleteSession: rejects on 404 with status in message', async () => {
    fetchSpy.mockResolvedValue(makeResponse('Session not found', false, 404))
    await expect(deleteSession('missing')).rejects.toThrow(/404/)
  })

  it('deleteSession: rejects on 500', async () => {
    fetchSpy.mockResolvedValue(makeResponse('boom', false, 500))
    await expect(deleteSession('abc')).rejects.toThrow(/500/)
  })

  it('throws descriptive network error (no duplicated API_BASE hint for absolute URLs)', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'))
    // Assert the error mentions the recorder URL but NOT the misleading
    // "is the backend running at ${API_BASE}" hint (which would point at :3001).
    await expect(listSessions()).rejects.toThrow(/network error/)
    await expect(listSessions()).rejects.not.toThrow(/is the backend running at/)
  })
})

describe('recorderApi — getLiveScreenshotUrl', () => {
  it('returns a plain URL string without fetching', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    try {
      const url = getLiveScreenshotUrl('abc')
      expect(url).toBe(`${RECORDER_BASE}/recorder/sessions/abc/screenshot`)
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('URI-encodes the session id', () => {
    const url = getLiveScreenshotUrl('a b/c')
    expect(url).toBe(`${RECORDER_BASE}/recorder/sessions/a%20b%2Fc/screenshot`)
  })
})
