// server/api/preferences/[term].patch.ts
// PATCH /api/preferences/:term — update preference submission for a term
// GET /api/preferences/:term/template for help with request formatting
// Role: Admin

import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import {
  Professor,
  type IPreferenceSubmission,
  type ICoursePreference,
} from '../../models/index'
import { logAction } from '../../services/auditService'

const VALID_STATUSES: IPreferenceSubmission['status'][] = [
  'empty',
  'draft',
  'submitted',
  'approved',
]
const VALID_DAYS: string[] = ['MWF', 'TR', 'MW', 'MTWF', 'MWRF', 'W', 'T', 'R']
const TIME_PATTERN = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/

type PreferencePatchPayload = {
  professorId?: string
  status?: IPreferenceSubmission['status']
  department?: string
  courses?: ICoursePreference[]
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function validateCoursePreference(
  course: unknown,
  index: number,
): string | null {
  if (typeof course !== 'object' || course === null) {
    return `Course ${index}: must be an object, got ${typeof course}`
  }
  const c = course as Record<string, unknown>

  if (!c.courseId || typeof c.courseId !== 'string') {
    return `Course ${index}: courseId is required and must be a string`
  }
  if (!c.title || typeof c.title !== 'string') {
    return `Course ${index}: title is required and must be a string`
  }
  if (
    c.expectedEnrollment === undefined ||
    typeof c.expectedEnrollment !== 'number'
  ) {
    return `Course ${index}: expectedEnrollment is required and must be a number`
  }
  if (c.expectedEnrollment < 0) {
    return `Course ${index}: expectedEnrollment must be >= 0`
  }
  if (
    typeof c.creditHours !== 'number' ||
    !Number.isFinite(c.creditHours)
  ) {
    return `Course ${index}: creditHours is required and must be a number`
  }
  if (c.creditHours < 0) {
    return `Course ${index}: creditHours must be >= 0`
  }

  // Validate preferredDays if provided
  if (c.preferredDays !== undefined) {
    if (!Array.isArray(c.preferredDays)) {
      return `Course ${index}: preferredDays must be an array`
    }
    for (let i = 0; i < c.preferredDays.length; i++) {
      const day = c.preferredDays[i]
      if (typeof day !== 'string' || !VALID_DAYS.includes(day)) {
        return `Course ${index}: preferredDays must contain only: ${VALID_DAYS.join(', ')}`
      }
    }
  }

  // Validate preferredTimes and avoidTimes if provided
  for (const timeField of ['preferredTimes', 'avoidTimes']) {
    const times = c[timeField]
    if (times !== undefined) {
      if (!Array.isArray(times)) {
        return `Course ${index}: ${timeField} must be an array`
      }
      for (let i = 0; i < times.length; i++) {
        const timeRange = times[i]
        if (typeof timeRange === 'string') {
          // Accept both "HH:MM-HH:MM" and just "HH:MM"
          const parts = timeRange.split('-')
          if (parts.length > 2 || !parts.every((p) => TIME_PATTERN.test(p))) {
            return `Course ${index}: ${timeField}[${i}] must be in HH:MM or HH:MM-HH:MM format`
          }
        }
      }
    }
  }

  // Validate optional maxCapacity
  if (c.maxCapacity !== undefined && c.maxCapacity !== null) {
    if (typeof c.maxCapacity !== 'number' || c.maxCapacity < 0) {
      return `Course ${index}: maxCapacity must be a non-negative number or null`
    }
  }

  // Validate optional requiredEquipment
  if (c.requiredEquipment !== undefined) {
    if (!Array.isArray(c.requiredEquipment)) {
      return `Course ${index}: requiredEquipment must be an array of strings`
    }
    for (let i = 0; i < c.requiredEquipment.length; i++) {
      if (typeof c.requiredEquipment[i] !== 'string') {
        return `Course ${index}: requiredEquipment[${i}] must be a string`
      }
    }
  }

  // Validate optional preferredBuilding
  if (c.preferredBuilding !== undefined && c.preferredBuilding !== null) {
    if (typeof c.preferredBuilding !== 'string') {
      return `Course ${index}: preferredBuilding must be a string or null`
    }
  }

  // Validate optional preferredRoomId
  if (c.preferredRoomId !== undefined && c.preferredRoomId !== null) {
    if (typeof c.preferredRoomId !== 'string') {
      return `Course ${index}: preferredRoomId must be a string or null`
    }
  }

  // Validate optional backToBackWith
  if (c.backToBackWith !== undefined && c.backToBackWith !== null) {
    if (typeof c.backToBackWith !== 'string') {
      return `Course ${index}: backToBackWith must be a string or null`
    }
  }

  // Validate optional coreqWith
  if (c.coreqWith !== undefined) {
    if (!Array.isArray(c.coreqWith)) {
      return `Course ${index}: coreqWith must be an array of strings`
    }
    for (let i = 0; i < c.coreqWith.length; i++) {
      if (typeof c.coreqWith[i] !== 'string') {
        return `Course ${index}: coreqWith[${i}] must be a string`
      }
    }
  }

  return null
}

function validateCourses(courses: unknown): string | null {
  if (!Array.isArray(courses)) {
    return 'courses must be an array'
  }
  for (let i = 0; i < courses.length; i++) {
    const error = validateCoursePreference(courses[i], i)
    if (error) {
      return error
    }
  }
  return null
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
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
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    throw createError({
      statusCode: 400,
      statusMessage: `status must be one of: ${VALID_STATUSES.join(', ')}. Got: ${body.status}`,
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

  // Find the professor to update
  let prof = await Professor.findOne({
    $or: [
      { _id: body.professorId },
      { covenantId: body.professorId?.toLowerCase() },
    ],
  }).exec()

  if (!prof) {
    throw createError({
      statusCode: 404,
      statusMessage: `Professor not found: ${body.professorId}`,
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
  let changes = 0

  if (hasOwn(body, 'status')) {
    submission.status = body.status ?? submission.status
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
