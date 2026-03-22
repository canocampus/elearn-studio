import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { healthRouter } from './routes/health'
import { coursesRouter } from './routes/courses'
import { assetsRouter } from './routes/assets'
import { simulationsRouter } from './routes/simulations'
import { apiKeyAuth } from './middleware/auth'

export const app: express.Application = express()

// C-04 fix: restrict CORS to configured origin only
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  })
)

app.use(express.json({ limit: '10mb' }))

// H-05 fix: rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})
app.use(limiter)

// /health is exempt from auth (used by Docker healthchecks)
app.use('/health', healthRouter)

// H-01: API key auth for all other routes
app.use(apiKeyAuth)

app.use('/courses', coursesRouter)
app.use('/assets', assetsRouter)
app.use('/', simulationsRouter)

// 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Not found' })
})

// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ success: false, error: 'Internal server error' })
})
