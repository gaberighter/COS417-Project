// server/api/schedule/run.post.ts
// POST /api/schedule/run — §4.1.2
// Role: Admin — execute the scheduling algorithm for a term.
// Body: { term: string }

import { defineEventHandler, readBody, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Professor, Schedule } from '../../models/index'
import { logAction } from '../../services/auditService'
import { run as runScheduler } from '../../services/schedulingEngine'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  const body = await readBody<{ term: string }>(event)
  if (!body || !body.term) {
    throw createError({ statusCode: 400, statusMessage: 'term is required' })
  }

  const result = await runScheduler(body.term)
  const latestRun = await Schedule.findOne({ term: body.term })
    .sort({ runNumber: -1 })
    .select({ runNumber: 1 })
    .lean()
    .exec()
  const nextRunNumber = (latestRun?.runNumber ?? 0) + 1

  const adminProfessor = await Professor.findOne({
    $or: [
      { covenantId: auth.userId.toLowerCase() },
      { _id: auth.userId.toLowerCase() },
      { _id: auth.userId },
    ],
  })
    .select({ _id: 1 })
    .lean()
    .exec()

  const schedule = await Schedule.create({
    term: body.term,
    runNumber: nextRunNumber,
    status: result.conflicts.length > 0 ? 'under_review' : 'approved',
    createdBy: adminProfessor?._id ?? auth.userId.toLowerCase(),
    assignments: result.assignments,
    conflicts: result.conflicts,
  })

  await logAction(
    auth,
    'SCHEDULE_RUN',
    'schedules',
    schedule._id,
    `Executed scheduling run ${nextRunNumber} for ${body.term}`,
  )
  return schedule.toObject()
})
