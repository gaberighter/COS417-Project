// server/api/schedule/[term]/index.patch.ts
// PATCH /api/schedule/:term — update mutable schedule fields.
// GET /api/schedule/:term/template for help with request formatting
// Role: Admin

import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { connectDB } from '../../../utils/db'
import { Schedule, type ISchedule } from '../../../models/index'
import { logAction } from '../../../services/auditService'

const TERM_PATTERN = /^[A-Za-z0-9_-]{1,32}$/
const VALID_STATUSES: ISchedule['status'][] = [
  'draft',
  'under_review',
  'approved',
  'exported',
]
const VALID_DAYS: string[] = ['MWF', 'TR', 'MW', 'MTWF', 'MWRF', 'W', 'T', 'R']
const TIME_PATTERN = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/

type SchedulePatchPayload = {
  runNumber?: number
  status?: ISchedule['status']
  createdBy?: string
  assignments?: ISchedule['assignments']
  conflicts?: ISchedule['conflicts']
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function validateAssignments(assignments: unknown): string | null {
  if (!Array.isArray(assignments)) {
    return 'assignments must be an array'
  }
  for (let i = 0; i < assignments.length; i++) {
    const entry = assignments[i]
    if (typeof entry !== 'object' || entry === null) {
      return `Assignment ${i}: must be an object, got ${typeof entry}`
    }
    const a = entry as Record<string, unknown>
    if (!a.courseId || typeof a.courseId !== 'string') {
      return `Assignment ${i}: courseId is required and must be a string`
    }
    if (!a.professorId || typeof a.professorId !== 'string') {
      return `Assignment ${i}: professorId is required and must be a string`
    }
    if (!a.roomId || typeof a.roomId !== 'string') {
      return `Assignment ${i}: roomId is required and must be a string`
    }
    if (!a.days || typeof a.days !== 'string' || !VALID_DAYS.includes(a.days)) {
      return `Assignment ${i}: days must be one of: ${VALID_DAYS.join(', ')}`
    }
    if (
      !a.startTime ||
      typeof a.startTime !== 'string' ||
      !TIME_PATTERN.test(a.startTime)
    ) {
      return `Assignment ${i}: startTime must be in HH:MM format (24-hour)`
    }
    if (
      !a.endTime ||
      typeof a.endTime !== 'string' ||
      !TIME_PATTERN.test(a.endTime)
    ) {
      return `Assignment ${i}: endTime must be in HH:MM format (24-hour)`
    }
    // Validate optional overrideBy field
    if (a.overrideBy !== undefined && a.overrideBy !== null) {
      if (typeof a.overrideBy !== 'string') {
        return `Assignment ${i}: overrideBy must be a string or null`
      }
    }
  }
  return null
}

function validateConflicts(conflicts: unknown): string | null {
  if (!Array.isArray(conflicts)) {
    return 'conflicts must be an array'
  }
  for (let i = 0; i < conflicts.length; i++) {
    const entry = conflicts[i]
    if (typeof entry !== 'object' || entry === null) {
      return `Conflict ${i}: must be an object, got ${typeof entry}`
    }
    const c = entry as Record<string, unknown>
    if (!c.courseId || typeof c.courseId !== 'string') {
      return `Conflict ${i}: courseId is required and must be a string`
    }
    if (!c.reason || typeof c.reason !== 'string') {
      return `Conflict ${i}: reason is required and must be a string`
    }
    // Validate optional resolvedBy field
    if (c.resolvedBy !== undefined && c.resolvedBy !== null) {
      if (typeof c.resolvedBy !== 'string') {
        return `Conflict ${i}: resolvedBy must be a string or null`
      }
    }
    // Validate optional resolvedAt field
    if (c.resolvedAt !== undefined && c.resolvedAt !== null) {
      const dateStr = String(c.resolvedAt)
      if (isNaN(Date.parse(dateStr))) {
        return `Conflict ${i}: resolvedAt must be a valid ISO date string or null`
      }
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
  if (!TERM_PATTERN.test(term)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid term format' })
  }

  let body: SchedulePatchPayload
  try {
    body = (await readBody<SchedulePatchPayload>(event)) ?? {}
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Invalid JSON body. Try GET /api/schedule/:term/template for formatting help.',
    })
  }

  if (
    body.runNumber !== undefined &&
    (!Number.isInteger(body.runNumber) || body.runNumber < 1)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'runNumber must be an integer >= 1',
    })
  }

  // Validate status if provided
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    throw createError({
      statusCode: 400,
      statusMessage: `status must be one of: ${VALID_STATUSES.join(', ')}. Got: ${body.status}`,
    })
  }

  // Validate assignments if provided
  if (hasOwn(body, 'assignments') && body.assignments !== undefined) {
    const assignmentError = validateAssignments(body.assignments)
    if (assignmentError) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid assignments: ${assignmentError}. Try GET /api/schedule/:term/template for examples.`,
      })
    }
  }

  // Validate conflicts if provided
  if (hasOwn(body, 'conflicts') && body.conflicts !== undefined) {
    const conflictError = validateConflicts(body.conflicts)
    if (conflictError) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid conflicts: ${conflictError}. Try GET /api/schedule/:term/template for examples.`,
      })
    }
  }

  const filter = body.runNumber ? { term, runNumber: body.runNumber } : { term }

  const schedule = await Schedule.findOne(filter)
    .sort(body.runNumber ? undefined : { runNumber: -1 })
    .exec()

  if (!schedule) {
    throw createError({
      statusCode: 404,
      statusMessage: `No schedule for term: ${term}`,
    })
  }

  let changes = 0
  if (hasOwn(body, 'status')) {
    schedule.status = body.status ?? schedule.status
    changes += 1
  }
  if (hasOwn(body, 'createdBy')) {
    schedule.createdBy = body.createdBy ?? schedule.createdBy
    changes += 1
  }
  if (hasOwn(body, 'assignments')) {
    schedule.assignments = body.assignments ?? []
    changes += 1
  }
  if (hasOwn(body, 'conflicts')) {
    schedule.conflicts = body.conflicts ?? []
    changes += 1
  }

  if (changes === 0) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'No mutable schedule fields were provided. Try GET /api/schedule/:term/template to see available fields.',
    })
  }

  await schedule.save()

  await logAction(
    auth,
    'SCHEDULE_UPDATE',
    'schedules',
    schedule._id,
    `Updated schedule ${schedule._id}`,
  )

  return schedule.toObject()
})
