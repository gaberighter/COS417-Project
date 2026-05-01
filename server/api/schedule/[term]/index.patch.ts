// server/api/schedule/[term]/index.patch.ts
// PATCH /api/schedule/:term — update mutable schedule fields.
// GET /api/schedule/:term/template for help with request formatting
// Role: Admin

import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { connectDB } from '../../../utils/db'
import { logAction } from '../../../services/auditService'
import {
  applySchedulePatch,
  findScheduleByTerm,
  normalizeScheduleTerm,
  type SchedulePatchPayload,
  validateSchedulePatchPayload,
} from '../../../services/scheduling/scheduleRecords'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  const term = normalizeScheduleTerm(getRouterParam(event, 'term'))

  let body: SchedulePatchPayload
  try {
    body = (await readBody<SchedulePatchPayload>(event)) ?? {}
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Invalid JSON body. Try GET /api/schedule/:term/template for formatting help.',
    })
  }

  validateSchedulePatchPayload(body)
  const schedule = await findScheduleByTerm(term, body.runNumber)

  if (!schedule) {
    throw createError({
      statusCode: 404,
      statusMessage: `No schedule for term: ${term}`,
    })
  }

  const { auditAction, auditDetail } = applySchedulePatch(
    schedule,
    body,
    auth.userId.toLowerCase(),
  )

  await schedule.save()

  await logAction(
    auth,
    auditAction,
    'schedules',
    schedule._id,
    auditDetail,
  )

  return schedule.toObject()
})
