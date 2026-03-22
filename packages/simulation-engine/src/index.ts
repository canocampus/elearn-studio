import 'dotenv/config'
import express from 'express'
import { validateConfig, config } from './config'
import { checkStorage } from './storage/s3'
import { recorderRouter } from './routes/recorder'
import { activeBrowserCount, stopAllRecordings } from './recorder/browser'
import { activeCount as activeSessionCount } from './recorder/sessions'

validateConfig()

const app = express()
// H-02: limit request body size to prevent large payload abuse
app.use(express.json({ limit: '100kb' }))

// ── Routes ────────────────────────────────────────────────────────────────────

app.use('/recorder', recorderRouter)

/** GET /health — liveness + readiness check */
app.get('/health', async (_req, res) => {
  try {
    await checkStorage()
    res.json({
      status:   'ok',
      storage:  'ok',
      browsers: activeBrowserCount(),
      sessions: activeSessionCount(),
    })
  } catch (err: any) {
    res.status(503).json({
      status:  'degraded',
      storage: 'error',
      error:   err?.message ?? 'Storage unreachable',
    })
  }
})

// ── Start ─────────────────────────────────────────────────────────────────────

const server = app.listen(config.port, () => {
  console.log(`[simulation-engine] listening on port ${config.port}`)
})

// ── Graceful shutdown ─────────────────────────────────────────────────────────

async function shutdown(signal: string) {
  console.log(`[simulation-engine] ${signal} received — shutting down`)
  // H-04: stop all active Playwright sessions before closing the HTTP server
  await stopAllRecordings()
  server.close(() => {
    console.log('[simulation-engine] HTTP server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT',  () => void shutdown('SIGINT'))
