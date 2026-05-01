import { createError } from 'h3'
import type { HydratedDocument } from 'mongoose'
import { Schedule, scheduleCode, type ISchedule } from '../../models/index'

export type ScheduleInput = Partial<ISchedule>

export type SchedulePatchPayload = {
  runNumber?: number
  status?: ISchedule['status']
  createdBy?: string
  assignments?: ISchedule['assignments']
  conflicts?: ISchedule['conflicts']
  warnings?: ISchedule['warnings']
  nearHardFlags?: ISchedule['nearHardFlags']
  traces?: ISchedule['traces']
  approvedAt?: string | Date | null
  approvedBy?: string | null
}

const VALID_STATUSES: ISchedule['status'][] = [
  'draft',
  'under_review',
  'approved',
  'exported',
]
const VALID_DAYS: string[] = ['MWF', 'TR', 'MW', 'MTWF', 'MWRF', 'M', 'W', 'T', 'R']
const TIME_PATTERN = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/

export const SCHEDULE_TERM_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

export const scheduleSummaryProjection = {
  _id: 1,
  term: 1,
  runNumber: 1,
  status: 1,
  createdBy: 1,
  createdAt: 1,
  updatedAt: 1,
  approvedAt: 1,
  approvedBy: 1,
} as const

export function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

export function normalizeScheduleTerm(term: unknown): string {
  const normalized = String(term ?? '').trim()
  if (!normalized) {
    throw createError({ statusCode: 400, statusMessage: 'term is required' })
  }
  if (!SCHEDULE_TERM_PATTERN.test(normalized)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid term format' })
  }

  return normalized
}

