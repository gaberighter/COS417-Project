// server/api/audit-logs/index.post.ts
// POST /api/audit-logs — append one or more audit entries.
// Role: Admin | Faculty

import { createError, defineEventHandler, getHeader, readBody } from 'h3'
import { requireAuth, type AuthContext } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { AuditLog, Professor, type IAuditLog } from '../../models/index'

type AuditInput = {
  action?: unknown
  collection?: unknown
  documentId?: unknown
  detail?: unknown
  userId?: unknown
  covenantId?: unknown
  ipAddress?: unknown
  timestamp?: unknown
  _id?: unknown
}

interface ActorIdentity {
  userId: string | null
  covenantId: string
}

const ALLOWED_ACTIONS = new Set([
  'COURSE_UPSERT',
  'PROFESSOR_UPSERT',
  'PREFERENCE_SUBMIT',
  'ROOM_UPSERT',
  'SCHEDULE_RUN',
  'SCHEDULE_UPSERT',
  'SCHEDULE_UPDATE',
  'SCHEDULE_OVERRIDE',
  'SCHEDULE_EXPORT',
  'AUDIT_IMPORT',
])

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function toNullableText(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }

  const text = String(value).trim()
  return text || null
}

function getClientIp(event: Parameters<typeof getHeader>[0]): string | null {
  const forwardedFor = getHeader(event, 'x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) {
      return first
    }
  }

  const realIp = getHeader(event, 'x-real-ip')
  if (realIp?.trim()) {
    return realIp.trim()
  }

  return null
}

async function resolveActorIdentity(auth: AuthContext): Promise<ActorIdentity> {
  const fallbackCovenantId = auth.userId.toLowerCase()
  const professor = await Professor.findOne({
    $or: [
      { covenantId: fallbackCovenantId },
      { _id: fallbackCovenantId },
      { _id: auth.userId },
    ],
  })
    .select({ _id: 1, covenantId: 1 })
    .lean()
    .exec()

  return {
    userId: professor?._id ?? null,
    covenantId: professor?.covenantId ?? fallbackCovenantId,
  }
}

function normalizeAudit(
  input: AuditInput,
  actor: ActorIdentity,
  ipAddress: string | null,
): IAuditLog {
  if (
    input._id !== undefined ||
    input.userId !== undefined ||
    input.covenantId !== undefined ||
    input.ipAddress !== undefined ||
    input.timestamp !== undefined
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Client may not set _id, userId, covenantId, ipAddress, or timestamp',
    })
  }

  const action = String(input.action ?? '')
    .trim()
    .toUpperCase()
  if (!action) {
    throw createError({ statusCode: 400, statusMessage: 'action is required' })
  }
  if (!ALLOWED_ACTIONS.has(action)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Unsupported action: ${action}`,
    })
  }

  const detail = String(input.detail ?? action).trim()
  if (!detail) {
    throw createError({ statusCode: 400, statusMessage: 'detail is required' })
  }
  if (detail.length > 1000) {
    throw createError({
      statusCode: 400,
      statusMessage: 'detail must be 1000 characters or fewer',
    })
  }

  return {
    userId: actor.userId,
    covenantId: actor.covenantId,
    action,
    collection: toNullableText(input.collection),
    documentId: toNullableText(input.documentId),
    detail,
    ipAddress,
    timestamp: new Date(),
  }
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin', 'Faculty'])
  await connectDB()
  const actor = await resolveActorIdentity(auth)
  const ipAddress = getClientIp(event)

  let body: unknown
  try {
    body = (await readBody<unknown>(event)) ?? {}
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing or invalid JSON body',
    })
  }

  const rawLogs = Array.isArray(body)
    ? body
    : isObject(body) && Array.isArray(body.logs)
      ? body.logs
      : [body]

  if (rawLogs.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'At least one log is required',
    })
  }

  const logs = rawLogs.map((raw) => {
    if (!isObject(raw)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Each log entry must be an object',
      })
    }

    return normalizeAudit(raw as AuditInput, actor, ipAddress)
  })
  await AuditLog.insertMany(logs, { ordered: false })

  return { ok: true, count: logs.length }
})
