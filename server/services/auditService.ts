// server/services/auditService.ts
// §4.7 Audit Service — append-only log of every state-mutating action.

import type { AuthContext } from '../utils/auth'
import { AuditLog, Professor, type IAuditLog } from '../models/index'
export { getClientIpFromHeaders } from '../utils/ip'
import type { H3Event } from 'h3'
import { getClientIp } from '../utils/ip'

function toDetailText(
  action: string,
  collection: string | null | undefined,
  detail: string | Record<string, unknown> | undefined,
): string {
  if (typeof detail === 'string' && detail.trim()) {
    return detail
  }

  if (detail) {
    return JSON.stringify(detail)
  }

  return collection ? `${action} on ${collection}` : action
}

// `getClientIpFromHeaders` is provided by `server/utils/ip.ts` and re-exported
// here to keep the audit service API stable while avoiding duplicate logic.

export async function logAction(
  actor: AuthContext,
  action: string,
  targetCollection: string,
  targetId?: string,
  detail?: string | Record<string, unknown>,
  ipAddress?: string | null,
): Promise<void> {
  const professor = await Professor.findOne({
    $or: [
      { covenantId: actor.userId.toLowerCase() },
      { _id: actor.userId.toLowerCase() },
      { _id: actor.userId },
    ],
  })
    .select({ _id: 1, covenantId: 1 })
    .lean()
    .exec()

  const now = new Date()
  const entry: IAuditLog = {
    timestamp: now,
    userId: professor?._id ?? null,
    covenantId: professor?.covenantId ?? actor.userId.toLowerCase(),
    action,
    collectionName: targetCollection,
    documentId: targetId ?? null,
    detail: toDetailText(action, targetCollection, detail),
    ipAddress: ipAddress ?? null,
  }

  await AuditLog.create(entry)
}

/**
 * Convenience wrapper: derive actor and client IP from the H3 event and log an action.
 * Safe to call when `event.context.auth` is missing — will record covenantId as 'system'.
 */
export async function logActionForEvent(
  event: H3Event,
  action: string,
  targetCollection: string,
  targetId?: string,
  detail?: string | Record<string, unknown>,
): Promise<void> {
  const auth = (event.context && (event.context as any).auth) as
    | AuthContext
    | undefined
  const actor: AuthContext = auth ?? { userId: 'system', role: 'Admin' }
  const ip = getClientIp(event)
  await logAction(actor, action, targetCollection, targetId, detail, ip)
}

/**
 * Log authentication event.
 * @param userId - The user ID or covenant ID attempting to authenticate
 * @param action - LOGIN_SUCCESS or LOGIN_FAILURE
 * @param ipAddress - Client IP address
 * @param detail - Optional detail message (e.g., failure reason)
 */
export async function logAuthEvent(
  userId: string,
  action: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE',
  ipAddress: string | null,
  detail?: string,
): Promise<void> {
  const professor = await Professor.findOne({
    $or: [
      { covenantId: userId.toLowerCase() },
      { _id: userId.toLowerCase() },
      { _id: userId },
    ],
  })
    .select({ _id: 1, covenantId: 1 })
    .lean()
    .exec()

  const now = new Date()
  const entry: IAuditLog = {
    timestamp: now,
    userId: professor?._id ?? null,
    covenantId: professor?.covenantId ?? userId.toLowerCase(),
    action,
    collectionName: null,
    documentId: null,
    detail: detail ?? action,
    ipAddress: ipAddress ?? null,
  }

  await AuditLog.create(entry)
}
