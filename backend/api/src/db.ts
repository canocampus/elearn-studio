import mongoose from 'mongoose'
import { logger } from './lib/logger'

export async function connectMongo(): Promise<void> {
  const uri = process.env.MONGO_URI ?? 'mongodb://localhost:27017/elearn'
  await mongoose.connect(uri)
  logger.info({ uri: uri.replace(/\/\/[^@]+@/, '//***@') }, 'Connected to MongoDB')
}
