// server/api/schedule/[term].delete.ts
// DELETE /api/schedule/:term — remove a schedule run by term (and optional runNumber query param).
// Role: Admin

import { defineEventHandler, getRouterParam, getQuery } from 'h3'
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
    throw new Error('Invalid term format')
  }

  const query = getQuery(event)
  const runNumber = query.runNumber ? Number(query.runNumber) : undefined

  const clientIp = getClientIp(event)

  // Build filter: if runNumber provided, delete specific run; otherwise delete latest
  const filter = runNumber
    ? { term, runNumber: Number(runNumber) }
    : { term }

  const deleted = await Schedule.findOneAndDelete(filter)
    .sort(runNumber ? undefined : { runNumber: -1 })
    .lean()
    .exec()

  if (!deleted) {
    const detail =
      runNumber !== undefined ? `${term} run ${runNumber}` : `latest schedule for ${term}`
    throw new Error(`Schedule not found: ${detail}`)
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
