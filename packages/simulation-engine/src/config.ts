/**
 * Environment validation for simulation-engine.
 * Fails fast at startup if required vars are missing or invalid.
 */
export const config = {
  port: parseInt(process.env.PORT ?? '3002', 10),

  // TD-014.8a: CORS allow-origin for browser → :3002 recorder calls.
  // Single origin only (the authoring-ui dev server). No wildcards in prod.
  http: {
    allowedOrigin: process.env.SIMULATION_ENGINE_ALLOWED_ORIGIN ?? 'http://localhost:3000',
  },

  garage: {
    endpoint:  process.env.GARAGE_ENDPOINT  ?? 'localhost',
    port:      process.env.GARAGE_PORT      ?? '3900',
    useSsl:    process.env.GARAGE_USE_SSL   === 'true',
    region:    process.env.GARAGE_REGION    ?? 'garage',
    bucket:    process.env.GARAGE_BUCKET    ?? 'elearn-assets',
    accessKey: process.env.GARAGE_ACCESS_KEY,
    secretKey: process.env.GARAGE_SECRET_KEY,
  },

  recorder: {
    headless:       process.env.RECORDER_HEADLESS !== 'false',
    maxBrowsers:    parseInt(process.env.RECORDER_MAX_BROWSERS ?? '3', 10),
    timeoutMs:      parseInt(process.env.RECORDER_TIMEOUT_MS   ?? '300000', 10),  // 5 min
    pollIntervalMs: parseInt(process.env.RECORDER_POLL_MS      ?? '400', 10),
    debounceMs:     parseInt(process.env.RECORDER_DEBOUNCE_MS  ?? '150', 10),
  },
} as const

export function validateConfig(): void {
  const errors: string[] = []

  if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
    errors.push(`PORT="${process.env.PORT}" is not a valid port number`)
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(config.garage.endpoint)) {
    errors.push(`GARAGE_ENDPOINT="${config.garage.endpoint}" contains invalid characters`)
  }

  if (!config.garage.accessKey || !config.garage.secretKey) {
    errors.push('GARAGE_ACCESS_KEY and GARAGE_SECRET_KEY are required')
  }

  if (errors.length > 0) {
    console.error('[simulation-engine] Invalid configuration:')
    errors.forEach(e => console.error(`  • ${e}`))
    process.exit(1)
  }
}
