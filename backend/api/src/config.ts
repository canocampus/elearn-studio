/**
 * Validates required environment variables at startup.
 * Fails fast with a clear message rather than a cryptic runtime error later.
 */
import { logger } from './lib/logger'

export function validateEnv(): void {
  const errors: string[] = []

  // PORT must be a valid number if set
  if (process.env.PORT !== undefined) {
    const port = parseInt(process.env.PORT, 10)
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push(`PORT="${process.env.PORT}" is not a valid port number (1–65535)`)
    }
  }

  // CORS_ORIGIN must be a valid URL if set
  if (process.env.CORS_ORIGIN) {
    try {
      new URL(process.env.CORS_ORIGIN)
    } catch {
      errors.push(`CORS_ORIGIN="${process.env.CORS_ORIGIN}" is not a valid URL`)
    }
  }

  // API_KEY must not be empty string if set (empty string = effectively disabled but confusing)
  if (process.env.API_KEY === '') {
    errors.push('API_KEY is set to an empty string — remove the variable to disable auth, or set a non-empty value')
  }

  // MEDIUM-3 fix: validate LOG_LEVEL against pino's supported levels
  const VALID_LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']
  if (process.env.LOG_LEVEL && !VALID_LOG_LEVELS.includes(process.env.LOG_LEVEL)) {
    errors.push(
      `LOG_LEVEL="${process.env.LOG_LEVEL}" must be one of: ${VALID_LOG_LEVELS.join(', ')}`
    )
  }

  // T171: JWT_SECRET required for auth (minimum 32 chars to resist brute-force)
  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET is required')
  } else if (process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters')
  }

  // JWT_EXPIRY must match the pattern patterned by jsonwebtoken if set
  if (process.env.JWT_EXPIRY && !/^\d+[smhdw]$/.test(process.env.JWT_EXPIRY)) {
    errors.push(`JWT_EXPIRY="${process.env.JWT_EXPIRY}" must be a duration like 15m, 1h, 7d`)
  }

  // ADMIN_PASSWORD required when ADMIN_EMAIL is set (seed script guard)
  if (process.env.ADMIN_EMAIL && !process.env.ADMIN_PASSWORD) {
    errors.push('ADMIN_PASSWORD is required when ADMIN_EMAIL is set')
  }

  // M-166-04: ALLOWED_MIME_TYPES must not be whitespace-only if set
  if (process.env.ALLOWED_MIME_TYPES !== undefined) {
    const types = process.env.ALLOWED_MIME_TYPES.split(',').map((t) => t.trim()).filter(Boolean)
    if (types.length === 0) {
      errors.push('ALLOWED_MIME_TYPES is set but contains no valid MIME types — remove the variable to use defaults')
    }
  }

  if (errors.length > 0) {
    logger.fatal({ errors }, 'Invalid environment configuration')
    process.exit(1)
  }
}
