/**
 * Idempotent admin user seed script.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret123 npx ts-node src/scripts/seed-admin.ts
 *
 * Safe to re-run: does nothing if the admin already exists.
 */
import mongoose from 'mongoose'
import { User } from '../models/User'
import { hashPassword } from '../utils/password'

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const mongoUri = process.env.MONGO_URI ?? 'mongodb://localhost:27017/elearn'

  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD env vars are required')
    process.exit(1)
  }

  await mongoose.connect(mongoUri)

  const existing = await User.findOne({ email: email.toLowerCase().trim() })
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin'
      await existing.save()
      console.log(`Updated existing user ${email} to admin role`)
    } else {
      console.log(`Admin user ${email} already exists — nothing to do`)
    }
    await mongoose.disconnect()
    return
  }

  const passwordHash = await hashPassword(password)
  await User.create({ email, passwordHash, role: 'admin' })
  console.log(`Created admin user: ${email}`)

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
