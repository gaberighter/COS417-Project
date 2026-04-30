// server/api/audit-logs/index.get.ts
// GET /api/audit-logs — returns recent audit logs.
// Role: Admin — view audit history.

import { defineEventHandler, getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { AuditLog } from '../../models/index'

const DEFAULT_LIMIT = 500
const MAX_LIMIT = 2000

function parseLimit(value: unknown): number {
  if (typeof value !== 'string' || !value.trim()) {
    return DEFAULT_LIMIT
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT
  }

  return Math.min(Math.floor(parsed), MAX_LIMIT)
}

export default defineEventHandler(async (event) => {
  requireAuth(event, ['Admin'])
  await connectDB()

  const query = getQuery(event)
  const limit = parseLimit(query.limit)

  return AuditLog.find({}).sort({ timestamp: -1 }).limit(limit).lean().exec()
})
