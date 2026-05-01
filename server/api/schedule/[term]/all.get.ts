// server/api/schedule/[term]/all.get.ts
// GET /api/schedule/:term/all — retrieve all schedules (all runs) for a specific term
// Role: Admin | Faculty

import { defineEventHandler, getRouterParam, createError } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { connectDB } from '../../../utils/db'
import { Schedule } from '../../../models/index'

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
  const schedules = await Schedule.find({ term })
    .sort({ runNumber: -1 })
    .lean()
    .exec()

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
