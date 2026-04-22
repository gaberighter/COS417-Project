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

export async function logAction(
  actor: AuthContext,
  action: string,
  targetCollection: string,
  targetId?: string,
  detail?: string | Record<string, unknown>,
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
    ipAddress: null,
  }

  await AuditLog.create(entry)
}
