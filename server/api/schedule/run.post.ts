// server/api/schedule/run.post.ts
// POST /api/schedule/run — §4.1.2
// Role: Admin — execute the scheduling algorithm for a term.
// Body: { term: string }

import { defineEventHandler, readBody, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { db, type ISchedule } from '../../models/index'
import { logAction } from '../../services/auditService'
import { run as runScheduler } from '../../services/schedulingEngine'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  const body = await readBody<{ term: string }>(event)
  if (!body || !body.term) {
    throw createError({ statusCode: 400, statusMessage: 'term is required' })
  }

  const now = new Date()
  const result = await runScheduler(body.term)
  const priorRuns = db.schedules.filter(
    (schedule) => schedule.term === body.term,
  )
  const nextRunNumber =
    priorRuns.reduce(
      (maxRun, schedule) => Math.max(maxRun, schedule.runNumber),
      0,
    ) + 1
  const adminProfessor = db.professors.find(
    (candidate) =>
      candidate.covenantId === auth.userId || candidate._id === auth.userId,
  )
  const schedule: ISchedule = {
    _id: `${body.term}-${nextRunNumber}`,
    term: body.term,
    runNumber: nextRunNumber,
    status: result.conflicts.length > 0 ? 'under_review' : 'approved',
    createdBy: adminProfessor?._id ?? auth.userId,
    assignments: result.assignments.map((assignment) => ({
      ...assignment,
      createdAt: assignment.createdAt ?? now,
      updatedAt: now,
    })),
    conflicts: result.conflicts.map((conflict) => ({
      ...conflict,
      createdAt: conflict.createdAt ?? now,
      updatedAt: now,
    })),
    createdAt: now,
    updatedAt: now,
  }

  db.schedules.push(schedule)

  await logAction(
    auth,
    'SCHEDULE_RUN',
    'schedules',
    schedule._id,
    `Executed scheduling run ${nextRunNumber} for ${body.term}`,
  )
  return schedule
})
