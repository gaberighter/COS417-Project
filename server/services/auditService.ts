// server/services/auditService.ts
// §4.7 Audit Service — append-only log of every state-mutating action.

import type { AuthContext } from '../utils/auth'
import { AuditLog, Professor, type IAuditLog } from '../models/index'

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

/**
 * Extract client IP address from request headers.
 * Checks X-Forwarded-For, X-Real-IP, and falls back to null.
 */
export function getClientIpFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): string | null {
  const forwardedFor = headers['x-forwarded-for']
  if (forwardedFor) {
    const first = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)
      ?.split(',')[0]
      ?.trim()
    if (first) {
      return first
    }
  }

  const realIp = headers['x-real-ip']
  if (realIp) {
    const ip = Array.isArray(realIp) ? realIp[0] : realIp
    if (ip?.trim()) {
      return ip.trim()
    }
  }

  return null
}

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
