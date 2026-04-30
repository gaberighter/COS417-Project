// server/api/schedule/[term]/index.patch.ts
// PATCH /api/schedule/:term — update mutable schedule fields.
// Role: Admin

import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { requireAuth, type AuthContext } from '../../../utils/auth'
import { connectDB } from '../../../utils/db'
import { Schedule, type ISchedule } from '../../../models/index'
import { logAction } from '../../../services/auditService'

const TERM_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

type SchedulePatchPayload = {
  runNumber?: number
  status?: ISchedule['status']
  createdBy?: string
  assignments?: ISchedule['assignments']
  conflicts?: ISchedule['conflicts']
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  const term = getRouterParam(event, 'term')
  if (!term) {
    throw createError({ statusCode: 400, statusMessage: 'term is required' })
  }
  if (!TERM_PATTERN.test(term)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid term format' })
  }

  let body: SchedulePatchPayload
  try {
    body = (await readBody<SchedulePatchPayload>(event)) ?? {}
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing or invalid JSON body',
    })
  }

  if (
    body.runNumber !== undefined &&
    (!Number.isInteger(body.runNumber) || body.runNumber < 1)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'runNumber must be an integer >= 1',
    })
  }

  const filter = body.runNumber ? { term, runNumber: body.runNumber } : { term }

  const schedule = await Schedule.findOne(filter)
    .sort(body.runNumber ? undefined : { runNumber: -1 })
    .exec()

  if (!schedule) {
    throw createError({
      statusCode: 404,
      statusMessage: `No schedule for term: ${term}`,
    })
  }

  let changes = 0
  if (hasOwn(body, 'status')) {
    schedule.status = body.status ?? schedule.status
    changes += 1
  }
  if (hasOwn(body, 'createdBy')) {
    schedule.createdBy = body.createdBy ?? schedule.createdBy
    changes += 1
  }
  if (hasOwn(body, 'assignments')) {
    schedule.assignments = body.assignments ?? []
    changes += 1
  }
  if (hasOwn(body, 'conflicts')) {
    schedule.conflicts = body.conflicts ?? []
    changes += 1
  }

  if (changes === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No mutable schedule fields were provided',
    })
  }

  await schedule.save()

  await logAction(
    auth,
    'SCHEDULE_UPDATE',
    'schedules',
    schedule._id,
    `Updated schedule ${schedule._id}`,
  )

  return schedule.toObject()
})
