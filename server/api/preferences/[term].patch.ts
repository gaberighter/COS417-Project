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
  departmentCode?: string
  department?: string
  courses?: ICoursePreference[]
}

function normalizeDepartmentCode(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase()
}

function submissionDepartmentCode(submission: {
  departmentCode?: string | null
  department?: string | null
}): string {
  return normalizeDepartmentCode(
    submission.departmentCode || submission.department,
  )
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
  let requestedProfessorId = ''
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

    requestedProfessorId = body.professorId.trim()

    prof = await Professor.findOne({
      $or: [
        { _id: requestedProfessorId },
        { covenantId: requestedProfessorId.toLowerCase() },
      ],
    }).exec()
  }

  if (!prof) {
    throw createError({
      statusCode: 404,
      statusMessage:
        canEditOwnPreferences && !body.professorId
          ? 'Professor record not found'
          : `Professor not found: ${requestedProfessorId}`,
    })
  }

  const departmentCode = normalizeDepartmentCode(prof.departmentCode)
  const targetProf =
    (await Professor.findOne({
      active: true,
      'preferences.term': term,
      departmentCode,
    }).exec()) ?? prof

  // Find the department preference submission for this term.
  const submissionIndex = targetProf.preferences.findIndex(
    (p) =>
      p.term === term &&
      (submissionDepartmentCode(p) === departmentCode ||
        submissionDepartmentCode(p) === ''),
  )

  if (submissionIndex < 0) {
    throw createError({
      statusCode: 404,
      statusMessage: `No ${departmentCode} preferences found for term: ${term}`,
    })
  }

  const submission = targetProf.preferences[submissionIndex]!
  const updatedSubmission: IPreferenceSubmission = {
    term: submission.term,
    departmentCode,
    submittedBy: submission.submittedBy,
    submittedAt: submission.submittedAt ?? null,
    status: submission.status,
    courses: submission.courses,
  }
  for (const existingSubmission of targetProf.preferences) {
    normalizePreferenceSubmissionStatus(existingSubmission)
  }
  let changes = 0

  if (hasOwn(body, 'status')) {
    updatedSubmission.status = body.status ?? updatedSubmission.status
    updatedSubmission.submittedAt =
      updatedSubmission.status === 'submitted' ? new Date() : null
    changes += 1
  }

  if (hasOwn(body, 'departmentCode') || hasOwn(body, 'department')) {
    updatedSubmission.departmentCode = departmentCode
    changes += 1
  }

  if (hasOwn(body, 'courses')) {
    updatedSubmission.courses = body.courses ?? []
    changes += 1
  }

  normalizePreferenceSubmissionStatus(updatedSubmission)

  if (changes === 0) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'No mutable preference fields were provided. Try GET /api/preferences/:term/template to see available fields.',
    })
  }

  targetProf.preferences[submissionIndex] = updatedSubmission
  targetProf.markModified('preferences')

  await targetProf.save()

  await logAction(
    auth,
    'PREFERENCE_UPDATE',
    'professors',
    targetProf._id,
    `Updated ${departmentCode} preferences (${term})`,
  )

  return {
    ok: true,
    term,
    professorId: targetProf._id,
    departmentCode,
    status: updatedSubmission.status,
  }
})
