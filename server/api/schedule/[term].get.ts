// server/api/schedule/[term].get.ts
// GET /api/schedule/:term — §4.5.2
// Role: Admin — retrieve the latest schedule result for a term.

import { defineEventHandler, getRouterParam, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { db } from '../../models/index'

export default defineEventHandler(async (event) => {
  requireAuth(event, ['Admin'])
  await connectDB()

  const term = getRouterParam(event, 'term')
  if (!term) {
    throw createError({ statusCode: 400, statusMessage: 'term is required' })
  }

  const schedule = db.schedules
    .filter((candidate) => candidate.term === term)
    .sort((left, right) => right.runNumber - left.runNumber)[0]

  if (!schedule) {
    throw createError({
      statusCode: 404,
      statusMessage: `No schedule for term: ${term}`,
    })
  }

  return schedule
})
