import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../storage/s3', () => ({
  putObject:       vi.fn().mockResolvedValue(undefined),
  getObjectBuffer: vi.fn(),
  getObjectJson:   vi.fn(),
  listObjects:     vi.fn().mockResolvedValue([]),
  checkStorage:    vi.fn().mockResolvedValue(undefined),
  // TD-014.8b — recorder session deletion
  headObject:      vi.fn().mockResolvedValue(true),
  deleteObject:    vi.fn().mockResolvedValue(undefined),
  deleteObjects:   vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@playwright/test', () => {
  const mockPage = {
    evaluate:   vi.fn().mockResolvedValue([]),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
    goto:       vi.fn().mockResolvedValue(undefined),
    on:         vi.fn(),
  }
  const mockContext = {
    addInitScript: vi.fn().mockResolvedValue(undefined),
    newPage:       vi.fn().mockResolvedValue(mockPage),
  }
  const mockBrowser = {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close:      vi.fn().mockResolvedValue(undefined),
  }
  return {
    chromium: {
      launch: vi.fn().mockResolvedValue(mockBrowser),
    },
  }
})

// ── Import after mocks ────────────────────────────────────────────────────────

import { generateStepName } from '../recorder/naming'
import { createSession, getSession, removeSession, appendStep, activeCount } from '../recorder/sessions'
import type { CapturedEvent, SimStep } from '../recorder/types'

// ── generateStepName ──────────────────────────────────────────────────────────

describe('generateStepName', () => {
  const base: CapturedEvent = {
    seq: 1,
    type: 'click',
    selector: 'button',
    timestamp: '2024-01-01T00:00:00.000Z',
  }

  it('click with text', () => {
    expect(generateStepName({ ...base, targetText: 'Submit' })).toBe('Click "Submit"')
  })

  it('click without text uses coordinates', () => {
    expect(generateStepName({ ...base, x: 100, y: 200 })).toBe('Click at (100, 200)')
  })

  it('dblclick with text', () => {
    expect(generateStepName({ ...base, type: 'dblclick', targetText: 'Item' })).toBe('Double-click "Item"')
  })

  it('keydown Tab with text', () => {
    expect(generateStepName({ ...base, type: 'keydown', key: 'Tab', targetText: 'Email' })).toBe('Tab to "Email"')
  })

  it('keydown Enter', () => {
    expect(generateStepName({ ...base, type: 'keydown', key: 'Enter' })).toBe('Press Enter')
  })

  it('keydown Escape', () => {
    expect(generateStepName({ ...base, type: 'keydown', key: 'Escape' })).toBe('Press Escape')
  })

  it('keydown ArrowDown', () => {
    expect(generateStepName({ ...base, type: 'keydown', key: 'ArrowDown' })).toBe('Press ArrowDown')
  })

  it('input with field and value', () => {
    expect(generateStepName({ ...base, type: 'input', targetText: 'Username', value: 'admin' }))
      .toBe('Type into "Username": "admin"')
  })

  it('input truncates value at 40 chars', () => {
    const value = 'a'.repeat(50)
    const result = generateStepName({ ...base, type: 'input', value })
    expect(result).toContain('"' + 'a'.repeat(40) + '"')
  })

  it('change with text', () => {
    expect(generateStepName({ ...base, type: 'change', targetText: 'Option A' }))
      .toBe('Select "Option A"')
  })

  it('change without text uses value', () => {
    expect(generateStepName({ ...base, type: 'change', value: 'opt1' }))
      .toBe('Change selection to "opt1"')
  })

  it('rightclick with text', () => {
    expect(generateStepName({ ...base, type: 'rightclick', targetText: 'Menu' })).toBe('Right-click "Menu"')
  })

  it('rightclick without text uses coordinates', () => {
    expect(generateStepName({ ...base, type: 'rightclick', x: 50, y: 75 })).toBe('Right-click at (50, 75)')
  })
})

// ── sessions store ────────────────────────────────────────────────────────────

