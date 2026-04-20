// server/api/preferences/index.post.ts
// POST /api/preferences — §4.3.1
// Role: Faculty — submit or update department preferences for a term.
//
// Body: { term: string; department?: string; status?: PreferenceStatus; courses: ICoursePreference[] }

import { defineEventHandler, readBody, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import {
  Professor,
  type ICoursePreference,
  type IPreferenceSubmission,
} from '../../models/index'
import { logAction } from '../../services/auditService'

interface PreferencePayload {
  term: string
  department?: string
  status?: IPreferenceSubmission['status']
  courses?: ICoursePreference[]
  preferences?: ICoursePreference[]
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Faculty'])
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

  const prof = await Professor.findOne({
    $or: [
      { covenantId: auth.userId.toLowerCase() },
      { _id: auth.userId.toLowerCase() },
      { _id: auth.userId },
    ],
  }).exec()
  if (!prof) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Professor record not found',
    })
  }

  const now = new Date()
  const submittedBy = prof._id
  const status = body.status ?? 'submitted'
  const submission: IPreferenceSubmission = {
    term: body.term,
    department: body.department ?? prof.departmentCode,
    submittedBy,
    submittedAt: status === 'submitted' || status === 'approved' ? now : null,
    status,
    courses,
  }

  const existingIndex = prof.preferences.findIndex(
    (candidate) => candidate.term === body.term,
  )
  if (existingIndex >= 0) {
    prof.preferences[existingIndex] = submission
  } else {
    prof.preferences.push(submission)
  }

  await prof.save()

  await logAction(
    auth,
    'PREFERENCE_SUBMIT',
    'professors',
    submittedBy,
    `Updated ${courses.length} preference record(s) for ${body.term}`,
  )
  return { ok: true, term: body.term, count: courses.length, status }
})
