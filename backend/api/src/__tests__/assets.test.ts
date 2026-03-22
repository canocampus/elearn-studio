import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { Readable } from 'stream'
import { app } from '../app'

// vi.hoisted lets us reference these variables inside the vi.mock factory (which is hoisted)
const { mockPutObject, mockGetObject, mockStatObject, mockInitStorage } = vi.hoisted(() => ({
  mockPutObject:   vi.fn().mockResolvedValue(undefined),
  mockGetObject:   vi.fn(),
  mockStatObject:  vi.fn(),
  mockInitStorage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../storage/s3', () => ({
  s3Client:    {},
  BUCKET:      'elearn-assets',
  initStorage: mockInitStorage,
  putObject:   mockPutObject,
  getObject:   mockGetObject,
  statObject:  mockStatObject,
}))

vi.stubEnv('API_KEY', '')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]+$/i

describe('POST /assets — H-03 MIME allowlist', () => {
  beforeEach(() => {
    mockPutObject.mockClear()
  })

  it('accepts image/jpeg', async () => {
    const res = await request(app)
      .post('/assets')
      .attach('file', Buffer.from('fake-jpeg'), { filename: 'test.jpg', contentType: 'image/jpeg' })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.objectName).toMatch(UUID_RE)
    expect(mockPutObject).toHaveBeenCalledOnce()
  })

  it('accepts application/pdf', async () => {
    const res = await request(app)
      .post('/assets')
      .attach('file', Buffer.from('%PDF-fake'), { filename: 'doc.pdf', contentType: 'application/pdf' })

    expect(res.status).toBe(201)
    expect(res.body.data.url).toMatch(/^\/assets\//)
  })

  it('rejects text/html — stored XSS prevention', async () => {
    const res = await request(app)
      .post('/assets')
      .attach('file', Buffer.from('<script>alert(1)</script>'), {
        filename: 'evil.html',
        contentType: 'text/html',
      })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(mockPutObject).not.toHaveBeenCalled()
  })

  it('rejects application/javascript', async () => {
    const res = await request(app)
      .post('/assets')
      .attach('file', Buffer.from('alert(1)'), {
        filename: 'evil.js',
        contentType: 'application/javascript',
      })

    expect(res.status).toBe(400)
    expect(mockPutObject).not.toHaveBeenCalled()
  })

  it('returns 400 when no file is provided', async () => {
    const res = await request(app).post('/assets')
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})

describe('GET /assets/:objectName — C-02 path traversal prevention', () => {
  beforeEach(() => {
    mockGetObject.mockReset()
    mockStatObject.mockReset()
  })

  function makeStream(content: string): Readable {
    const stream = new Readable()
    stream.push(content)
    stream.push(null)
    return stream
  }

  it('serves a valid UUID-named asset inline (image)', async () => {
    const objectName = '550e8400-e29b-41d4-a716-446655440000.jpg'
    mockGetObject.mockResolvedValue({
      stream:        makeStream('fake-image'),
      contentType:   'image/jpeg',
      contentLength: 10,
    })

    const res = await request(app).get(`/assets/${objectName}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('image/jpeg')
    expect(res.headers['content-disposition']).toBeUndefined()
  })

  it('forces Content-Disposition: attachment for PDF (H-04)', async () => {
    const objectName = '550e8400-e29b-41d4-a716-446655440000.pdf'
    const content = '%PDF-fake'
    mockGetObject.mockResolvedValue({
      stream:        makeStream(content),
      contentType:   'application/pdf',
      contentLength: Buffer.byteLength(content),
    })

    const res = await request(app).get(`/assets/${objectName}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-disposition']).toBe('attachment')
  })

  it('rejects path traversal attempt ../../etc/passwd', async () => {
    const res = await request(app).get('/assets/../../etc/passwd')
    // Express router normalizes path separators; remaining string won't match UUID regex
    expect([400, 404]).toContain(res.status)
    expect(mockGetObject).not.toHaveBeenCalled()
  })

  it('rejects object name without UUID format', async () => {
    const res = await request(app).get('/assets/not-a-uuid.jpg')
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(mockGetObject).not.toHaveBeenCalled()
  })

  it('rejects object name with no extension', async () => {
    const res = await request(app).get('/assets/550e8400-e29b-41d4-a716-446655440000')
    expect(res.status).toBe(400)
    expect(mockGetObject).not.toHaveBeenCalled()
  })

  it('returns 404 when Garage object does not exist', async () => {
    const objectName = '550e8400-e29b-41d4-a716-446655440000.png'
    mockGetObject.mockRejectedValue(Object.assign(new Error('The specified key does not exist'), { name: 'NoSuchKey' }))

    const res = await request(app).get(`/assets/${objectName}`)
    expect(res.status).toBe(404)
  })
})
