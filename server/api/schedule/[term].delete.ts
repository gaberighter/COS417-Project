// server/api/schedule/[term].delete.ts
// DELETE /api/schedule/:term — remove a schedule run by term (and optional runNumber query param).
// Role: Admin

import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Schedule } from '../../models/index'
import { logAction } from '../../services/auditService'
import { getClientIp } from '../../utils/ip'

const TERM_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  const term = getRouterParam(event, 'term')
  if (!term || !TERM_PATTERN.test(term)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid term format',
    })
  }

  const query = getQuery(event)

  // Treat "param present" separately from "valid number"
  let runNumber: number | undefined
  if (query.runNumber !== undefined) {
    const parsed = Number(query.runNumber)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'runNumber must be a positive integer',
      })
    }
    runNumber = parsed
  }

  const clientIp = getClientIp(event)

  // Build filter: if runNumber provided, delete specific run; otherwise delete latest
  const filter = runNumber !== undefined ? { term, runNumber } : { term }

  let deleteQuery = Schedule.findOneAndDelete(filter)
  if (runNumber === undefined) {
    deleteQuery = deleteQuery.sort({ runNumber: -1 })
  }
  const deleted = await deleteQuery.lean().exec()

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
