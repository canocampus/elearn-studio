/**
 * Validates required environment variables at startup.
 * Fails fast with a clear message rather than a cryptic runtime error later.
 */
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

  if (errors.length > 0) {
    console.error('❌ Invalid environment configuration:')
    errors.forEach(e => console.error(`   • ${e}`))
    process.exit(1)
  }
}
