// server/api/preferences/[term].delete.ts
// DELETE /api/preferences/:term — remove all preferences for current user for a term.
// Role: Faculty — removes their own preferences only

import { defineEventHandler, getRouterParam, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Professor } from '../../models/index'
import { logAction } from '../../services/auditService'
import { getClientIp } from '../../utils/ip'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Faculty'])
  await connectDB()

  const term = getRouterParam(event, 'term')
  if (!term || !term.trim()) {
    // Missing or empty term is a client error — return 400 instead of a 500.
    throw createError({ statusCode: 400, statusMessage: 'Term is required' })
  }

  const clientIp = getClientIp(event)

  // Find the professor making the request
  const prof = await Professor.findOne({
    $or: [
      { covenantId: auth.userId.toLowerCase() },
      { _id: auth.userId.toLowerCase() },
      { _id: auth.userId },
    ],
  }).exec()

  if (!prof) {
    // The requesting professor must exist in the DB — return 404 when not found.
    throw createError({
      statusCode: 404,
      statusMessage: 'Professor record not found',
    })
  }

  // Find and remove the preference submission for this term
  const submissionIndex = prof.preferences.findIndex(
    (submission) => submission.term === term,
  )

  if (submissionIndex < 0) {
    // No preferences submitted for this term — return 404 to the client.
    throw createError({
      statusCode: 404,
      statusMessage: `No preferences found for term: ${term}`,
    })
  }

  const removed = prof.preferences[submissionIndex]
  if (!removed) {
    // Defensive: if slice index exists but item missing, treat as not found.
    throw createError({
      statusCode: 404,
      statusMessage: `No preferences found for term: ${term}`,
    })
  }

  prof.preferences.splice(submissionIndex, 1)

  await prof.save()

  await logAction(
    auth,
    'PREFERENCE_DELETE',
    'professors',
    prof._id,
    `Deleted ${removed.courses.length} preference(s) for ${term}`,
    clientIp,
  )

  return { ok: true, term: term, removed: removed }
})
