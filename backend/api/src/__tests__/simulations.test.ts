/**
 * Tests for simulation import and screenshot proxy routes. (T024.3, T024.4)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { Readable } from 'stream'
import { app } from '../app'
import type { RawSession } from '../types/simulation'
import { authHeader } from './authHelper'

// ── Mock storage so tests never need Garage credentials ──────────────────────

const { mockGetObject } = vi.hoisted(() => ({ mockGetObject: vi.fn() }))

vi.mock('../storage/s3', () => ({
  s3Client:    {},
  BUCKET:      'elearn-assets',
  initStorage: vi.fn().mockResolvedValue(undefined),
  putObject:   vi.fn(),
  getObject:   mockGetObject,
  statObject:  vi.fn(),
}))

const auth = authHeader()

// ── Helpers ───────────────────────────────────────────────────────────────────

function streamFromString(str: string) {
  return Readable.from([Buffer.from(str, 'utf-8')])
}

function streamFromBuffer(buf: Buffer) {
  return Readable.from([buf])
}

const SAMPLE_SESSION: RawSession = {
  id: 'sess-abc',
  url: 'https://example.com',
  title: 'Test recording',
  startedAt: '2026-01-01T00:00:00Z',
  steps: [
    {
      id: 'step-0',
      type: 'click',
      x: 0.5,
      y: 0.5,
      targetText: 'Submit',
      timestamp: 1000,
      screenshotKey: 'recordings/sess-abc/screenshots/step-0000.png',
    },
    {
      id: 'step-1',
      type: 'input',
      x: 0.3,
      y: 0.2,
      value: 'hello world',
      timestamp: 2000,
      screenshotKey: 'recordings/sess-abc/screenshots/step-0001.png',
    },
    {
      id: 'step-2',
      type: 'keydown',
      timestamp: 3000,
      screenshotKey: 'recordings/sess-abc/screenshots/step-0002.png',
    },
  ],
}

// ── POST /courses/:id/simulations/import ──────────────────────────────────────

describe('POST /courses/:id/simulations/import', () => {
  beforeEach(() => {
    mockGetObject.mockReset()
  })

  it('returns 400 when sessionId is missing', async () => {
    const res = await request(app)
      .post('/courses/course-1/simulations/import')
      .set(auth)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/sessionId/)
  })

  it('returns 400 for sessionId containing path traversal characters', async () => {
    const res = await request(app)
      .post('/courses/course-1/simulations/import')
      .set(auth)
      .send({ sessionId: '../../../admin' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 422 when session JSON is corrupted', async () => {
    mockGetObject.mockResolvedValue({
      stream: streamFromString('not valid json {{{'),
      contentType: 'application/json',
    })
    const res = await request(app)
      .post('/courses/course-1/simulations/import')
      .set(auth)
      .send({ sessionId: 'sess-abc' })
    expect(res.status).toBe(422)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/corrupted/)
  })

  it('returns 404 when session JSON does not exist in Garage', async () => {
    const err = Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' })
    mockGetObject.mockRejectedValue(err)

    const res = await request(app)
      .post('/courses/course-1/simulations/import')
      .set(auth)
      .send({ sessionId: 'missing-sess' })
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/not found/i)
  })

  it('converts raw steps into AuthoredSimStep[] with default hotspot', async () => {
    mockGetObject.mockResolvedValue({
      stream: streamFromString(JSON.stringify(SAMPLE_SESSION)),
      contentType: 'application/json',
      contentLength: undefined,
    })

    const res = await request(app)
      .post('/courses/course-1/simulations/import')
      .set(auth)
      .send({ sessionId: 'sess-abc' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const config = res.body.data
    expect(config.sessionId).toBe('sess-abc')
    expect(config.mode).toBe('practice')
    expect(config.passingScore).toBe(80)
    expect(config.steps).toHaveLength(3)

    // Step 0: click with targetText → description derived
    const s0 = config.steps[0]
    expect(s0.id).toBe('step-0')
    expect(s0.order).toBe(0)
    expect(s0.description).toBe('Click "Submit"')
    expect(s0.screenshotKey).toBe('recordings/sess-abc/screenshots/step-0000.png')
    // screenshotUrl proxied through backend
    expect(s0.screenshotUrl).toContain('/simulations/screenshot?key=')
    // default hotspot centred on click (x=0.5→320, y=0.5→180 of 640×360)
    expect(s0.hotspot.x).toBe(280)  // 320 - 40
    expect(s0.hotspot.y).toBe(160)  // 180 - 20
    expect(s0.hotspot.width).toBe(80)
    expect(s0.hotspot.height).toBe(40)
    expect(s0.hotspot.tolerance).toBe(10)

    // Step 1: input → description includes value
    const s1 = config.steps[1]
    expect(s1.description).toBe('Type "hello world"')

    // Step 2: unknown → generic description
    const s2 = config.steps[2]
    expect(s2.description).toBe('Step 3')
  })

  it('returns 500 on unexpected storage error', async () => {
    mockGetObject.mockRejectedValue(new Error('Unexpected'))

    const res = await request(app)
      .post('/courses/course-1/simulations/import')
      .set(auth)
      .send({ sessionId: 'sess-abc' })
    expect(res.status).toBe(500)
    expect(res.body.success).toBe(false)
  })

  it('fetches correct S3 key from Garage', async () => {
    mockGetObject.mockResolvedValue({
      stream: streamFromString(JSON.stringify({ ...SAMPLE_SESSION, steps: [] })),
      contentType: 'application/json',
    })

    await request(app)
      .post('/courses/course-99/simulations/import')
      .set(auth)
      .send({ sessionId: 'sess-xyz' })

    expect(mockGetObject).toHaveBeenCalledWith('recordings/sess-xyz/session.json')
  })
})

// ── GET /simulations/screenshot ───────────────────────────────────────────────

describe('GET /simulations/screenshot', () => {
  beforeEach(() => {
    mockGetObject.mockReset()
  })

  it('returns 400 when key is missing', async () => {
    const res = await request(app).get('/simulations/screenshot').set(auth)
    expect(res.status).toBe(400)
  })

  it('returns 403 for keys outside recordings/ prefix', async () => {
    const res = await request(app).get(
      '/simulations/screenshot?key=other/path/file.png',
    ).set(auth)
    expect(res.status).toBe(403)
  })

  it('returns 403 for non-image keys', async () => {
    const res = await request(app).get(
      '/simulations/screenshot?key=recordings/sess/session.json',
    ).set(auth)
    expect(res.status).toBe(403)
  })

  it('returns 403 for path traversal with .. segments', async () => {
    const res = await request(app).get(
      '/simulations/screenshot?key=recordings/sess/../../../etc/passwd.png',
    ).set(auth)
    expect(res.status).toBe(403)
  })

  it('returns 403 for encoded path traversal', async () => {
    const res = await request(app).get(
      '/simulations/screenshot?key=recordings/..%2F..%2Fetc%2Fpasswd.png',
    ).set(auth)
    expect(res.status).toBe(403)
  })

  it('streams the screenshot with correct content-type', async () => {
    const imgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]) // fake JPEG header
    mockGetObject.mockResolvedValue({
      stream: streamFromBuffer(imgBuffer),
      contentType: 'image/jpeg',
      contentLength: imgBuffer.length,
    })

    const res = await request(app).get(
      '/simulations/screenshot?key=recordings/sess-abc/screenshots/step-0000.png',
    ).set(auth)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/image\/jpeg/)
    expect(res.headers['cache-control']).toMatch(/max-age=3600/)
  })

  it('returns 404 when screenshot key does not exist', async () => {
    const err = Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' })
    mockGetObject.mockRejectedValue(err)

    const res = await request(app).get(
      '/simulations/screenshot?key=recordings/sess-abc/screenshots/missing.png',
    ).set(auth)
    expect(res.status).toBe(404)
  })
})
