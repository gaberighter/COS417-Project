// server/api/preferences/[term].get.ts
// GET /api/preferences/:term — §4.3.2
// Role: Admin | Faculty
// Note: preferences are embedded in professor documents, so this queries
//       active professors and filters embedded submissions by term.

import { defineEventHandler, getRouterParam, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Professor } from '../../models/index'
import { normalizePreferenceStatus } from '../../utils/preferenceValidation'

function formatSubmissionStatus<
  T extends {
    status: unknown
    submittedAt?: unknown
    department?: unknown
  },
>(submission: T) {
  const { department, ...rest } = submission
  const status = normalizePreferenceStatus(submission.status)
  return {
    ...rest,
    status,
    submittedAt:
      status === 'submitted' ? (submission.submittedAt ?? null) : null,
  }
}

function normalizeDepartmentCode(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase()
}

function professorDepartmentCode(professor: {
  department?: string | null
  departmentCode?: string | null
}): string {
  return normalizeDepartmentCode(
    professor.departmentCode || professor.department,
  )
}

function submissionDepartmentCode(submission: {
  department?: string | null
  departmentCode?: string | null
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

  const canReadOwnPreferences =
    auth.roles?.includes('Faculty') ?? auth.role === 'Faculty'

  if (canReadOwnPreferences) {
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

    const departmentCode = professorDepartmentCode(professor)
    const departmentProfessors = await Professor.find(
      {
        active: true,
        'preferences.term': term,
        departmentCode,
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

    const owner =
      departmentProfessors.find((candidateProfessor) =>
        (candidateProfessor.preferences ?? []).some(
          (candidate) =>
            candidate.term === term &&
            submissionDepartmentCode(candidate) === departmentCode,
        ),
      ) ??
      departmentProfessors.find((candidateProfessor) =>
        (candidateProfessor.preferences ?? []).some(
          (candidate) => candidate.term === term,
        ),
      )

    if (!owner) {
      return null
    }

    const submission = (owner.preferences ?? []).find(
      (candidate) =>
        candidate.term === term &&
        (submissionDepartmentCode(candidate) === departmentCode ||
          submissionDepartmentCode(candidate) === ''),
    )

    if (!submission) {
      return null
    }

    return {
      professorId: owner._id ?? owner.covenantId,
      covenantId: owner.covenantId,
      displayName: owner.displayName,
      ...formatSubmissionStatus(submission),
      departmentCode: owner?.departmentCode ?? departmentCode,
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
        ...formatSubmissionStatus(submission),
        departmentCode: professor.departmentCode,
      })),
  )

  return results
})
