// server/api/schedule/[term].get.ts
// GET /api/schedule/:term — §4.5.2
// Role: Admin | Faculty — retrieve the latest schedule result for a term.

import { defineEventHandler, getRouterParam, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import {
  findScheduleByTerm,
  normalizeScheduleTerm,
} from '../../services/scheduling/scheduleRecords'

export default defineEventHandler(async (event) => {
  requireAuth(event, ['Admin', 'Faculty'])
  await connectDB()

  const term = normalizeScheduleTerm(getRouterParam(event, 'term'))
  const schedule = await findScheduleByTerm(term, undefined, { lean: true })

  if (!schedule) {
    throw createError({
      statusCode: 404,
      statusMessage: `No schedule for term: ${term}`,
    })
  }

  return schedule
})
