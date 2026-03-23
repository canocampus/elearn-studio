/**
 * T162 — Structured logger (Pino)
 *
 * Usage: `import { logger } from './lib/logger'`
 *
 * Log levels driven by LOG_LEVEL env var (default: 'info').
 * In production (NODE_ENV=production) output is JSON; otherwise pretty-printed.
 */

import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
  base: {
    service: 'elearn-api',
    env: process.env.NODE_ENV ?? 'development',
  },
})
