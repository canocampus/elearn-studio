import express, { Router } from 'express'
import mongoose from 'mongoose'
import { initStorage } from '../storage/s3'

export const healthRouter: express.Router = Router()

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
