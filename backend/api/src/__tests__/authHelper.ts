/**
 * Test helper: creates a signed access token for use in integration tests.
 * Uses the same JWT_SECRET set in setup.ts.
 */
import { signAccessToken } from '../utils/jwt'
import type { AccessTokenPayload } from '../utils/jwt'

export function makeAuthToken(overrides: Partial<AccessTokenPayload> = {}): string {
  return signAccessToken({
    sub: 'test-user-id',
    email: 'test@example.com',
    role: 'author',
    ...overrides,
  })
}

export function authHeader(overrides?: Partial<AccessTokenPayload>): { Authorization: string } {
  return { Authorization: `Bearer ${makeAuthToken(overrides)}` }
}
