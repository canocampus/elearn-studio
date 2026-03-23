import mongoose, { Schema, Document, Model, model, models } from 'mongoose'

export type AuditAction =
  | 'course.create'
  | 'course.update'
  | 'course.delete'
  | 'slide.create'
  | 'slide.update'
  | 'slide.delete'
  | 'slide.reorder'

export interface IAuditLog extends Document {
  courseId: mongoose.Types.ObjectId
  action: AuditAction
  actorId: string
  actorEmail: string
  detail: Record<string, unknown>
  createdAt: Date
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    courseId: { type: Schema.Types.ObjectId, required: true },
    action: {
      type: String,
      required: true,
      enum: [
        'course.create',
        'course.update',
        'course.delete',
        'slide.create',
        'slide.update',
        'slide.delete',
        'slide.reorder',
      ] satisfies AuditAction[],
    },
    actorId: { type: String, required: true },
    actorEmail: { type: String, required: true },
    // Arbitrary action context: slideId, field names changed, etc.
    detail: { type: Schema.Types.Mixed, default: {} },
  },
  {
    // Only createdAt — audit entries are immutable, no updatedAt needed
    timestamps: { createdAt: true, updatedAt: false },
  }
)

// H-167-02: compound index for the history query (courseId filter + createdAt sort)
// replaces the single-field courseId index — covers all GET /courses/:id/history queries
AuditLogSchema.index({ courseId: 1, createdAt: -1 })

export const AuditLog =
  (models['AuditLog'] as Model<IAuditLog>) ??
  model<IAuditLog>('AuditLog', AuditLogSchema)
