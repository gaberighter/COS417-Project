// server/api/schedule/[term].delete.ts
// DELETE /api/schedule/:term — remove a schedule run by term (and optional runNumber query param).
// Role: Admin

import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { logAction } from '../../services/auditService'
import { getClientIp } from '../../utils/ip'
import {
  deleteScheduleByTerm,
  normalizeScheduleTerm,
  parseOptionalRunNumber,
} from '../../services/scheduling/scheduleRecords'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  const term = normalizeScheduleTerm(getRouterParam(event, 'term'))
  const query = getQuery(event)
  const runNumber = parseOptionalRunNumber(query.runNumber)
  const clientIp = getClientIp(event)
  const deleted = await deleteScheduleByTerm(term, runNumber)

  if (!deleted) {
    const detail =
      runNumber !== undefined
        ? `${term} run ${runNumber}`
        : `latest schedule for ${term}`
    throw createError({
      statusCode: 404,
      statusMessage: `Schedule not found: ${detail}`,
    })
  }

  await logAction(
    auth,
    'SCHEDULE_DELETE',
    'schedules',
    deleted._id,
    `Deleted schedule run ${deleted.runNumber} for ${term} (status: ${deleted.status})`,
    clientIp,
  )

  return { ok: true, deleted: deleted }
})
