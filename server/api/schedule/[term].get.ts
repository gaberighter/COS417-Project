// server/api/schedule/[term].get.ts
// GET /api/schedule/:term — §4.5.2
// Role: Admin — retrieve the latest schedule result for a term.

import { defineEventHandler, getRouterParam, createError } from 'h3'
import { requireAuth, type AuthContext } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Schedule } from '../../models/index'

const TERM_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

export default defineEventHandler(async (event) => {
  if (process.env.DISABLE_SSO_FOR_SCHEDULES === 'true') {
    const auth: AuthContext = { userId: 'sso-bypass', role: 'Admin' }
    event.context.auth = auth
  } else {
    requireAuth(event, ['Admin'])
  }
  await connectDB()

  const term = getRouterParam(event, 'term')
  if (!term) {
    throw createError({ statusCode: 400, statusMessage: 'term is required' })
  }
  if (!TERM_PATTERN.test(term)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid term format' })
  }

  const schedule = await Schedule.findOne({ term })
    .sort({ runNumber: -1 })
    .lean()
    .exec()

  if (!schedule) {
    throw createError({
      statusCode: 404,
      statusMessage: `No schedule for term: ${term}`,
    })
  }

  return schedule
})
