// server/api/preferences/index.post.ts
// POST /api/preferences — §4.3.1
// Role: Admin | Faculty — submit or update department preferences for a term.
//
// Body: { term: string; professorId?: string; department?: string; status?: PreferenceStatus; courses: ICoursePreference[] }

import { defineEventHandler, readBody, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import {
  Professor,
  type ICoursePreference,
  type IPreferenceSubmission,
} from '../../models/index'
import { logAction } from '../../services/auditService'
import {
  VALID_PREFERENCE_STATUSES,
  normalizePreferenceSubmissionStatus,
  normalizePreferenceStatus,
  validateCourses,
} from '../../utils/preferenceValidation'

interface PreferencePayload {
  term: string
  professorId?: string
  department?: string
  status?: IPreferenceSubmission['status']
  courses?: ICoursePreference[]
  preferences?: ICoursePreference[]
}

function normalizeDepartmentCode(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase()
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin', 'Faculty'])
  await connectDB()

  let body: PreferencePayload
  try {
    body =
      (await readBody<PreferencePayload>(event)) ?? ({} as PreferencePayload)
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing or invalid JSON body',
    })
  }
  const courses = body.courses ?? body.preferences

  if (!body.term || !Array.isArray(courses)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'term and courses[] are required',
    })
  }

  if (
    body.status !== undefined &&
    !VALID_PREFERENCE_STATUSES.includes(body.status)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: `status must be one of: ${VALID_PREFERENCE_STATUSES.join(', ')}`,
    })
  }

  const courseError = validateCourses(courses)
  if (courseError) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid courses: ${courseError}`,
    })
  }

  const canEditOwnPreferences =
    auth.roles?.includes('Faculty') ?? auth.role === 'Faculty'
  const canTargetProfessor =
    auth.roles?.includes('Admin') ?? auth.role === 'Admin'

  let prof
  if (body.professorId !== undefined) {
    if (!canTargetProfessor) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only admins may target another professor',
      })
    }

    const professorId = body.professorId.trim()
    if (!professorId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'professorId must be a non-empty string',
      })
    }

    prof = await Professor.findOne({
      $or: [{ _id: professorId }, { covenantId: professorId.toLowerCase() }],
    }).exec()
  } else if (canEditOwnPreferences) {
    prof = await Professor.findOne({
      $or: [
        { covenantId: auth.userId.toLowerCase() },
        { _id: auth.userId.toLowerCase() },
        { _id: auth.userId },
      ],
    }).exec()
  } else {
    throw createError({
      statusCode: 400,
      statusMessage: 'professorId is required for admin preference submissions',
    })
  }

  if (!prof) {
    throw createError({
      statusCode: 404,
      statusMessage: body.professorId
        ? `Professor not found: ${body.professorId.trim()}`
        : 'Professor record not found',
    })
  }

  const departmentCode = normalizeDepartmentCode(prof.departmentCode)
  const now = new Date()
  const submittedBy = prof._id
  const status =
    body.status === undefined
      ? 'submitted'
      : normalizePreferenceStatus(body.status)
  const submission: IPreferenceSubmission = {
    term: body.term,
    departmentCode,
    submittedBy,
    submittedAt: status === 'submitted' ? now : null,
    status,
    courses,
  }

  const targetProf =
    (await Professor.findOne({
      active: true,
      'preferences.term': body.term,
      departmentCode,
    }).exec()) ?? prof

  const existingIndex = targetProf.preferences.findIndex(
    (candidate) =>
      candidate.term === body.term &&
      (normalizeDepartmentCode(candidate.departmentCode) === departmentCode ||
        normalizeDepartmentCode(
          (candidate as IPreferenceSubmission & { department?: string })
            .department,
        ) === departmentCode ||
        normalizeDepartmentCode(candidate.departmentCode) === ''),
  )
  if (existingIndex >= 0) {
    targetProf.preferences[existingIndex] = submission
  } else {
    targetProf.preferences.push(submission)
  }

  for (const existingSubmission of targetProf.preferences) {
    normalizePreferenceSubmissionStatus(existingSubmission)
  }

  targetProf.markModified('preferences')
  await targetProf.save()

  await logAction(
    auth,
    'PREFERENCE_SUBMIT',
    'professors',
    targetProf._id,
    `Updated ${courses.length} preference record(s) for ${body.term}`,
  )
  return { ok: true, term: body.term, count: courses.length, status }
})
