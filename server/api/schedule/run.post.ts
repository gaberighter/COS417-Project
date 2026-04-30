// server/api/schedule/run.post.ts
// POST /api/schedule/run — generate a schedule plan for a term without persisting it.
// Role: Admin
// Body: { term: string }

import { defineEventHandler, readBody, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { runSchedulingPlan } from '../../services/scheduling'
import { SchedulingInputError } from '../../services/scheduling/types'

const TERM_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

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

  const term = String(body.term ?? '').trim()
  if (!term) {
    throw createError({ statusCode: 400, statusMessage: 'term is required' })
  }
  if (!TERM_PATTERN.test(term)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid term format' })
  }

  const result = await (async () => {
    try {
      return await runSchedulingPlan(term)
    } catch (error) {
      if (error instanceof SchedulingInputError) {
        throw createError({
          statusCode: 400,
          statusMessage: error.reasons.join('; '),
        })
      }

      throw error
    }
  })()

  return {
    ok: true,
    persisted: false,
    term,
    recommendedStatus:
      result.conflicts.length > 0 || result.nearHardFlags.length > 0
        ? 'under_review'
        : 'approved',
    assignments: result.assignments,
    conflicts: result.conflicts,
    nearHardFlags: result.nearHardFlags,
    warnings: result.warnings,
    traces: result.traces,
  }
})
