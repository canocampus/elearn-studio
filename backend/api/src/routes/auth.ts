import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { User } from '../models/User'
import { RefreshToken } from '../models/RefreshToken'
import { hashPassword, verifyPassword } from '../utils/password'
import { signAccessToken } from '../utils/jwt'
import { requireAuth } from '../middleware/auth'
import { logger } from '../lib/logger'

export const authRouter: ReturnType<typeof Router> = Router()

const REFRESH_TOKEN_BYTES = 40
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// ─── Helpers ───────────────────────────────────────────────────────────────

function hashRefreshToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_TTL_MS,
    path: '/auth/refresh',
  })
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie('refreshToken', { path: '/auth/refresh' })
}

// ─── Routes ────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Only available when ALLOW_REGISTRATION=true env var is set (or in test env).
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email, example: user@example.com }
 *               password: { type: string, minLength: 8, example: secretpass }
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/UserInfo' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       403:
 *         description: Registration disabled
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
/**
 * POST /auth/register
 * Only available when ALLOW_REGISTRATION=true (or in test env).
 */
authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    if (
      process.env.ALLOW_REGISTRATION !== 'true' &&
      process.env.NODE_ENV !== 'test'
    ) {
      res.status(403).json({ success: false, error: 'Registration is disabled' })
      return
    }

    const { email, password } = req.body as { email?: string; password?: string }

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'email and password are required' })
      return
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ success: false, error: 'email and password must be strings' })
      return
    }
    if (password.length < 8) {
      res.status(400).json({ success: false, error: 'password must be at least 8 characters' })
      return
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() })
    if (existing) {
      res.status(409).json({ success: false, error: 'Email already registered' })
      return
    }

    const passwordHash = await hashPassword(password)
    const user = await User.create({ email, passwordHash })

    logger.info({ userId: user.id }, 'User registered')
    res.status(201).json({ success: true, data: { id: user.id, email: user.email, role: user.role } })
  } catch (error: unknown) {
    logger.error({ error }, 'User registration failed')
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in and receive tokens
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email, example: user@example.com }
 *               password: { type: string, example: secretpass }
 *     responses:
 *       200:
 *         description: Login successful — sets httpOnly refreshToken cookie
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         accessToken: { type: string, example: eyJhbGciOiJIUzI1NiJ9... }
 *                         user: { $ref: '#/components/schemas/UserInfo' }
 *       400:
 *         description: Missing credentials
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
/**
 * POST /auth/login
 */
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string }

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ success: false, error: 'email and password are required' })
      return
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' })
      return
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' })
      return
    }

    // Issue tokens
    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role })
    const rawRefresh = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex')
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS)

    await RefreshToken.create({
      userId: user._id,
      hashedToken: hashRefreshToken(rawRefresh),
      expiresAt,
    })

    setRefreshCookie(res, rawRefresh)

    logger.info({ userId: user.id }, 'User logged in')
    res.json({
      success: true,
      data: { accessToken, user: { id: user.id, email: user.email, role: user.role } },
    })
  } catch (error: unknown) {
    logger.error({ error }, 'User login failed')
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get current user info
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/UserInfo' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
/**
 * GET /auth/me — returns current user info (requires valid access token)
 */
authRouter.get('/me', requireAuth, (req: Request, res: Response): void => {
  res.json({ success: true, data: req.user })
})

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Exchange the httpOnly refreshToken cookie for a new access token. Rotates the refresh token.
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: New access token issued
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         accessToken: { type: string, example: eyJhbGciOiJIUzI1NiJ9... }
 *       401:
 *         description: Missing, invalid, or expired refresh token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
/**
 * POST /auth/refresh — exchange refresh cookie for a new access token
 */
authRouter.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const rawRefresh = req.cookies?.refreshToken as string | undefined
  if (!rawRefresh) {
    res.status(401).json({ success: false, error: 'No refresh token' })
    return
  }

  const hashed = hashRefreshToken(rawRefresh)
  const storedToken = await RefreshToken.findOne({ hashedToken: hashed })

  if (!storedToken || storedToken.expiresAt < new Date()) {
    clearRefreshCookie(res)
    res.status(401).json({ success: false, error: 'Invalid or expired refresh token' })
    return
  }

  const user = await User.findById(storedToken.userId)
  if (!user) {
    await storedToken.deleteOne()
    clearRefreshCookie(res)
    res.status(401).json({ success: false, error: 'User not found' })
    return
  }

  // Rotate the refresh token in production.
  // In dev/test: skip rotation so parallel Playwright workers can all reuse the same
  // storageState refresh cookie without racing to consume a single-use token.
  let cookieToSet: string
  if (process.env.NODE_ENV === 'production') {
    await storedToken.deleteOne()
    const newRaw = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex')
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS)
    await RefreshToken.create({
      userId: user._id,
      hashedToken: hashRefreshToken(newRaw),
      expiresAt,
    })
    cookieToSet = newRaw
  } else {
    // Reuse the existing raw token (re-derive from request cookie)
    cookieToSet = rawRefresh
  }

  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role })
  setRefreshCookie(res, cookieToSet)

  res.json({ success: true, data: { accessToken } })
})

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Log out — invalidate refresh token
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: Logged out (cookie cleared)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 */
/**
 * POST /auth/logout — invalidate refresh token
 */
authRouter.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const rawRefresh = req.cookies?.refreshToken as string | undefined
  if (rawRefresh) {
    await RefreshToken.deleteOne({ hashedToken: hashRefreshToken(rawRefresh) })
  }
  clearRefreshCookie(res)
  res.json({ success: true })
})
