// server/api/schedule/[term]/assignment.patch.ts
// PATCH /api/schedule/:term/assignment — §4.5.2
// Role: Admin — manually override a single assignment.
// Body: Partial<IAssignment> with at minimum courseId to identify the target.

import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { connectDB } from '../../../utils/db'
import { Professor, Schedule, type IAssignment } from '../../../models/index'
import { logAction } from '../../../services/auditService'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  const term = getRouterParam(event, 'term')
  if (!term) {
    throw createError({ statusCode: 400, statusMessage: 'term is required' })
  }

  let body: Partial<IAssignment> & { courseId?: string }
  try {
    body =
      (await readBody<Partial<IAssignment> & { courseId?: string }>(event)) ??
      {}
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing or invalid JSON body',
    })
  }

  if (!body || typeof body !== 'object' || !body.courseId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'courseId is required to identify assignment',
    })
  }

  const schedule = await Schedule.findOne({ term })
    .sort({ runNumber: -1 })
    .exec()
  if (!schedule) {
    throw createError({
      statusCode: 404,
      statusMessage: `No schedule for term: ${term}`,
    })
  }

  const assignmentIndex = schedule.assignments.findIndex(
    (assignment) => assignment.courseId === body.courseId,
  )
  if (assignmentIndex < 0) {
    throw createError({
      statusCode: 404,
      statusMessage: `Assignment not found: ${body.courseId}`,
    })
  }

  const current = schedule.assignments[assignmentIndex]
  if (!current) {
    throw createError({
      statusCode: 404,
      statusMessage: `Assignment not found: ${body.courseId}`,
    })
  }

  const adminProfessor = await Professor.findOne({
    $or: [
      { covenantId: auth.userId.toLowerCase() },
      { _id: auth.userId.toLowerCase() },
      { _id: auth.userId },
    ],
  })
    .select({ _id: 1 })
    .lean()
    .exec()

  schedule.assignments[assignmentIndex] = {
    ...current,
    ...Object.fromEntries(
      Object.entries(body).filter(
        ([key, value]) => key !== 'courseId' && value !== undefined,
      ),
    ),
    overrideBy: adminProfessor?._id ?? auth.userId.toLowerCase(),
  }
  schedule.status = 'under_review'

  await schedule.save()

  await logAction(
    auth,
    'SCHEDULE_OVERRIDE',
    'schedules',
    schedule._id,
    `Manually overrode assignment for course ${body.courseId} in ${term}`,
  )

  return schedule.assignments[assignmentIndex]
})
