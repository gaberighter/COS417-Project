// server/api/schedule/index.post.ts
// POST /api/schedule — create or update schedule records.
// Role: Admin

import { createError, defineEventHandler, readBody } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Schedule, scheduleCode, type ISchedule } from '../../models/index'
import { logAction } from '../../services/auditService'

type ScheduleInput = Partial<ISchedule>
const TERM_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

interface Payload {
  schedules?: ScheduleInput[]
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function normalizeTerm(term: unknown): string {
  const normalized = String(term ?? '').trim()
  if (!normalized) {
    throw createError({ statusCode: 400, statusMessage: 'term is required' })
  }
  if (!TERM_PATTERN.test(normalized)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid term format' })
  }

  return normalized
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  let body: Payload | ScheduleInput | ScheduleInput[]
  try {
    body =
      (await readBody<Payload | ScheduleInput | ScheduleInput[]>(event)) ?? {}
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing or invalid JSON body',
    })
  }

  const rawSchedules = Array.isArray(body)
    ? body
    : 'schedules' in body && Array.isArray(body.schedules)
      ? body.schedules
      : [body as ScheduleInput]

  if (rawSchedules.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'At least one schedule is required',
    })
  }

  const maxRunByTerm = new Map<string, number>()
  const termList = [
    ...new Set(rawSchedules.map((entry) => normalizeTerm(entry.term))),
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
    const term = normalizeTerm(raw.term)
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
        ? (raw.createdBy ?? auth.userId.toLowerCase())
        : (existing?.createdBy ?? auth.userId.toLowerCase()),
      assignments: hasOwn(raw, 'assignments')
        ? (raw.assignments ?? [])
        : (existing?.assignments ?? []),
      conflicts: hasOwn(raw, 'conflicts')
        ? (raw.conflicts ?? [])
        : (existing?.conflicts ?? []),
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

  await logAction(
    auth,
    'SCHEDULE_UPSERT',
    'schedules',
    undefined,
    `Upserted ${upserted.length} schedule record(s)`,
  )

  return { ok: true, count: upserted.length, schedules: upserted }
})
