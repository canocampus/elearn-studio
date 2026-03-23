import express, { Router } from 'express'
import mongoose from 'mongoose'
import { initStorage } from '../storage/s3'

export const healthRouter: express.Router = Router()

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: Returns liveness status for MongoDB and Garage storage. Not protected by auth.
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

  let storageStatus = 'error'
  try {
    await initStorage()
    storageStatus = 'ok'
  } catch {
    // garage unreachable
  }

  const overall = mongoStatus === 'ok' && storageStatus === 'ok' ? 'ok' : 'degraded'

  res.status(overall === 'ok' ? 200 : 503).json({
    status:  overall,
    mongo:   mongoStatus,
    storage: storageStatus,
  })
})
