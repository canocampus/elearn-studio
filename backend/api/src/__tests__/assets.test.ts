import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../app'
import { authHeader } from './authHelper'

// vi.hoisted lets us reference these variables inside the vi.mock factory (which is hoisted)
const { mockPutObject, mockGetPresignedUrl, mockStatObject, mockInitStorage } = vi.hoisted(() => ({
  mockPutObject:       vi.fn().mockResolvedValue(undefined),
  mockGetPresignedUrl: vi.fn().mockResolvedValue('http://garage:3900/presigned?sig=test'),
  mockStatObject:      vi.fn(),
  mockInitStorage:     vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../storage/s3', () => ({
  s3Client:        {},
  BUCKET:          'elearn-assets',
  initStorage:     mockInitStorage,
  putObject:       mockPutObject,
  getPresignedUrl: mockGetPresignedUrl,
  statObject:      mockStatObject,
}))

const auth = authHeader()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]+$/i

describe('POST /assets — H-03 MIME allowlist', () => {
  beforeEach(() => {
    mockPutObject.mockClear()
  })

  it('accepts image/jpeg', async () => {
    const res = await request(app)
      .post('/assets')
      .set(auth)
      .attach('file', Buffer.from('fake-jpeg'), { filename: 'test.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.objectName).toMatch(UUID_RE)
    expect(mockPutObject).toHaveBeenCalledOnce()
  })

  it('accepts application/pdf', async () => {
    const res = await request(app)
      .post('/assets')
      .set(auth)
      .attach('file', Buffer.from('%PDF-fake'), { filename: 'doc.pdf', contentType: 'application/pdf' })

    expect(res.status).toBe(201)
    expect(res.body.data.url).toMatch(/^\/assets\//)
  })

  it('rejects text/html with 415 — stored XSS prevention', async () => {
    const res = await request(app)
      .post('/assets')
      .set(auth)
      .attach('file', Buffer.from('<script>alert(1)</script>'), {
        filename: 'evil.html',
        contentType: 'text/html',
      })

    expect(res.status).toBe(415)
    expect(res.body.success).toBe(false)
    expect(mockPutObject).not.toHaveBeenCalled()
  })

  it('rejects application/javascript with 415', async () => {
    const res = await request(app)
      .post('/assets')
      .set(auth)
      .attach('file', Buffer.from('alert(1)'), {
        filename: 'evil.js',
        contentType: 'application/javascript',
      })

    expect(res.status).toBe(415)
    expect(mockPutObject).not.toHaveBeenCalled()
  })

  it('returns 400 when no file is provided', async () => {
    const res = await request(app).post('/assets').set(auth)
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})

describe('GET /assets/:objectName — pre-signed URL redirect', () => {
  beforeEach(() => {
    mockGetPresignedUrl.mockReset()
    mockGetPresignedUrl.mockResolvedValue('http://garage:3900/presigned?sig=test')
  })

  it('redirects (302) to pre-signed URL for a valid image asset', async () => {
    const objectName = '550e8400-e29b-41d4-a716-446655440000.jpg'
    const presignedUrl = 'http://garage:3900/elearn-assets/obj?X-Amz-Signature=test'
    mockGetPresignedUrl.mockResolvedValue(presignedUrl)

    const res = await request(app)
      .get(`/assets/${objectName}`)
      .set(auth)
      .redirects(0)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(presignedUrl)
    expect(mockGetPresignedUrl).toHaveBeenCalledWith(objectName, { contentDisposition: undefined })
  })

  it('requests Content-Disposition: attachment for PDF assets', async () => {
    const objectName = '550e8400-e29b-41d4-a716-446655440000.pdf'

    const res = await request(app)
      .get(`/assets/${objectName}`)
      .set(auth)
      .redirects(0)

    expect(res.status).toBe(302)
    expect(mockGetPresignedUrl).toHaveBeenCalledWith(objectName, { contentDisposition: 'attachment' })
  })

  it('requests Content-Disposition: attachment for SVG assets (prevents stored XSS)', async () => {
    const objectName = '550e8400-e29b-41d4-a716-446655440000.svg'

    await request(app).get(`/assets/${objectName}`).set(auth).redirects(0)

    expect(mockGetPresignedUrl).toHaveBeenCalledWith(objectName, { contentDisposition: 'attachment' })
  })

  it('rejects path traversal attempt ../../etc/passwd', async () => {
    const res = await request(app).get('/assets/../../etc/passwd').set(auth)
    // Express router normalizes path separators; remaining string won't match UUID regex
    expect([400, 404]).toContain(res.status)
    expect(mockGetPresignedUrl).not.toHaveBeenCalled()
  })

  it('rejects object name without UUID format', async () => {
    const res = await request(app).get('/assets/not-a-uuid.jpg').set(auth)
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(mockGetPresignedUrl).not.toHaveBeenCalled()
  })

  it('rejects object name with no extension', async () => {
    const res = await request(app).get('/assets/550e8400-e29b-41d4-a716-446655440000').set(auth)
    expect(res.status).toBe(400)
    expect(mockGetPresignedUrl).not.toHaveBeenCalled()
  })

  it('returns 503 when presigned URL generation fails', async () => {
    const objectName = '550e8400-e29b-41d4-a716-446655440000.png'
    mockGetPresignedUrl.mockRejectedValue(new Error('Credentials error'))

    const res = await request(app)
      .get(`/assets/${objectName}`)
      .set(auth)
      .redirects(0)

    expect(res.status).toBe(503)
  })
})
