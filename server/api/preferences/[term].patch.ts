// server/api/preferences/[term].patch.ts
// PATCH /api/preferences/:term — update preference submission for a term
// Request payload formatting is validated by this endpoint.
// Role: Admin | Faculty

import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import {
  Professor,
  type IPreferenceSubmission,
  type ICoursePreference,
} from '../../models/index'
import { logAction } from '../../services/auditService'
import {
  VALID_PREFERENCE_STATUSES,
  hasOwn,
  normalizePreferenceSubmissionStatus,
  validateCourses,
} from '../../utils/preferenceValidation'

type PreferencePatchPayload = {
  professorId?: string
  status?: IPreferenceSubmission['status']
  department?: string
  courses?: ICoursePreference[]
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin', 'Faculty'])
  await connectDB()

  const term = getRouterParam(event, 'term')
  if (!term) {
    throw createError({ statusCode: 400, statusMessage: 'term is required' })
  }

  let body: PreferencePatchPayload
  try {
    body = (await readBody<PreferencePatchPayload>(event)) ?? {}
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Invalid JSON body. Try GET /api/preferences/:term/template for formatting help.',
    })
  }

  // Validate status if provided
  if (
    body.status !== undefined &&
    !VALID_PREFERENCE_STATUSES.includes(body.status)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: `status must be one of: ${VALID_PREFERENCE_STATUSES.join(', ')}. Got: ${body.status}`,
    })
  }

  // Validate courses if provided
  if (hasOwn(body, 'courses') && body.courses !== undefined) {
    const courseError = validateCourses(body.courses)
    if (courseError) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid courses: ${courseError}. Try GET /api/preferences/:term/template for examples.`,
      })
    }
  }

  const canEditOwnPreferences =
    auth.roles?.includes('Faculty') ?? auth.role === 'Faculty'
  const canTargetProfessor =
    auth.roles?.includes('Admin') ?? auth.role === 'Admin'

  let prof
  if (canEditOwnPreferences && !body.professorId) {
    prof = await Professor.findOne({
      $or: [
        { covenantId: auth.userId.toLowerCase() },
        { _id: auth.userId.toLowerCase() },
        { _id: auth.userId },
      ],
    }).exec()
  } else {
    if (
      typeof body.professorId !== 'string' ||
      body.professorId.trim() === ''
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: 'professorId is required and must be a non-empty string',
      })
    }

    if (!canTargetProfessor) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only admins may target another professor',
      })
    }

    const professorId = body.professorId.trim()

    prof = await Professor.findOne({
      $or: [{ _id: professorId }, { covenantId: professorId.toLowerCase() }],
    }).exec()
  }

  if (!prof) {
    throw createError({
      statusCode: 404,
      statusMessage:
        canEditOwnPreferences && !body.professorId
          ? 'Professor record not found'
          : `Professor not found: ${String(body.professorId ?? '').trim()}`,
    })
  }

  // Find the preference submission for this term
  const submissionIndex = prof.preferences.findIndex((p) => p.term === term)

  if (submissionIndex < 0) {
    throw createError({
      statusCode: 404,
      statusMessage: `No preferences found for term: ${term}`,
    })
  }

  const submission = prof.preferences[submissionIndex]!
  for (const existingSubmission of prof.preferences) {
    normalizePreferenceSubmissionStatus(existingSubmission)
  }
  let changes = 0

  if (hasOwn(body, 'status')) {
    submission.status = body.status ?? submission.status
    submission.submittedAt =
      submission.status === 'submitted' ? new Date() : null
    changes += 1
  }

  if (hasOwn(body, 'department')) {
    submission.department = body.department ?? submission.department
    changes += 1
  }

  if (hasOwn(body, 'courses')) {
    submission.courses = body.courses ?? []
    changes += 1
  }

  normalizePreferenceSubmissionStatus(submission)

  if (changes === 0) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'No mutable preference fields were provided. Try GET /api/preferences/:term/template to see available fields.',
    })
  }

  await prof.save()

  await logAction(
    auth,
    'PREFERENCE_UPDATE',
    'professors',
    prof._id,
    `Updated preferences for ${prof.covenantId} (${term})`,
  )

  return { ok: true, term, professorId: prof._id, status: submission.status }
})
