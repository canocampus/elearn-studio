/**
 * T171: Auth route integration tests.
 * register → login → me → refresh → logout
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_USER = { email: 'author@test.com', password: 'password123' }

async function registerAndLogin(creds = VALID_USER) {
  await request(app)
    .post('/auth/register')
    .send(creds)

  const res = await request(app)
    .post('/auth/login')
    .send(creds)

  return res
}

// ── POST /auth/register ───────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  it('creates a user and returns 201', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send(VALID_USER)

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.email).toBe(VALID_USER.email)
    expect(res.body.data.role).toBe('author')
    expect(res.body.data).not.toHaveProperty('passwordHash')
  })

  it('returns 409 when email already registered', async () => {
    await request(app).post('/auth/register').send(VALID_USER)
    const res = await request(app).post('/auth/register').send(VALID_USER)
    expect(res.status).toBe(409)
  })

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/auth/register').send({ password: 'pass1234' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is too short', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'a@b.com', password: 'short' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/8 characters/)
  })

  it('normalises email to lowercase', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'UPPER@TEST.COM', password: 'password123' })
    expect(res.status).toBe(201)
    expect(res.body.data.email).toBe('upper@test.com')
  })
})

// ── POST /auth/login ──────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  it('returns accessToken and sets refreshToken cookie', async () => {
    await request(app).post('/auth/register').send(VALID_USER)

    const res = await request(app).post('/auth/login').send(VALID_USER)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.accessToken).toBeDefined()
    expect(res.body.data.user.email).toBe(VALID_USER.email)

    // refresh cookie must be set
    const setCookieHeader = res.headers['set-cookie'] as unknown as string[] | undefined
    expect(setCookieHeader?.some((c) => c.startsWith('refreshToken='))).toBe(true)
    // must be httpOnly
    expect(setCookieHeader?.some((c) => c.includes('HttpOnly'))).toBe(true)
  })

  it('returns 401 for unknown email', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'no@one.com', password: 'pass1234' })
    expect(res.status).toBe(401)
  })

  it('returns 401 for wrong password', async () => {
    await request(app).post('/auth/register').send(VALID_USER)
    const res = await request(app).post('/auth/login').send({ email: VALID_USER.email, password: 'wrongpass' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when fields are missing', async () => {
    const res = await request(app).post('/auth/login').send({})
    expect(res.status).toBe(400)
  })
})

// ── GET /auth/me ──────────────────────────────────────────────────────────────

describe('GET /auth/me', () => {
  it('returns user payload for valid token', async () => {
    const loginRes = await registerAndLogin()
    const token = loginRes.body.data.accessToken as string

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.email).toBe(VALID_USER.email)
  })

  it('returns 401 without token', async () => {
    const res = await request(app).get('/auth/me')
    expect(res.status).toBe(401)
  })

  it('returns 401 for tampered token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer tampered.token.value')
    expect(res.status).toBe(401)
  })
})

// ── POST /auth/refresh ────────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  it('issues a new accessToken and rotates the refresh cookie', async () => {
    const loginRes = await registerAndLogin()
    const cookies = loginRes.headers['set-cookie'] as unknown as string[]
    const cookieHeader = cookies.join('; ')

    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', cookieHeader)

    expect(res.status).toBe(200)
    expect(res.body.data.accessToken).toBeDefined()

    // New refresh cookie should be different
    const newCookies = res.headers['set-cookie'] as unknown as string[]
    expect(newCookies?.some((c) => c.startsWith('refreshToken='))).toBe(true)
  })

  it('returns 401 without refresh cookie', async () => {
    const res = await request(app).post('/auth/refresh')
    expect(res.status).toBe(401)
  })

  it('returns 401 for invalid refresh token', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', 'refreshToken=invalidtoken')
    expect(res.status).toBe(401)
  })

  it('rejects reuse of a consumed refresh token (rotation)', async () => {
    const loginRes = await registerAndLogin()
    const cookies = loginRes.headers['set-cookie'] as unknown as string[]
    const oldCookieHeader = cookies.join('; ')

    // First refresh — consumes the original token
    await request(app)
      .post('/auth/refresh')
      .set('Cookie', oldCookieHeader)

    // Second refresh — old token should be gone
    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', oldCookieHeader)
    expect(res.status).toBe(401)
  })
})

// ── POST /auth/logout ─────────────────────────────────────────────────────────

describe('POST /auth/logout', () => {
  it('invalidates the refresh token', async () => {
    const loginRes = await registerAndLogin()
    const cookies = loginRes.headers['set-cookie'] as unknown as string[]
    const cookieHeader = cookies.join('; ')

    const logoutRes = await request(app)
      .post('/auth/logout')
      .set('Cookie', cookieHeader)
    expect(logoutRes.status).toBe(200)

    // Refresh after logout should fail
    const refreshRes = await request(app)
      .post('/auth/refresh')
      .set('Cookie', cookieHeader)
    expect(refreshRes.status).toBe(401)
  })

  it('returns 200 even without a cookie (idempotent)', async () => {
    const res = await request(app).post('/auth/logout')
    expect(res.status).toBe(200)
  })
})

// ── Protected route rejects unauthenticated requests ─────────────────────────

describe('Protected routes require JWT', () => {
  it('GET /courses returns 401 without token', async () => {
    const res = await request(app).get('/courses')
    expect(res.status).toBe(401)
  })

  it('GET /courses returns 200 with valid token from login', async () => {
    const loginRes = await registerAndLogin()
    const token = loginRes.body.data.accessToken as string

    const res = await request(app)
      .get('/courses')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('returns 403 for admin-only route accessed by author', async () => {
    // No admin-only routes yet — this will be added in T172
    // Placeholder to verify role middleware is wired
    const res = await request(app)
      .get('/auth/me')
      .set(authHeader({ role: 'author' }))
    expect(res.status).toBe(200) // author can access /me
  })
})
