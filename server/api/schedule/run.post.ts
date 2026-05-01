// server/api/schedule/run.post.ts
// POST /api/schedule/run — generate a schedule plan for a term without persisting it.
// Role: Admin
// Body: { term: string }

import { defineEventHandler, readBody, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { runSchedulingPlan } from '../../services/scheduling'
import { SchedulingInputError } from '../../services/scheduling/types'
import {
  beginScheduleRun,
  completeScheduleRun,
  failScheduleRun,
} from '../../services/scheduling/runState'
import { normalizeScheduleTerm } from '../../services/scheduling/scheduleRecords'

export default defineEventHandler(async (event) => {
  requireAuth(event, ['Admin'])
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

  const term = normalizeScheduleTerm(body.term)

  const currentState = beginScheduleRun(term)
  if (currentState) {
    throw createError({
      statusCode: 409,
      statusMessage: `A schedule run for ${currentState.activeRun?.term ?? 'another term'} is already in progress`,
      data: currentState,
    })
  }

  try {
    const result = await runSchedulingPlan(term)
    const recommendedStatus =
      result.conflicts.length > 0 || result.nearHardFlags.length > 0
        ? 'under_review'
        : 'approved'

    completeScheduleRun({
      term,
      recommendedStatus,
      assignmentCount: result.assignments.length,
      conflictCount: result.conflicts.length,
      warningCount: result.warnings.length,
      nearHardFlagCount: result.nearHardFlags.length,
    })

    return {
      ok: true,
      persisted: false,
      term,
      recommendedStatus,
      assignments: result.assignments,
      conflicts: result.conflicts,
      nearHardFlags: result.nearHardFlags,
      warnings: result.warnings,
      traces: result.traces,
    }
  } catch (error) {
    const message =
      error instanceof SchedulingInputError
        ? error.reasons.join('; ')
        : error instanceof Error
          ? error.message
          : 'Schedule run failed'

    failScheduleRun(term, message)

    if (error instanceof SchedulingInputError) {
      throw createError({
        statusCode: 400,
        statusMessage: message,
      })
    }

    throw error
  }
})
