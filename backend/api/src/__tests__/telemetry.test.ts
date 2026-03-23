/**
 * T163 — POST /telemetry/client-errors
 *
 * Tests:
 *   - 401 without Authorization header
 *   - 401 with invalid Bearer token
 *   - 400 on missing required fields
 *   - 400 on invalid url format
 *   - 400 on message exceeding max length
 *   - 400 on invalid timestamp format
 *   - 200 with valid payload — logs via Pino with source:'client'
 *   - 200 when optional fields (stack, context) are absent
 */

import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { app } from '../app'
import { authHeader } from './authHelper'

vi.mock('../storage/s3', () => ({
  s3Client:    {},
  BUCKET:      'elearn-assets',
  initStorage: vi.fn().mockResolvedValue(undefined),
  putObject:   vi.fn(),
  getObject:   vi.fn(),
  statObject:  vi.fn(),
}))

const auth = authHeader()

const validPayload = {
  message: 'TypeError: Cannot read properties of undefined',
  stack: 'TypeError: ...\n  at Foo (app.js:1:2)',
  url: 'http://localhost:3000/editor',
  line: 42,
  column: 7,
  userId: 'u1',
  timestamp: new Date().toISOString(),
  buildVersion: '1.0.0-abc',
  context: { panel: 'SlideList' },
}

// ── Auth ──────────────────────────────────────────────────────────────────────

describe('POST /telemetry/client-errors — auth', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await request(app).post('/telemetry/client-errors').send(validPayload)
    expect(res.status).toBe(401)
  })

  it('returns 401 with invalid Bearer token', async () => {
    const res = await request(app)
      .post('/telemetry/client-errors')
      .set('Authorization', 'Bearer not-a-valid-jwt')
      .send(validPayload)
    expect(res.status).toBe(401)
  })

  it('returns 200 with valid token and payload', async () => {
    const res = await request(app)
      .post('/telemetry/client-errors')
      .set(auth)
      .send(validPayload)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

// ── Validation ────────────────────────────────────────────────────────────────

describe('POST /telemetry/client-errors — validation', () => {
  it('returns 400 when message is missing', async () => {
    const { message: _m, ...rest } = validPayload
    const res = await request(app).post('/telemetry/client-errors').set(auth).send(rest)
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 when message exceeds 500 chars', async () => {
    const res = await request(app)
      .post('/telemetry/client-errors')
      .set(auth)
      .send({ ...validPayload, message: 'x'.repeat(501) })
    expect(res.status).toBe(400)
  })

  it('returns 400 when url is not a valid URL', async () => {
    const res = await request(app)
      .post('/telemetry/client-errors')
      .set(auth)
      .send({ ...validPayload, url: 'not-a-url' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when line is not a number', async () => {
    const res = await request(app)
      .post('/telemetry/client-errors')
      .set(auth)
      .send({ ...validPayload, line: 'forty-two' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when timestamp is not ISO 8601', async () => {
    const res = await request(app)
      .post('/telemetry/client-errors')
      .set(auth)
      .send({ ...validPayload, timestamp: 'yesterday' })
    expect(res.status).toBe(400)
  })

  it('returns 200 when optional fields (stack, context) are absent', async () => {
    const { stack: _s, context: _c, ...minimal } = validPayload
    const res = await request(app).post('/telemetry/client-errors').set(auth).send(minimal)
    expect(res.status).toBe(200)
  })
})

// ── Logging ───────────────────────────────────────────────────────────────────

describe('POST /telemetry/client-errors — logging', () => {
  it('logs at warn level with source:"client" field', async () => {
    const { logger } = await import('../lib/logger')
    const warnSpy = vi.spyOn(logger, 'warn')

    await request(app).post('/telemetry/client-errors').set(auth).send(validPayload)

    expect(warnSpy).toHaveBeenCalledOnce()
    const [logObj] = warnSpy.mock.calls[0] as [Record<string, unknown>, ...unknown[]]
    expect(logObj.source).toBe('client')
    expect(logObj.message).toBe(validPayload.message)
  })
})
