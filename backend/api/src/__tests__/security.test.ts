/**
 * T166 — Security Hardening
 *
 * Tests:
 *   - Helmet security headers present on all responses (x-content-type-options, x-frame-options, CSP)
 *   - POST /assets with disallowed MIME type → 415 Unsupported Media Type
 *   - POST /assets with valid upload → RateLimit headers present (per-endpoint limiter applied)
 */

import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { app } from '../app'
import { authHeader } from './authHelper'

vi.mock('../storage/s3', () => ({
  s3Client:        {},
  BUCKET:          'elearn-assets',
  initStorage:     vi.fn().mockResolvedValue(undefined),
  putObject:       vi.fn().mockResolvedValue(undefined),
  getPresignedUrl: vi.fn().mockResolvedValue('http://garage:3900/presigned?sig=test'),
  statObject:      vi.fn(),
}))

const auth = authHeader()

// ── Helmet — security headers ─────────────────────────────────────────────────

describe('Security headers (helmet)', () => {
  it('adds X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('adds X-Frame-Options', async () => {
    const res = await request(app).get('/health')
    expect(res.headers['x-frame-options']).toBeDefined()
  })

  it('adds Content-Security-Policy', async () => {
    const res = await request(app).get('/health')
    expect(res.headers['content-security-policy']).toBeDefined()
  })
})

// ── MIME type → 415 ───────────────────────────────────────────────────────────

describe('POST /assets — disallowed MIME type → 415', () => {
  it('returns 415 for text/html', async () => {
    const res = await request(app)
      .post('/assets')
      .set(auth)
      .attach('file', Buffer.from('<script>alert(1)</script>'), {
        filename: 'evil.html',
        contentType: 'text/html',
      })
    expect(res.status).toBe(415)
    expect(res.body.success).toBe(false)
  })

  it('returns 415 for application/javascript', async () => {
    const res = await request(app)
      .post('/assets')
      .set(auth)
      .attach('file', Buffer.from('alert(1)'), {
        filename: 'evil.js',
        contentType: 'application/javascript',
      })
    expect(res.status).toBe(415)
    expect(res.body.success).toBe(false)
  })
})

// ── Per-endpoint rate limit ───────────────────────────────────────────────────

describe('POST /assets — per-endpoint rate-limit headers', () => {
  it('includes RateLimit-Limit header (upload limiter is applied)', async () => {
    const res = await request(app)
      .post('/assets')
      .set(auth)
      .attach('file', Buffer.from('fake-jpeg'), {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      })
    // express-rate-limit draft-7 emits a combined 'ratelimit' header:
    // "limit=20, remaining=19, reset=900"
    expect(
      res.headers['ratelimit'] ?? res.headers['ratelimit-limit'] ?? res.headers['x-ratelimit-limit'],
    ).toBeDefined()
  })
})
