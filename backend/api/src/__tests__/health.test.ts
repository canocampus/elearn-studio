import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { app } from '../app'

const { mockInitStorage } = vi.hoisted(() => ({
  mockInitStorage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../storage/s3', () => ({
  s3Client:     {},
  BUCKET:       'elearn-assets',
  initStorage:  mockInitStorage,
  putObject:    vi.fn(),
  getObject:    vi.fn(),
  statObject:   vi.fn(),
}))

describe('GET /health', () => {
  it('returns 200 with status ok when both services are healthy', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.mongo).toBe('ok')
    expect(res.body.storage).toBe('ok')
  })

  it('returns 503 when Garage is unreachable', async () => {
    mockInitStorage.mockRejectedValueOnce(new Error('connection refused'))

    const res = await request(app).get('/health')
    expect(res.status).toBe(503)
    expect(res.body.status).toBe('degraded')
    expect(res.body.storage).toBe('error')
  })

  it('does not require API key auth', async () => {
    // /health must be reachable even without credentials
    const res = await request(app).get('/health')
    expect(res.status).not.toBe(401)
  })
})
