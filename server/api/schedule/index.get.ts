// server/api/schedule/index.get.ts
// GET /api/schedule — returns available schedules for selection.
// Role: Admin — lists schedule summaries.

import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Schedule } from '../../models/index'

export default defineEventHandler(async (event) => {
  requireAuth(event, ['Admin'])
  await connectDB()

  return Schedule.find(
    {},
    {
      _id: 1,
      term: 1,
      runNumber: 1,
      status: 1,
      createdBy: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  )
    .sort({ term: -1, runNumber: -1 })
    .lean()
    .exec()
})