describe('sessions store', () => {
  const id = 'test-session-1'

  afterEach(() => {
    removeSession(id)
  })

  it('createSession stores and returns session', () => {
    const s = createSession(id, 'https://example.com', 'Example')
    expect(s.id).toBe(id)
    expect(s.url).toBe('https://example.com')
    expect(s.steps).toEqual([])
    expect(s.stepCounter).toBe(0)
  })

  it('getSession retrieves existing session', () => {
    createSession(id, 'https://example.com', 'Example')
    expect(getSession(id)).toBeDefined()
  })

  it('getSession returns undefined for unknown id', () => {
    expect(getSession('nonexistent')).toBeUndefined()
  })

  it('removeSession deletes session', () => {
    createSession(id, 'https://example.com', 'Example')
    removeSession(id)
    expect(getSession(id)).toBeUndefined()
  })

  it('appendStep increments stepCounter', () => {
    const session = createSession(id, 'https://example.com', 'Example')
    const step: SimStep = {
      id: 'step-1',
      order: 0,
      eventType: 'click',
      selector: 'button',
      description: 'Click submit',
      screenshotKey: 'recordings/test/screenshots/step-0000.png',
      timestamp: new Date().toISOString(),
    }
    appendStep(session, step)
    expect(session.steps).toHaveLength(1)
    expect(session.stepCounter).toBe(1)
  })

  it('activeCount reflects store size', () => {
    const before = activeCount()
    createSession(id, 'https://example.com', 'Example')
    expect(activeCount()).toBe(before + 1)
    removeSession(id)
    expect(activeCount()).toBe(before)
  })
})

// ── Express routes (integration-style with mocked storage) ────────────────────

import express from 'express'
import request from 'supertest'
import { recorderRouter } from '../routes/recorder'
import * as s3 from '../storage/s3'
import * as browser from '../recorder/browser'

// Mock browser module (Playwright operations)
vi.mock('../recorder/browser', () => ({
  startRecording:    vi.fn(),
  stopRecording:     vi.fn(),
  manualCapture:     vi.fn(),
  getLiveScreenshot: vi.fn(),
  activeBrowserCount: vi.fn().mockReturnValue(0),
}))

const app = express()
app.use(express.json())
app.use('/recorder', recorderRouter)

describe('POST /recorder/start', () => {
  beforeEach(() => {
    vi.mocked(browser.startRecording).mockResolvedValue({
      id: 'session-abc',
      url: 'https://example.com',
      title: 'example.com',
      startedAt: '2024-01-01T00:00:00.000Z',
      steps: [],
      stepCounter: 0,
    })
    vi.mocked(browser.activeBrowserCount).mockReturnValue(0)
  })

  it('returns 201 with sessionId on success', async () => {
    const res = await request(app)
      .post('/recorder/start')
      .send({ url: 'https://example.com' })
    expect(res.status).toBe(201)
    expect(res.body.sessionId).toBe('session-abc')
    expect(res.body.status).toBe('recording')
  })

  it('returns 400 when url is missing', async () => {
    const res = await request(app).post('/recorder/start').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/url/)
  })

  it('returns 400 when url is invalid', async () => {
    const res = await request(app).post('/recorder/start').send({ url: 'not-a-url' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/valid URL/)
  })

  it('returns 429 when max browsers reached', async () => {
    vi.mocked(browser.activeBrowserCount).mockReturnValue(3)
    const res = await request(app).post('/recorder/start').send({ url: 'https://example.com' })
    expect(res.status).toBe(429)
  })
})

describe('POST /recorder/capture', () => {
  it('returns steps on success', async () => {
    const mockStep: SimStep = {
      id: 'step-1', order: 1, eventType: 'click', selector: 'button',
      description: 'Click Submit', screenshotKey: 'key', timestamp: new Date().toISOString(),
    }
    vi.mocked(browser.manualCapture).mockResolvedValue([mockStep])

    const res = await request(app).post('/recorder/capture').send({ sessionId: 'session-abc' })
    expect(res.status).toBe(200)
    expect(res.body.steps).toHaveLength(1)
  })

  it('returns 400 when sessionId missing', async () => {
    const res = await request(app).post('/recorder/capture').send({})
    expect(res.status).toBe(400)
  })

  it('returns 404 when session not found', async () => {
    vi.mocked(browser.manualCapture).mockRejectedValue(new Error('Session not found: xyz'))
    const res = await request(app).post('/recorder/capture').send({ sessionId: 'xyz' })
    expect(res.status).toBe(404)
  })
})

