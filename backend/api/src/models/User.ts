import { Schema, Model, model, models, Document } from 'mongoose'

export type UserRole = 'author' | 'admin'

export interface IUser extends Document {
  email: string
  passwordHash: string
  role: UserRole
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['author', 'admin'] satisfies UserRole[],
      default: 'author',
    },
  },
  { timestamps: true }
)

export const User = (models['User'] as Model<IUser>) ?? model<IUser>('User', userSchema)
