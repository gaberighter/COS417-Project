// server/api/audit-logs/index.post.ts
// POST /api/audit-logs — append one or more audit entries.
// Role: Admin | Faculty

import { createError, defineEventHandler, readBody } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { AuditLog, type IAuditLog } from '../../models/index'

type AuditInput = Partial<IAuditLog>

interface Payload {
  logs?: AuditInput[]
}

function normalizeAudit(input: AuditInput, fallbackUserId: string): IAuditLog {
  const action = String(input.action ?? '').trim()
  if (!action) {
    throw createError({ statusCode: 400, statusMessage: 'action is required' })
  }

  return {
    _id: input._id,
    userId: input.userId ?? fallbackUserId,
    covenantId: (input.covenantId ?? fallbackUserId).toLowerCase(),
    action,
    collection: input.collection ?? null,
    documentId: input.documentId ?? null,
    detail: String(input.detail ?? action),
    ipAddress: input.ipAddress ?? null,
    timestamp: input.timestamp ? new Date(input.timestamp) : new Date(),
  }
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin', 'Faculty'])
  await connectDB()

  let body: Payload | AuditInput | AuditInput[]
  try {
    body = (await readBody<Payload | AuditInput | AuditInput[]>(event)) ?? {}
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Missing or invalid JSON body' })
  }

  const rawLogs = Array.isArray(body)
    ? body
    : 'logs' in body && Array.isArray(body.logs)
      ? body.logs
      : [body as AuditInput]

  if (rawLogs.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'At least one log is required' })
  }

  const logs = rawLogs.map((raw) => normalizeAudit(raw, auth.userId.toLowerCase()))
  await AuditLog.insertMany(logs, { ordered: false })

  return { ok: true, count: logs.length }
})