export function parseOptionalRunNumber(
  value: unknown,
  fieldName = 'runNumber',
): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be a positive integer`,
    })
  }

  return parsed
}

export function isLockedScheduleStatus(status: ISchedule['status']): boolean {
  return status === 'approved' || status === 'exported'
}

export async function listScheduleSummaries() {
  return Schedule.find({}, scheduleSummaryProjection)
    .sort({ term: -1, runNumber: -1 })
    .lean()
    .exec()
}

export async function findScheduleByTerm(
  term: string,
  runNumber?: number,
  options: { lean?: boolean } = {},
) {
  const filter = runNumber !== undefined ? { term, runNumber } : { term }
  const query = Schedule.findOne(filter)
  if (runNumber === undefined) {
    query.sort({ runNumber: -1 })
  }
  if (options.lean) {
    query.lean()
  }

  return query.exec()
}

export async function findSchedulesByTerm(term: string) {
  return Schedule.find({ term })
    .sort({ runNumber: -1 })
    .lean()
    .exec()
}

export async function deleteScheduleByTerm(term: string, runNumber?: number) {
  const filter = runNumber !== undefined ? { term, runNumber } : { term }
  let query = Schedule.findOneAndDelete(filter)
  if (runNumber === undefined) {
    query = query.sort({ runNumber: -1 })
  }

  return query.lean().exec()
}

export async function upsertScheduleInputs(
  rawSchedules: ScheduleInput[],
  createdByUserId: string,
): Promise<ISchedule[]> {
  const maxRunByTerm = new Map<string, number>()
  const termList = [
    ...new Set(rawSchedules.map((entry) => normalizeScheduleTerm(entry.term))),
  ]
  const latestSchedules = await Schedule.find({ term: { $in: termList } })
    .sort({ runNumber: -1 })
    .lean()
    .exec()

  for (const latest of latestSchedules) {
    const currentMax = maxRunByTerm.get(latest.term) ?? 0
    if (latest.runNumber > currentMax) {
      maxRunByTerm.set(latest.term, latest.runNumber)
    }
  }

  const preparedSchedules = rawSchedules.map((raw) => {
    const term = normalizeScheduleTerm(raw.term)
    const runNumber =
      raw.runNumber && Number.isInteger(raw.runNumber) && raw.runNumber > 0
        ? raw.runNumber
        : (maxRunByTerm.get(term) ?? 0) + 1

    maxRunByTerm.set(term, Math.max(maxRunByTerm.get(term) ?? 0, runNumber))

    const _id = scheduleCode(term, runNumber)
    return { raw, term, runNumber, _id }
  })

  const scheduleIds = [...new Set(preparedSchedules.map((entry) => entry._id))]
  const existingSchedules = await Schedule.find({ _id: { $in: scheduleIds } })
    .lean()
    .exec()
  const existingById = new Map(
    existingSchedules.map((schedule) => [schedule._id, schedule]),
  )

  const upserted: ISchedule[] = []
  for (const { raw, term, runNumber, _id } of preparedSchedules) {
    const existing = existingById.get(_id)
    const merged: Partial<ISchedule> = {
      _id,
      term,
      runNumber,
      status: hasOwn(raw, 'status')
        ? (raw.status ?? 'draft')
        : (existing?.status ?? 'draft'),
      createdBy: hasOwn(raw, 'createdBy')
        ? (raw.createdBy ?? createdByUserId)
        : (existing?.createdBy ?? createdByUserId),
      assignments: hasOwn(raw, 'assignments')
        ? (raw.assignments ?? [])
        : (existing?.assignments ?? []),
      conflicts: hasOwn(raw, 'conflicts')
        ? (raw.conflicts ?? [])
        : (existing?.conflicts ?? []),
      warnings: hasOwn(raw, 'warnings')
        ? (raw.warnings ?? [])
        : (existing?.warnings ?? []),
      nearHardFlags: hasOwn(raw, 'nearHardFlags')
        ? (raw.nearHardFlags ?? [])
        : (existing?.nearHardFlags ?? []),
      traces: hasOwn(raw, 'traces')
        ? (raw.traces ?? [])
        : (existing?.traces ?? []),
      approvedAt: hasOwn(raw, 'approvedAt')
        ? (raw.approvedAt ?? null)
        : (existing?.approvedAt ?? null),
      approvedBy: hasOwn(raw, 'approvedBy')
        ? (raw.approvedBy ?? null)
        : (existing?.approvedBy ?? null),
    }

    const saved = await Schedule.findOneAndUpdate({ _id }, merged, {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    })
      .lean()
      .exec()

    if (saved) {
      upserted.push(saved)
      existingById.set(saved._id, saved)
    }
  }

  return upserted
}

function validateAssignments(assignments: unknown): string | null {
  if (!Array.isArray(assignments)) {
    return 'assignments must be an array'
  }
  for (let i = 0; i < assignments.length; i += 1) {
    const entry = assignments[i]
    if (typeof entry !== 'object' || entry === null) {
      return `Assignment ${i}: must be an object, got ${typeof entry}`
    }
    const assignment = entry as Record<string, unknown>
    if (!assignment.courseId || typeof assignment.courseId !== 'string') {
      return `Assignment ${i}: courseId is required and must be a string`
    }
    if (!assignment.professorId || typeof assignment.professorId !== 'string') {
      return `Assignment ${i}: professorId is required and must be a string`
    }
    if (!assignment.roomId || typeof assignment.roomId !== 'string') {
      return `Assignment ${i}: roomId is required and must be a string`
    }
    if (
      !assignment.days ||
      typeof assignment.days !== 'string' ||
      !VALID_DAYS.includes(assignment.days)
    ) {
      return `Assignment ${i}: days must be one of: ${VALID_DAYS.join(', ')}`
    }
    if (
      !assignment.startTime ||
      typeof assignment.startTime !== 'string' ||
      !TIME_PATTERN.test(assignment.startTime)
    ) {
      return `Assignment ${i}: startTime must be in HH:MM format (24-hour)`
    }
    if (
      !assignment.endTime ||
      typeof assignment.endTime !== 'string' ||
      !TIME_PATTERN.test(assignment.endTime)
    ) {
      return `Assignment ${i}: endTime must be in HH:MM format (24-hour)`
    }
    if (
      assignment.overrideBy !== undefined &&
      assignment.overrideBy !== null &&
      typeof assignment.overrideBy !== 'string'
    ) {
      return `Assignment ${i}: overrideBy must be a string or null`
    }
  }

  return null
}

function validateConflicts(conflicts: unknown): string | null {
  if (!Array.isArray(conflicts)) {
    return 'conflicts must be an array'
  }
  for (let i = 0; i < conflicts.length; i += 1) {
    const entry = conflicts[i]
    if (typeof entry !== 'object' || entry === null) {
      return `Conflict ${i}: must be an object, got ${typeof entry}`
    }
    const conflict = entry as Record<string, unknown>
    if (!conflict.courseId || typeof conflict.courseId !== 'string') {
      return `Conflict ${i}: courseId is required and must be a string`
    }
    if (!conflict.reason || typeof conflict.reason !== 'string') {
      return `Conflict ${i}: reason is required and must be a string`
    }
    if (
      conflict.resolvedBy !== undefined &&
      conflict.resolvedBy !== null &&
      typeof conflict.resolvedBy !== 'string'
    ) {
      return `Conflict ${i}: resolvedBy must be a string or null`
    }
    if (conflict.resolvedAt !== undefined && conflict.resolvedAt !== null) {
      const dateStr = String(conflict.resolvedAt)
      if (Number.isNaN(Date.parse(dateStr))) {
        return `Conflict ${i}: resolvedAt must be a valid ISO date string or null`
      }
    }
  }

  return null
}

function validateWarnings(warnings: unknown): string | null {
  if (!Array.isArray(warnings)) {
    return 'warnings must be an array'
  }

  for (let i = 0; i < warnings.length; i += 1) {
    if (typeof warnings[i] !== 'string') {
      return `Warning ${i}: must be a string`
    }
  }

  return null
}

function validateTraces(traces: unknown): string | null {
  if (!Array.isArray(traces)) {
    return 'traces must be an array'
  }

  return null
}

export function validateSchedulePatchPayload(body: SchedulePatchPayload) {
  const runNumber = parseOptionalRunNumber(body.runNumber, 'runNumber')
  if (runNumber !== undefined) {
    body.runNumber = runNumber
  }

  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    throw createError({
      statusCode: 400,
      statusMessage: `status must be one of: ${VALID_STATUSES.join(', ')}. Got: ${body.status}`,
    })
  }

  if (hasOwn(body, 'assignments') && body.assignments !== undefined) {
    const assignmentError = validateAssignments(body.assignments)
    if (assignmentError) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid assignments: ${assignmentError}. Try GET /api/schedule/:term/template for examples.`,
      })
    }
  }

  if (hasOwn(body, 'conflicts') && body.conflicts !== undefined) {
    const conflictError = validateConflicts(body.conflicts)
    if (conflictError) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid conflicts: ${conflictError}. Try GET /api/schedule/:term/template for examples.`,
      })
    }
  }

  if (hasOwn(body, 'warnings') && body.warnings !== undefined) {
    const warningError = validateWarnings(body.warnings)
    if (warningError) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid warnings: ${warningError}.`,
      })
    }
  }

  if (hasOwn(body, 'nearHardFlags') && body.nearHardFlags !== undefined) {
    const nearHardFlagError = validateConflicts(body.nearHardFlags)
    if (nearHardFlagError) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid nearHardFlags: ${nearHardFlagError}.`,
      })
    }
  }

  if (hasOwn(body, 'traces') && body.traces !== undefined) {
    const traceError = validateTraces(body.traces)
    if (traceError) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid traces: ${traceError}.`,
      })
    }
  }
}