describe('POST /recorder/stop', () => {
  it('persists session JSON and returns it', async () => {
    vi.mocked(browser.stopRecording).mockResolvedValue({
      id: 'session-abc',
      url: 'https://example.com',
      title: 'example.com',
      startedAt: '2024-01-01T00:00:00.000Z',
      steps: [],
      stepCounter: 0,
    })
    vi.mocked(s3.putObject).mockResolvedValue(undefined)

    const res = await request(app).post('/recorder/stop').send({ sessionId: 'session-abc' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('finished')
    expect(res.body.id).toBe('session-abc')
    expect(vi.mocked(s3.putObject)).toHaveBeenCalledWith(
      'recordings/session-abc/session.json',
      expect.any(Buffer),
      'application/json',
    )
  })

  it('returns 404 when session not found', async () => {
    vi.mocked(browser.stopRecording).mockRejectedValue(new Error('Session not found: xyz'))
    const res = await request(app).post('/recorder/stop').send({ sessionId: 'xyz' })
    expect(res.status).toBe(404)
  })
})

describe('GET /recorder/sessions', () => {
  it('returns empty list when no sessions in storage', async () => {
    vi.mocked(s3.listObjects).mockResolvedValue([])
    const res = await request(app).get('/recorder/sessions')
    expect(res.status).toBe(200)
    expect(res.body.sessions).toEqual([])
    expect(res.body.total).toBe(0)
  })

  it('returns session summaries from Garage', async () => {
    vi.mocked(s3.listObjects).mockResolvedValue(['recordings/abc/session.json'])
    vi.mocked(s3.getObjectJson).mockResolvedValue({
      id: 'abc', url: 'https://example.com', title: 'Example',
      status: 'finished', startedAt: '2024-01-01T00:00:00.000Z',
      steps: [{ id: 's1' }, { id: 's2' }],
    })
    const res = await request(app).get('/recorder/sessions')
    expect(res.status).toBe(200)
    expect(res.body.sessions).toHaveLength(1)
    expect(res.body.sessions[0].stepCount).toBe(2)
    expect(res.body.sessions[0].status).toBe('finished')
  })
})

describe('GET /recorder/sessions/:id', () => {
  it('returns session from Garage', async () => {
    const session = {
      id: 'abc', url: 'https://example.com', title: 'Example',
      status: 'finished', startedAt: '2024-01-01T00:00:00.000Z', steps: [],
    }
    vi.mocked(s3.getObjectJson).mockResolvedValue(session)
    const res = await request(app).get('/recorder/sessions/abc')
    expect(res.status).toBe(200)
    expect(res.body.id).toBe('abc')
  })

  it('returns 404 for NoSuchKey error', async () => {
    const err = Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' })
    vi.mocked(s3.getObjectJson).mockRejectedValue(err)
    const res = await request(app).get('/recorder/sessions/missing')
    expect(res.status).toBe(404)
  })
})

describe('GET /recorder/sessions/:id/screenshot', () => {
  it('returns JPEG buffer with correct content-type', async () => {
    vi.mocked(browser.getLiveScreenshot).mockResolvedValue(Buffer.from('fake-jpeg'))
    const res = await request(app).get('/recorder/sessions/abc/screenshot')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/image\/jpeg/)
  })

  it('returns 404 when browser not found', async () => {
    vi.mocked(browser.getLiveScreenshot).mockRejectedValue(new Error('Browser not found for session: xyz'))
    const res = await request(app).get('/recorder/sessions/xyz/screenshot')
    expect(res.status).toBe(404)
  })
})

// ── TD-014.8b — DELETE /recorder/sessions/:id ────────────────────────────────

describe('DELETE /recorder/sessions/:id', () => {
  beforeEach(() => {
    vi.mocked(s3.headObject).mockReset()
    vi.mocked(s3.listObjects).mockReset()
    vi.mocked(s3.deleteObjects).mockReset()
    vi.mocked(s3.deleteObject).mockReset()
  })

  it('returns 204 on successful deletion of session + screenshots', async () => {
    vi.mocked(s3.headObject).mockResolvedValue(true)
    vi.mocked(s3.listObjects).mockResolvedValue([
      'recordings/abc-123/session.json',
      'recordings/abc-123/screenshots/step-0001.png',
      'recordings/abc-123/screenshots/step-0002.png',
      'recordings/abc-123/screenshots/step-0003.png',
    ])
    vi.mocked(s3.deleteObjects).mockResolvedValue(undefined)

    const res = await request(app).delete('/recorder/sessions/abc-123')

    expect(res.status).toBe(204)
    expect(res.body).toEqual({})
    expect(vi.mocked(s3.headObject)).toHaveBeenCalledWith('recordings/abc-123/session.json')
    expect(vi.mocked(s3.listObjects)).toHaveBeenCalledWith('recordings/abc-123/')
    expect(vi.mocked(s3.deleteObjects)).toHaveBeenCalledTimes(1)
    const deletedKeys = vi.mocked(s3.deleteObjects).mock.calls[0][0] as string[]
    expect(deletedKeys).toHaveLength(4)
    expect(deletedKeys).toContain('recordings/abc-123/session.json')
    expect(deletedKeys).toContain('recordings/abc-123/screenshots/step-0001.png')
  })

  it('returns 204 when only session.json exists (no screenshots)', async () => {
    vi.mocked(s3.headObject).mockResolvedValue(true)
    vi.mocked(s3.listObjects).mockResolvedValue(['recordings/solo/session.json'])
    vi.mocked(s3.deleteObjects).mockResolvedValue(undefined)

    const res = await request(app).delete('/recorder/sessions/solo')

    expect(res.status).toBe(204)
    expect(vi.mocked(s3.deleteObjects)).toHaveBeenCalledWith(['recordings/solo/session.json'])
  })

  it('returns 404 when session.json does not exist', async () => {
    vi.mocked(s3.headObject).mockResolvedValue(false)

    const res = await request(app).delete('/recorder/sessions/missing')

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
    expect(vi.mocked(s3.listObjects)).not.toHaveBeenCalled()
    expect(vi.mocked(s3.deleteObjects)).not.toHaveBeenCalled()
  })

  it('returns 400 when sessionId contains invalid characters (path traversal)', async () => {
    const res = await request(app).delete('/recorder/sessions/..%2Fevil')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/sessionId/i)
    expect(vi.mocked(s3.headObject)).not.toHaveBeenCalled()
  })

  it('returns 400 for sessionId with disallowed chars (caught by format check)', async () => {
    // Underscore is not in the alphanumeric/hyphen regex — rejected by validateSessionId.
    const res = await request(app).delete('/recorder/sessions/abc_xyz')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/sessionId/i)
  })

  it('returns 500 when bulk delete fails', async () => {
    vi.mocked(s3.headObject).mockResolvedValue(true)
    vi.mocked(s3.listObjects).mockResolvedValue(['recordings/abc/session.json'])
    vi.mocked(s3.deleteObjects).mockRejectedValue(new Error('S3 AccessDenied'))

    const res = await request(app).delete('/recorder/sessions/abc')

    expect(res.status).toBe(500)
    expect(res.body.error).toMatch(/delete/i)
  })

  it('returns 503 when storage network is unreachable during existence check', async () => {
    const netErr = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
    vi.mocked(s3.headObject).mockRejectedValue(netErr)

    const res = await request(app).delete('/recorder/sessions/abc')

    expect(res.status).toBe(503)
  })
})
