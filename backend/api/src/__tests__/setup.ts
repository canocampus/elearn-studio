/**
 * Test setup: connects to Docker MongoDB on localhost:27017/elearn-test.
 * Requires the Docker mongo service to be running (docker compose up -d mongo).
 * Using a dedicated test database ensures isolation from development data.
 */
import mongoose from 'mongoose'
import { beforeAll, afterAll, afterEach } from 'vitest'

const MONGO_URI = process.env.MONGO_URI_TEST ?? 'mongodb://localhost:27017/elearn-test'

beforeAll(async () => {
  await mongoose.connect(MONGO_URI)
})

afterEach(async () => {
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key].deleteMany({})
  }
})

afterAll(async () => {
  await mongoose.disconnect()
})
