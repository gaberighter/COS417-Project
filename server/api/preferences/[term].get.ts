// server/api/preferences/[term].get.ts
// GET /api/preferences/:term — §4.3.2
// Role: Admin | Faculty
// Note: preferences are embedded in professor documents, so this queries
//       active professors and filters embedded submissions by term.

import { defineEventHandler, getRouterParam, createError, getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Professor } from '../../models/index'
import { normalizePreferenceStatus } from '../../utils/preferenceValidation'

function formatSubmissionStatus<
  T extends { status: unknown; submittedAt?: unknown },
>(submission: T) {
  const status = normalizePreferenceStatus(submission.status)
  return {
    ...submission,
    status,
    submittedAt:
      status === 'submitted' ? (submission.submittedAt ?? null) : null,
  }
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin', 'Faculty'])
  await connectDB()

  const term = getRouterParam(event, 'term')
  if (!term) {
    throw createError({ statusCode: 400, statusMessage: 'term is required' })
  }

  const roles = auth.roles ?? [auth.role]
  const canReadOwnSubmission = roles.includes('Faculty')
  const canReadAllSubmissions = roles.includes('Admin')
  const query = getQuery(event)
  const scope =
    typeof query.scope === 'string'
      ? query.scope
      : Array.isArray(query.scope)
        ? query.scope[0]
        : undefined
  const all =
    typeof query.all === 'string'
      ? query.all
      : Array.isArray(query.all)
        ? query.all[0]
        : undefined
  const adminScope = scope === 'all' || all === 'true'

  if (canReadOwnSubmission && (!canReadAllSubmissions || !adminScope)) {
    const professor = await Professor.findOne(
      {
        active: true,
        $or: [
          { covenantId: auth.userId.toLowerCase() },
          { _id: auth.userId.toLowerCase() },
          { _id: auth.userId },
        ],
      },
      {
        _id: 1,
        covenantId: 1,
        displayName: 1,
        departmentCode: 1,
        preferences: 1,
      },
    )
      .lean()
      .exec()

    if (!professor) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Professor record not found',
      })
    }

    const submission = (professor.preferences ?? []).find(
      (candidate) => candidate.term === term,
    )

    if (!submission) {
      return null
    }

    return {
      professorId: professor._id ?? professor.covenantId,
      covenantId: professor.covenantId,
      displayName: professor.displayName,
      departmentCode: professor.departmentCode,
      ...formatSubmissionStatus(submission),
    }
  }

  const professors = await Professor.find(
    { active: true, 'preferences.term': term },
    {
      _id: 1,
      covenantId: 1,
      displayName: 1,
      departmentCode: 1,
      preferences: 1,
    },
  )
    .lean()
    .exec()

  const results = professors.flatMap((professor) =>
    (professor.preferences ?? [])
      .filter((submission) => submission.term === term)
      .map((submission) => ({
        professorId: professor._id ?? professor.covenantId,
        covenantId: professor.covenantId,
        displayName: professor.displayName,
        departmentCode: professor.departmentCode,
        ...formatSubmissionStatus(submission),
      })),
  )

  return results
})
