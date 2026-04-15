// server/services/auditService.ts
// §4.7 Audit Service — append-only log of every state-mutating action.
// STUB: writes to the in-memory db.auditLogs array.
//       Replace the push() call with an AuditLog.create() Mongoose call.

import type { AuthContext } from '../utils/auth'
import { db, type IAuditLog } from '../models/index'

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
  const professor = db.professors.find(
    (candidate) =>
      candidate.covenantId === actor.userId || candidate._id === actor.userId,
  )
  const now = new Date()
  const entry: IAuditLog = {
    timestamp: now,
    userId: professor?._id ?? null,
    covenantId: professor?.covenantId ?? actor.userId,
    action,
    collection: targetCollection,
    documentId: targetId ?? null,
    detail: toDetailText(action, targetCollection, detail),
    ipAddress: null,
    createdAt: now,
    updatedAt: now,
  }

  // TODO: replace with → await AuditLog.create(entry);
  db.auditLogs.push(entry)
}
