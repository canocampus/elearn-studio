import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken, type AccessTokenPayload } from '../utils/jwt'
import type { UserRole } from '../models/User'

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload
    }
  }
}

/**
 * T171: JWT bearer token authentication.
 * Extracts and verifies the Authorization: Bearer <token> header.
 * Sets req.user on success; returns 401 on failure.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }

  const token = header.slice(7)
  try {
    req.user = verifyAccessToken(token)
    next()
  } catch {
    res.status(401).json({ success: false, error: 'Unauthorized' })
  }
}

/**
 * Role-based access control gate. Must be used AFTER requireAuth.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Forbidden' })
      return
    }
    next()
  }
}
