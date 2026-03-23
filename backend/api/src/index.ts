import dotenv from 'dotenv'
dotenv.config()

// T162: OTel must be bootstrapped before any other imports
import { startTracing } from './lib/tracing'
startTracing()

import { validateEnv } from './config'
import { app } from './app'
import { connectMongo } from './db'
import { initStorage } from './storage/s3'
import { logger } from './lib/logger'
import { stopTracing } from './lib/tracing'
import mongoose from 'mongoose'
import type { Server } from 'http'

validateEnv()

const PORT = process.env.PORT ?? '3001'

async function start(): Promise<void> {
  await connectMongo()
  await initStorage()

  const server: Server = app.listen(PORT, () => {
    logger.info({ port: PORT }, 'API server running')
  })

  // HIGH-2 fix: graceful shutdown so OTel flushes pending spans before exit
  function shutdown(): void {
    logger.info('Shutdown signal received, closing server')
    server.close(async () => {
      await stopTracing()
      await mongoose.disconnect()
      process.exit(0)
    })
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

start().catch((err: unknown) => {
  logger.error({ err }, 'Failed to start server')
  process.exit(1)
})
