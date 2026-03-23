/**
 * Tests for MSW handler shapes — T165.5
 *
 * Verifies that each handler returns the expected response shape
 * (not testing backend logic — just validating mock contract).
 */

import { server } from '../../mocks/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const BASE = 'http://localhost:3001'

async function get(path: string) {
  return fetch(`${BASE}${path}`, {
    headers: { Authorization: 'Bearer mock-token' },
  })
}

async function post(path: string, body?: unknown) {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('MSW handlers — auth', () => {
  it('POST /auth/login returns accessToken', async () => {
    const res = await post('/auth/login', { email: 'dev@example.com', password: 'pass' })
    expect(res.ok).toBe(true)
    const json = await res.json()
    expect(json.data.accessToken).toBe('mock-token')
    expect(json.data.user.email).toBe('dev@example.com')
  })

  it('POST /auth/refresh returns accessToken', async () => {
    const res = await post('/auth/refresh')
    expect(res.ok).toBe(true)
    const json = await res.json()
    expect(json.data.accessToken).toBe('mock-token')
  })
})

describe('MSW handlers — courses', () => {
  it('GET /courses returns array', async () => {
    const res = await get('/courses')
    expect(res.ok).toBe(true)
    const json = await res.json()
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data[0]._id).toBe('mock-course-1')
  })

  it('GET /courses/:id returns course doc', async () => {
    const res = await get('/courses/mock-course-1')
    expect(res.ok).toBe(true)
    const json = await res.json()
    expect(json.data._id).toBe('mock-course-1')
    expect(Array.isArray(json.data.slides)).toBe(true)
  })

  it('POST /courses creates course with title', async () => {
    const res = await post('/courses', { title: 'New Test Course' })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.title).toBe('New Test Course')
    expect(json.data._id).toBeTruthy()
  })

  it('DELETE /courses/:id returns 204', async () => {
    const res = await fetch(`${BASE}/courses/mock-course-1`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer mock-token' },
    })
    expect(res.status).toBe(204)
  })
})

describe('MSW handlers — slides', () => {
  it('POST /courses/:id/slides adds a slide', async () => {
    const res = await post('/courses/mock-course-1/slides', { title: 'New Slide' })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.slides.some((s: { title: string }) => s.title === 'New Slide')).toBe(true)
  })
})

describe('MSW handlers — course history', () => {
  it('GET /courses/:id/history returns entries and meta', async () => {
    const res = await get('/courses/mock-course-1/history')
    expect(res.ok).toBe(true)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.meta).toMatchObject({ total: expect.any(Number), limit: expect.any(Number), skip: 0 })
  })

  it('GET /courses/:id/history respects limit and skip query params', async () => {
    const res = await get('/courses/mock-course-1/history?limit=1&skip=1')
    expect(res.ok).toBe(true)
    const json = await res.json()
    expect(json.data.length).toBeLessThanOrEqual(1)
    expect(json.meta.skip).toBe(1)
    expect(json.meta.limit).toBe(1)
  })
})

describe('MSW handlers — assets', () => {
  it('POST /assets returns url, objectName, originalName', async () => {
    const formData = new FormData()
    formData.append('file', new Blob(['test'], { type: 'image/png' }), 'test.png')
    const res = await fetch(`${BASE}/assets`, {
      method: 'POST',
      headers: { Authorization: 'Bearer mock-token' },
      body: formData,
    })
    expect(res.ok).toBe(true)
    const json = await res.json()
    expect(json.data.url).toContain('http')
    expect(json.data.objectName).toBeTruthy()
  })
})
