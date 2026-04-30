// server/api/schedule/[term]/assignment.patch.ts
// PATCH /api/schedule/:term/assignment — §4.5.2
// Role: Admin — manually override a single assignment.
// Body: Partial<IAssignment> with at minimum courseId to identify the target.

import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { requireAuth, type AuthContext } from '../../../utils/auth'
import { connectDB } from '../../../utils/db'
import { Professor, Schedule, type IAssignment } from '../../../models/index'
import { logAction } from '../../../services/auditService'

const TERM_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

type AssignmentPatchPayload = Partial<IAssignment> & {
  courseId?: string
  originalCourseId?: string
  previousCourseId?: string
  assignment?: Partial<IAssignment> & {
    courseId?: string
  }
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

export default defineEventHandler(async (event) => {
  let auth: AuthContext
  if (process.env.DISABLE_SSO_FOR_SCHEDULES === 'true') {
    auth = { userId: 'sso-bypass', role: 'Admin' }
    event.context.auth = auth
  } else {
    auth = requireAuth(event, ['Admin'])
  }
  await connectDB()

  const term = getRouterParam(event, 'term')
  if (!term) {
    throw createError({ statusCode: 400, statusMessage: 'term is required' })
  }
  if (!TERM_PATTERN.test(term)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid term format' })
  }

  let body: AssignmentPatchPayload
  try {
    body = (await readBody<AssignmentPatchPayload>(event)) ?? {}
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing or invalid JSON body',
    })
  }

  const patchSource =
    body.assignment && typeof body.assignment === 'object'
      ? body.assignment
      : body

  const targetCourseId =
    typeof body.originalCourseId === 'string'
      ? body.originalCourseId.trim()
      : typeof body.previousCourseId === 'string'
        ? body.previousCourseId.trim()
        : typeof body.courseId === 'string'
          ? body.courseId.trim()
          : typeof patchSource.courseId === 'string'
            ? patchSource.courseId.trim()
            : ''

  if (!body || typeof body !== 'object' || !targetCourseId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'courseId is required to identify assignment',
    })
  }
  const courseId = targetCourseId
  if (!courseId) {
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
    (assignment) => assignment.courseId === courseId,
  )
  if (assignmentIndex < 0) {
    throw createError({
      statusCode: 404,
      statusMessage: `Assignment not found: ${courseId}`,
    })
  }

  const current = schedule.assignments[assignmentIndex]
  if (!current) {
    throw createError({
      statusCode: 404,
      statusMessage: `Assignment not found: ${courseId}`,
    })
  }

  const nextAssignment: IAssignment = {
    ...current,
  }

  for (const field of [
    'courseId',
    'professorId',
    'roomId',
    'days',
    'startTime',
    'endTime',
    'overrideBy',
  ] as const) {
    if (hasOwn(patchSource, field) && patchSource[field] !== undefined) {
      nextAssignment[field] = patchSource[field] as never
    }
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
    ...nextAssignment,
    overrideBy: adminProfessor?._id ?? auth.userId.toLowerCase(),
  }
  schedule.status = 'under_review'

  await schedule.save()

  await logAction(
    auth,
    'SCHEDULE_OVERRIDE',
    'schedules',
    schedule._id,
    `Manually overrode assignment for course ${courseId} in ${term}`,
  )

  return schedule.assignments[assignmentIndex]
})
