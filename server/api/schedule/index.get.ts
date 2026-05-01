// server/api/schedule/index.get.ts
// GET /api/schedule — returns available schedules for selection.
// Role: Admin | Faculty — lists schedule summaries.

import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { listScheduleSummaries } from '../../services/scheduling/scheduleRecords'

export default defineEventHandler(async (event) => {
  requireAuth(event, ['Admin', 'Faculty'])
  await connectDB()

  return listScheduleSummaries()
})
