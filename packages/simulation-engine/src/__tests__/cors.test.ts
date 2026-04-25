/**
 * TD-014.8a — CORS middleware for simulation-engine.
 *
 * Blocker for every browser → :3002 call (audit R-03): without CORS, fetch()
 * from the authoring-ui origin (localhost:3000) to the recorder API would fail
 * in Chrome with an opaque network error that masquerades as a server outage.
 *
 * Allowed-origin source: SIMULATION_ENGINE_ALLOWED_ORIGIN env var, default
 * http://localhost:3000. Methods: GET, POST, DELETE. Allowed headers:
 * Content-Type, Authorization. No credentials (recorder uses sessionId in the
 * body, never cookies).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

// Ensure a deterministic allowed origin BEFORE config.ts loads.
process.env.SIMULATION_ENGINE_ALLOWED_ORIGIN = 'http://localhost:3000'

// The middleware factory is the unit under test — a pure function returning
// an Express RequestHandler. Testing it via supertest on a minimal app keeps
// the scope small (no playwright, s3, or route mocks needed).
import { createCorsMiddleware } from '../middleware/cors'

function makeApp() {
  const app = express()
  app.use(createCorsMiddleware())
  app.get('/ping', (_req, res) => res.json({ ok: true }))
  app.post('/ping', (_req, res) => res.json({ ok: true }))
  app.delete('/ping', (_req, res) => res.json({ ok: true }))
  return app
}

describe('simulation-engine CORS middleware (TD-014.8a)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('exposes a factory that returns an Express request handler', () => {
    const mw = createCorsMiddleware()
    expect(typeof mw).toBe('function')
  })

  it('sets Access-Control-Allow-Origin on GET from the allowed origin', async () => {
    const res = await request(makeApp())
      .get('/ping')
      .set('Origin', 'http://localhost:3000')
    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000')
  })

  it('does NOT set Access-Control-Allow-Origin for an unexpected origin', async () => {
    const res = await request(makeApp())
      .get('/ping')
      .set('Origin', 'http://evil.example.com')
    // Request still reaches the handler (200) — enforcement is the browser's
    // job via the missing allow-origin header.
    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('handles preflight for POST with allowed headers', async () => {
    const res = await request(makeApp())
      .options('/ping')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type, Authorization')
    // 204 No Content is the canonical cors-module preflight response.
    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    const methods = (res.headers['access-control-allow-methods'] ?? '').toUpperCase()
    expect(methods).toContain('GET')
    expect(methods).toContain('POST')
    expect(methods).toContain('DELETE')
    const allowedHeaders = (res.headers['access-control-allow-headers'] ?? '').toLowerCase()
    expect(allowedHeaders).toContain('content-type')
    expect(allowedHeaders).toContain('authorization')
  })

  it('rejects preflight from an unexpected origin (no allow-origin echoed)', async () => {
    const res = await request(makeApp())
      .options('/ping')
      .set('Origin', 'http://evil.example.com')
      .set('Access-Control-Request-Method', 'POST')
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('does NOT set credentials:true (recorder uses body sessionId, not cookies)', async () => {
    const res = await request(makeApp())
      .get('/ping')
      .set('Origin', 'http://localhost:3000')
    expect(res.headers['access-control-allow-credentials']).toBeUndefined()
  })

  it('allows same-origin / no-Origin requests (curl, health checks) to pass through', async () => {
    // No Origin header → cors middleware is a no-op, request proceeds normally.
    const res = await request(makeApp()).get('/ping')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})
