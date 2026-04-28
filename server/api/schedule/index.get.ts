// server/api/schedule/index.get.ts
// GET /api/schedule — retrieve all distinct terms that have schedules
// Role: Admin

import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Schedule } from '../../models/index'

export default defineEventHandler(async (event) => {
  requireAuth(event, ['Admin'])
  await connectDB()

  // Get all distinct terms from schedules collection
  const terms = await Schedule.distinct('term').lean().exec()

  // Sort terms for consistent ordering
  const sortedTerms = terms.sort()

  return {
    ok: true,
    count: sortedTerms.length,
    terms: sortedTerms,
  }
})
