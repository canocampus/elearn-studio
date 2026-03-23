import jwt from 'jsonwebtoken'
import type { UserRole } from '../models/User'

export interface AccessTokenPayload {
  sub: string    // userId
  email: string
  role: UserRole
}

function secret(): string {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET is not set')
  return s
}

function expiry(): string {
  return process.env.JWT_EXPIRY ?? '15m'
}

export function signAccessToken(payload: AccessTokenPayload): string {
  // Cast required: @types/jsonwebtoken uses branded StringValue from ms, but a plain string is valid at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jwt.sign(payload, secret(), { expiresIn: expiry() as any })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, secret()) as AccessTokenPayload
}
