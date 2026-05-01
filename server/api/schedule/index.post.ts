// server/api/schedule/index.post.ts
// POST /api/schedule — create or update schedule records.
// Role: Admin

import { createError, defineEventHandler, readBody } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { logAction } from '../../services/auditService'
import {
  type ScheduleInput,
  upsertScheduleInputs,
} from '../../services/scheduling/scheduleRecords'

interface Payload {
  schedules?: ScheduleInput[]
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  let body: Payload | ScheduleInput | ScheduleInput[]
  try {
    body =
      (await readBody<Payload | ScheduleInput | ScheduleInput[]>(event)) ?? {}
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing or invalid JSON body',
    })
  }

  const rawSchedules = Array.isArray(body)
    ? body
    : 'schedules' in body && Array.isArray(body.schedules)
      ? body.schedules
      : [body as ScheduleInput]

  if (rawSchedules.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'At least one schedule is required',
    })
  }

  const upserted = await upsertScheduleInputs(
    rawSchedules,
    auth.userId.toLowerCase(),
  )

  await logAction(
    auth,
    'SCHEDULE_UPSERT',
    'schedules',
    undefined,
    `Upserted ${upserted.length} schedule record(s)`,
  )

  return { ok: true, count: upserted.length, schedules: upserted }
})
