// server/api/schedule/[term].get.ts
// GET /api/schedule/:term — §4.5.2
// Role: Admin | Faculty — retrieve the latest schedule result for a term.

import { defineEventHandler, getRouterParam, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Schedule } from '../../models/index'

const TERM_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

export default defineEventHandler(async (event) => {
  requireAuth(event, ['Admin', 'Faculty'])
  await connectDB()

  const term = getRouterParam(event, 'term')
  if (!term) {
    throw createError({ statusCode: 400, statusMessage: 'term is required' })
  }
  if (!TERM_PATTERN.test(term)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid term format' })
  }
  const schedule = await Schedule.findOne({
    term,
    'assignments.0': { $exists: true },
  })
    .sort({ runNumber: -1 })
    .lean()
    .exec()

  const latestSchedule =
    schedule ??
    (await Schedule.findOne({ term }).sort({ runNumber: -1 }).lean().exec())

  if (!latestSchedule) {
    throw createError({
      statusCode: 404,
      statusMessage: `No schedule for term: ${term}`,
    })
  }

  return latestSchedule
})
