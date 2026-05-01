// server/api/schedule/[term]/all.get.ts
// GET /api/schedule/:term/all — retrieve all schedules (all runs) for a specific term
// Role: Admin | Faculty

import { defineEventHandler, getRouterParam, createError } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { connectDB } from '../../../utils/db'
import {
  findSchedulesByTerm,
  normalizeScheduleTerm,
} from '../../../services/scheduling/scheduleRecords'

export default defineEventHandler(async (event) => {
  requireAuth(event, ['Admin', 'Faculty'])
  await connectDB()

  const term = normalizeScheduleTerm(getRouterParam(event, 'term'))
  const schedules = await findSchedulesByTerm(term)

  if (schedules.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: `No schedules found for term: ${term}`,
    })
  }

  return {
    ok: true,
    term,
    count: schedules.length,
    schedules,
  }
})
