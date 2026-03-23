/**
 * T163 — Telemetry routes
 *
 * POST /telemetry/client-errors
 *   Receives unhandled client-side errors from the authoring UI.
 *   Requires Bearer token in Authorization header (enforced by the global
 *   requireAuth middleware mounted in app.ts before this router).
 *   Validates payload with Zod, then logs via Pino with source:'client'
 *   so it flows to Loki (T170).
 */

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { logger } from '../lib/logger'

export const telemetryRouter: ReturnType<typeof Router> = Router()

// Per-user rate limit: 30 client-error reports per minute per authenticated user.
// Prevents a single user from flooding the endpoint. Falls back to IP when sub is absent.
const clientErrorLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.user?.sub ?? req.ip ?? 'anonymous',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})

const clientErrorSchema = z.object({
  message: z.string().min(1).max(500),
  stack: z.string().max(2000).optional(),
  url: z.string().url(),
  line: z.number().int().min(0).max(99999),
  column: z.number().int().min(0).max(99999),
  userId: z.string().nullable(),
  timestamp: z.string().datetime(),
  buildVersion: z.string().min(1).max(100),
  context: z.record(z.string(), z.unknown())
    .refine(
      (ctx) => JSON.stringify(ctx).length <= 1024,
      { message: 'context must not exceed 1 KB when serialized' },
    )
    .optional(),
})

/**
 * @openapi
 * /telemetry/ping:
 *   get:
 *     summary: Telemetry pipeline health check (dev only)
 *     description: Returns 404 in production. Lets developers confirm auth → API → Pino → Loki pipeline is wired up.
 *     tags: [Telemetry]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ping received
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:     { type: boolean, example: true }
 *                 userId: { type: string, nullable: true }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       404:
 *         description: Not available in production
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
// ── GET /telemetry/ping — dev-only pipeline verification ──────────────────────
// LO-002 (issues-T163.md): lets developers confirm that the auth → API →
// Pino → Loki pipeline is wired up correctly without generating a real error.
// Gated to non-production environments so it cannot be reached in prod.
telemetryRouter.get('/ping', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ success: false, error: 'Not found' })
    return
  }
  logger.info({ source: 'telemetry-ping', userId: req.user?.sub }, 'Telemetry ping received')
  res.status(200).json({ ok: true, userId: req.user?.sub ?? null })
})

/**
 * @openapi
 * /telemetry/client-errors:
 *   post:
 *     summary: Report a client-side error
 *     description: Receives unhandled errors from the authoring UI. Rate limited to 30 per minute per user.
 *     tags: [Telemetry]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message, url, line, column, userId, timestamp, buildVersion]
 *             properties:
 *               message:      { type: string, maxLength: 500 }
 *               stack:        { type: string, maxLength: 2000 }
 *               url:          { type: string, format: uri }
 *               line:         { type: integer, minimum: 0, maximum: 99999 }
 *               column:       { type: integer, minimum: 0, maximum: 99999 }
 *               userId:       { type: string, nullable: true }
 *               timestamp:    { type: string, format: date-time }
 *               buildVersion: { type: string, maxLength: 100 }
 *               context:      { type: object, description: Max 1 KB serialized }
 *     responses:
 *       200:
 *         description: Error logged
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
telemetryRouter.post('/client-errors', clientErrorLimiter, (req: Request, res: Response) => {
  const parsed = clientErrorSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message })
    return
  }

  const { message, stack, url, line, column, timestamp, buildVersion, context } = parsed.data

  logger.warn(
    { source: 'client', userId: req.user?.sub, message, stack, url, line, column, timestamp, buildVersion, context },
    `Client error: ${message}`,
  )

  res.status(200).json({ success: true })
})
