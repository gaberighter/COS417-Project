// server/api/schedule/index.get.ts
// GET /api/schedule — returns available schedules for selection.
// Role: Admin | Faculty — lists schedule summaries.

import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Schedule } from '../../models/index'
import { compareAcademicTermsDesc } from '../../../shared/academicTerms'

export default defineEventHandler(async (event) => {
  requireAuth(event, ['Admin', 'Faculty'])
  await connectDB()

  const schedules = await Schedule.find(
    {},
    {
      _id: 1,
      term: 1,
      runNumber: 1,
      status: 1,
      createdBy: 1,
      createdAt: 1,
      updatedAt: 1,
      approvedAt: 1,
      approvedBy: 1,
    },
  )
    .lean()
    .exec()

  return schedules.sort(
    (left, right) =>
      compareAcademicTermsDesc(left.term, right.term) ||
      right.runNumber - left.runNumber,
  )
})
