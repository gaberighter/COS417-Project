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

const TERM_PATTERN = /^[A-Za-z0-9_-]{1,32}$/
const MAX_SCHEDULE_CREATE_RETRIES = 3

function isDuplicateKeyError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  return 'code' in error && (error as { code?: number }).code === 11000
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  let body: { term: string }
  try {
    body = (await readBody<{ term: string }>(event)) ?? { term: '' }
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing or invalid JSON body',
    })
  }

  const term = String(body.term ?? '').trim()
  if (!term) {
    throw createError({ statusCode: 400, statusMessage: 'term is required' })
  }
  if (!TERM_PATTERN.test(term)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid term format' })
  }

  const result = await runScheduler(term)

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

  const createdBy = adminProfessor?._id ?? auth.userId.toLowerCase()
  const status = result.conflicts.length > 0 ? 'under_review' : 'approved'

  const { schedule, runNumber } = await (async () => {
    for (let attempt = 0; attempt < MAX_SCHEDULE_CREATE_RETRIES; attempt += 1) {
      const latestRun = await Schedule.findOne({ term })
        .sort({ runNumber: -1 })
        .select({ runNumber: 1 })
        .lean()
        .exec()
      const nextRunNumber = (latestRun?.runNumber ?? 0) + 1

      try {
        const createdSchedule = await Schedule.create({
          term,
          runNumber: nextRunNumber,
          status,
          createdBy,
          assignments: result.assignments,
          conflicts: result.conflicts,
        })

        return { schedule: createdSchedule, runNumber: nextRunNumber }
      } catch (error: unknown) {
        if (!isDuplicateKeyError(error) || attempt === MAX_SCHEDULE_CREATE_RETRIES - 1) {
          throw error
        }
      }
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to persist schedule run',
    })
  })()

  await logAction(
    auth,
    'SCHEDULE_RUN',
    'schedules',
    schedule._id,
    `Executed scheduling run ${runNumber} for ${term}`,
  )
  return schedule.toObject()
})