export function applySchedulePatch(
  schedule: HydratedDocument<ISchedule>,
  body: SchedulePatchPayload,
  approvedByUserId: string,
) {
  const previousStatus = schedule.status
  const nextStatus = hasOwn(body, 'status')
    ? (body.status ?? schedule.status)
    : schedule.status
  const attemptsContentMutation =
    hasOwn(body, 'createdBy') ||
    hasOwn(body, 'assignments') ||
    hasOwn(body, 'conflicts') ||
    hasOwn(body, 'warnings') ||
    hasOwn(body, 'nearHardFlags') ||
    hasOwn(body, 'traces')
  const isReopenRequest =
    hasOwn(body, 'status') &&
    nextStatus === 'under_review' &&
    !attemptsContentMutation &&
    !hasOwn(body, 'approvedAt') &&
    !hasOwn(body, 'approvedBy')

  if (
    isLockedScheduleStatus(previousStatus) &&
    (attemptsContentMutation || (!isReopenRequest && nextStatus !== previousStatus))
  ) {
    throw createError({
      statusCode: 409,
      statusMessage:
        'Approved or exported schedules must be reopened before they can be changed.',
    })
  }

  let changes = 0
  if (hasOwn(body, 'status')) {
    schedule.status = body.status ?? schedule.status
    if (schedule.status === 'approved') {
      schedule.approvedAt = new Date()
      schedule.approvedBy = approvedByUserId
    } else if (isReopenRequest) {
      schedule.approvedAt = null
      schedule.approvedBy = null
    }
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
  if (hasOwn(body, 'warnings')) {
    schedule.warnings = body.warnings ?? []
    changes += 1
  }
  if (hasOwn(body, 'nearHardFlags')) {
    schedule.nearHardFlags = body.nearHardFlags ?? []
    changes += 1
  }
  if (hasOwn(body, 'traces')) {
    schedule.traces = body.traces ?? []
    changes += 1
  }
  if (hasOwn(body, 'approvedAt')) {
    schedule.approvedAt = body.approvedAt ? new Date(body.approvedAt) : null
    changes += 1
  }
  if (hasOwn(body, 'approvedBy')) {
    schedule.approvedBy = body.approvedBy ?? null
    changes += 1
  }

  if (changes === 0) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'No mutable schedule fields were provided. Try GET /api/schedule/:term/template to see available fields.',
    })
  }

  const statusChanged = previousStatus !== schedule.status
  const auditAction =
    statusChanged && schedule.status === 'approved'
      ? 'SCHEDULE_APPROVE'
      : statusChanged &&
          previousStatus !== 'under_review' &&
          schedule.status === 'under_review'
        ? 'SCHEDULE_REOPEN'
        : 'SCHEDULE_UPDATE'
  const auditDetail =
    auditAction === 'SCHEDULE_APPROVE'
      ? `Approved schedule ${schedule._id}`
      : auditAction === 'SCHEDULE_REOPEN'
        ? `Reopened schedule ${schedule._id} for review`
        : `Updated schedule ${schedule._id}`

  return {
    auditAction,
    auditDetail,
  }
}
