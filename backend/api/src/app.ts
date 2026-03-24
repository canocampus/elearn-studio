import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import pinoHttp, { stdSerializers } from 'pino-http'
import cookieParser from 'cookie-parser'
import { healthRouter } from './routes/health'
import { authRouter } from './routes/auth'
import { coursesRouter } from './routes/courses'
import { assetsRouter } from './routes/assets'
import { simulationsRouter } from './routes/simulations'
import { telemetryRouter } from './routes/telemetry'
import { requireAuth } from './middleware/auth'
import { logger } from './lib/logger'
import { swaggerSpec } from './lib/swagger'
import swaggerUi from 'swagger-ui-express'

export const app: express.Application = express()

// T166: HTTP security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      mediaSrc:   ["'self'", 'blob:'],
      objectSrc:  ["'none'"],
    },
  },
}))

// T162: request/response structured logging
// HIGH-1 fix: redact sensitive headers so API keys and auth tokens never appear in logs
// NOTE: stdSerializers.req returns s.headers as a reference to req.headers — clone before
// deleting so we do NOT mutate the live request object (which would strip auth headers).
app.use(pinoHttp({
  logger,
  serializers: {
    req(req) {
      const s = stdSerializers.req(req)
      if (s.headers) {
        s.headers = { ...s.headers }
        delete s.headers['authorization']
        delete s.headers['x-api-key']
        delete s.headers['cookie']
      }
      return s
    },
    res: stdSerializers.res,
  },
}))

// C-04 fix: restrict CORS to configured origin only
// credentials: true required so browsers accept responses from cross-origin
// fetches that include credentials (cookies / Authorization header)
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  })
)

app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())

// H-05 fix: rate limiting (disabled in dev/test so E2E runs don't trip the limit)
if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 200,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
  app.use(limiter)
}

// T168: Swagger UI — dev only (disabled in production)
if (process.env.NODE_ENV !== 'production') {
  // Swagger UI requires relaxed CSP (inline scripts + styles from swagger-ui package)
  app.use(
    '/docs',
    (_req: Request, _res: Response, next: NextFunction) => {
      // Override Helmet CSP for this path only
      _res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:",
      )
      next()
    },
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, { customSiteTitle: 'eLearn Studio API Docs' }),
  )
}

// /health is exempt from auth (used by Docker healthchecks)
app.use('/health', healthRouter)

// T171: /auth routes are public (login, register, refresh, logout)
app.use('/auth', authRouter)

// T171: all other routes require a valid JWT
app.use(requireAuth)

app.use('/courses', coursesRouter)
app.use('/assets', assetsRouter)
app.use('/telemetry', telemetryRouter)
app.use('/', simulationsRouter)

// 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Not found' })
})

// Global error handler — T162: log structured error with traceId
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const traceId = (req as Request & { id?: string }).id
  logger.error({ err, traceId, method: req.method, path: req.path }, 'Unhandled error')
  res.status(500).json({ success: false, error: 'Internal server error' })
})
