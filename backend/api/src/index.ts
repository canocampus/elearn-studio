import dotenv from 'dotenv'
dotenv.config()

import { validateEnv } from './config'
import { app } from './app'
import { connectMongo } from './db'
import { initStorage } from './storage/s3'

validateEnv()

const PORT = process.env.PORT ?? '3001'

async function start(): Promise<void> {
  await connectMongo()
  await initStorage()
  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`)
  })
}

start().catch((err: unknown) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
