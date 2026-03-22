import { Request, Response, NextFunction } from 'express'

/**
 * H-01: API key authentication stub.
 * Set API_KEY env var to enable. If unset, auth is skipped (dev mode).
 * Replace with proper JWT/OAuth in production.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.API_KEY
  if (!apiKey) {
    // No key configured — open access (development only)
    next()
    return
  }

  const provided = req.headers['x-api-key']
  if (provided !== apiKey) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }

  next()
}
