import express, { Router } from 'express'
import mongoose from 'mongoose'
import { initStorage } from '../storage/s3'

export const healthRouter: express.Router = Router()

// T154-006 fix: cache storage health to avoid a HeadBucketCommand round-trip on every
// health-check request. High-frequency polling (e.g. Docker healthcheck every 10 s)
// would otherwise overwhelm Garage with unnecessary requests.
const STORAGE_CACHE_TTL_MS = 30_000 // 30 seconds
let storageHealthCache: { status: 'ok' | 'error'; ts: number } | null = null

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: Returns liveness status for MongoDB and Garage storage. Not protected by auth. Storage status is cached for 30 seconds.
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: All subsystems healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:  { type: string, enum: [ok, degraded], example: ok }
 *                 mongo:   { type: string, enum: [ok, error], example: ok }
 *                 storage: { type: string, enum: [ok, error], example: ok }
 *       503:
 *         description: One or more subsystems degraded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:  { type: string, example: degraded }
 *                 mongo:   { type: string, example: error }
 *                 storage: { type: string, example: ok }
 */
healthRouter.get('/', async (_req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'ok' : 'error'

  let storageStatus: 'ok' | 'error'
  const now = Date.now()
  if (storageHealthCache && now - storageHealthCache.ts < STORAGE_CACHE_TTL_MS) {
    storageStatus = storageHealthCache.status
  } else {
    try {
      await initStorage()
      storageStatus = 'ok'
    } catch {
      storageStatus = 'error'
    }
    storageHealthCache = { status: storageStatus, ts: now }
  }

  const overall = mongoStatus === 'ok' && storageStatus === 'ok' ? 'ok' : 'degraded'

  res.status(overall === 'ok' ? 200 : 503).json({
    status:  overall,
    mongo:   mongoStatus,
    storage: storageStatus,
  })
})
