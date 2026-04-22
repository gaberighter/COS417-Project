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

  return Schedule.find({})
    .sort({ term: -1, runNumber: -1 })
    .lean()
    .exec()
})
