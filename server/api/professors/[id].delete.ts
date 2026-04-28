// server/api/professors/[id].delete.ts
// DELETE /api/professors/:id — remove a professor by _id or covenantId.
// Role: Admin

import { defineEventHandler, getRouterParam, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Professor } from '../../models/index'
import { logAction } from '../../services/auditService'
import { getClientIp } from '../../utils/ip'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  const id = getRouterParam(event, 'id')
  if (!id || !id.trim()) {
    // Missing or empty id is a client error — return 400 instead of a 500.
    throw createError({
      statusCode: 400,
      statusMessage: 'Professor id is required',
    })
  }

  const clientIp = getClientIp(event)
  const professorId = id.trim().toLowerCase()

  // Find and delete the professor (by _id or covenantId)
  const deleted = await Professor.findOneAndDelete({
    $or: [{ _id: professorId }, { covenantId: professorId }],
  })
    .lean()
    .exec()

  if (!deleted) {
    // Return 404 when the requested professor doesn't exist.
    throw createError({
      statusCode: 404,
      statusMessage: `Professor not found: ${professorId}`,
    })
  }

  await logAction(
    auth,
    'PROFESSOR_DELETE',
    'professors',
    deleted._id,
    `Deleted professor ${deleted.displayName} (${deleted.covenantId})`,
    clientIp,
  )

  return { ok: true, deleted: deleted }
})
