// server/api/preferences/[term].get.ts
// GET /api/preferences/:term — §4.3.2
// Role: Admin — retrieve all preference submissions for a term.
// Note: preferences are embedded in professor documents, so this queries
//       active professors and filters embedded submissions by term.

import { defineEventHandler, getRouterParam, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Professor } from '../../models/index'

export default defineEventHandler(async (event) => {
  requireAuth(event, ['Admin'])
  await connectDB()

  const term = getRouterParam(event, 'term')
  if (!term) {
    throw createError({ statusCode: 400, statusMessage: 'term is required' })
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
        ...submission,
      })),
  )

  return results
})
