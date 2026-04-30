import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const { ObjectId } = Schema.Types

const UserSchema = new Schema(
  {
    username: { type: String, required: true, trim: true, index: true },
    password: { type: String, select: false },
    roles: { type: [String], default: [] },
    bannerId: { type: String, trim: true },
    pidm: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    name: { type: String, trim: true },
    preferred: { type: String, trim: true },
    last: { type: String, trim: true },
    lastLogin: Date,
    directoryId: { type: ObjectId, ref: 'directoryPerson' },
    name_id: String,
    session_index: String,
  },
  {
    timestamps: true,
    collection: 'users',
    strict: true,
  },
)

export const Users = models.users || model('users', UserSchema)
