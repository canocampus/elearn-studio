import { Schema, Model, model, models, Document, Types } from 'mongoose'

export interface IRefreshToken extends Document {
  userId: Types.ObjectId
  hashedToken: string
  expiresAt: Date
  createdAt: Date
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    hashedToken: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index: MongoDB removes doc at expiresAt
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

export const RefreshToken = (models['RefreshToken'] as Model<IRefreshToken>) ?? model<IRefreshToken>('RefreshToken', refreshTokenSchema)
