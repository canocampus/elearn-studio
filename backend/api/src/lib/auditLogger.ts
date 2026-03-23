import mongoose from 'mongoose'
import { AuditLog, type AuditAction } from '../models/AuditLog'
import type { AccessTokenPayload } from '../utils/jwt'
import { logger } from './logger'

/**
 * Write an audit log entry. Fire-and-forget — never throws.
 * Call after the DB mutation succeeds so failed operations are not logged.
 */
export async function logAudit(
  courseId: string | mongoose.Types.ObjectId,
  action: AuditAction,
  actor: AccessTokenPayload,
  detail: Record<string, unknown> = {},
): Promise<void> {
  try {
    await AuditLog.create({
      courseId: new mongoose.Types.ObjectId(String(courseId)),
      action,
      actorId: actor.sub,
      actorEmail: actor.email,
      detail,
    })
  } catch (err) {
    // Audit failures must never break the primary operation — only log
    logger.error({ err, courseId, action }, 'auditLogger: failed to write audit entry')
  }
}
