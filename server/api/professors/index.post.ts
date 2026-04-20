// server/api/professors/index.post.ts
// POST /api/professors — upsert one or more professor records.
// Role: Admin

import { createError, defineEventHandler, readBody } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import {
  Professor,
  professorCode,
  type IPreferenceSubmission,
  type IProfessor,
} from '../../models/index'
import { logAction } from '../../services/auditService'

type ProfessorInput = Partial<IProfessor>

interface Payload {
  professors?: ProfessorInput[]
}

type ProfessorKey = {
  _id: string
  covenantId: string
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function normalizeProfessorKeyField(
  value: unknown,
  fieldName: 'covenantId' | '_id',
): string | undefined {
  if (value == null) {
    return undefined
  }
  if (typeof value !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be a string`,
    })
  }

  return value.trim().toLowerCase()
}

function parseProfessorKey(input: ProfessorInput): ProfessorKey {
  const covenantId =
    normalizeProfessorKeyField(input.covenantId, 'covenantId') ??
    normalizeProfessorKeyField(input._id, '_id')

  if (!covenantId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'covenantId is required',
    })
  }

  return {
    _id: professorCode({ covenantId }),
    covenantId,
  }
}

function normalizePreferences(
  preferences: IPreferenceSubmission[] | undefined,
): IPreferenceSubmission[] {
  return (preferences ?? []).map((submission) => ({
    term: submission.term,
    department: submission.department,
    submittedBy: submission.submittedBy,
    submittedAt: submission.submittedAt ?? null,
    status: submission.status,
    courses: submission.courses ?? [],
  }))
}

function normalizeProfessor(input: ProfessorInput): IProfessor {
  const key = parseProfessorKey(input)

  return {
    _id: key._id,
    covenantId: key.covenantId,
    displayName: input.displayName?.trim() ?? key.covenantId,
    departmentCode: input.departmentCode?.trim().toUpperCase() ?? 'UNK',
    officeBuilding: input.officeBuilding ?? null,
    officeRoom: input.officeRoom ?? null,
    seniorityYear: input.seniorityYear ?? null,
    active: input.active ?? true,
    preferences: normalizePreferences(input.preferences),
  }
}

function mergeProfessor(
  input: ProfessorInput,
  existing: IProfessor | null,
): IProfessor {
  const base = normalizeProfessor(input)

  return {
    _id: base._id,
    covenantId: base.covenantId,
    displayName: hasOwn(input, 'displayName')
      ? base.displayName
      : (existing?.displayName ?? base.displayName),
    departmentCode: hasOwn(input, 'departmentCode')
      ? base.departmentCode
      : (existing?.departmentCode ?? base.departmentCode),
    officeBuilding: hasOwn(input, 'officeBuilding')
      ? (input.officeBuilding ?? null)
      : (existing?.officeBuilding ?? null),
    officeRoom: hasOwn(input, 'officeRoom')
      ? (input.officeRoom ?? null)
      : (existing?.officeRoom ?? null),
    seniorityYear: hasOwn(input, 'seniorityYear')
      ? (input.seniorityYear ?? null)
      : (existing?.seniorityYear ?? null),
    active: hasOwn(input, 'active')
      ? Boolean(input.active)
      : (existing?.active ?? true),
    preferences: hasOwn(input, 'preferences')
      ? normalizePreferences(input.preferences)
      : (existing?.preferences ?? []),
  }
}

function validateProfessorsOrThrow(professors: IProfessor[]): void {
  const issues: Array<{
    professorId: string
    field: string
    message: string
    kind: string
  }> = []

  for (const professor of professors) {
    const validationError = new Professor(professor).validateSync()
    if (!validationError) {
      continue
    }

    for (const error of Object.values(validationError.errors)) {
      issues.push({
        professorId: professor._id ?? 'unknown',
        field: 'path' in error ? String(error.path) : 'unknown',
        message: error.message,
        kind: 'kind' in error ? String(error.kind) : 'validation',
      })
    }
  }

  if (issues.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid professor data',
      data: {
        code: 'PROFESSOR_VALIDATION_FAILED',
        issues,
      },
    })
  }
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  let body: Payload | ProfessorInput | ProfessorInput[]
  try {
    body =
      (await readBody<Payload | ProfessorInput | ProfessorInput[]>(event)) ?? {}
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing or invalid JSON body',
    })
  }

  const rawProfessors = Array.isArray(body)
    ? body
    : 'professors' in body && Array.isArray(body.professors)
      ? body.professors
      : [body as ProfessorInput]

  if (rawProfessors.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'At least one professor is required',
    })
  }

  const keyed = rawProfessors.map((raw) => ({
    raw,
    key: parseProfessorKey(raw),
  }))
  const existing = await Professor.find({
    _id: { $in: keyed.map((entry) => entry.key._id) },
  })
    .lean()
    .exec()
  const existingById = new Map(
    existing.map((professor) => [professor._id ?? '', professor]),
  )

  const professors = keyed.map(({ raw, key }) =>
    mergeProfessor(raw, existingById.get(key._id) ?? null),
  )

  validateProfessorsOrThrow(professors)

  await Professor.bulkWrite(
    professors.map((professor) => ({
      updateOne: {
        filter: { _id: professor._id },
        update: {
          $set: {
            covenantId: professor.covenantId,
            displayName: professor.displayName,
            departmentCode: professor.departmentCode,
            officeBuilding: professor.officeBuilding,
            officeRoom: professor.officeRoom,
            seniorityYear: professor.seniorityYear,
            active: professor.active,
            preferences: professor.preferences,
          },
        },
        upsert: true,
        setDefaultsOnInsert: true,
      },
    })),
    { ordered: false },
  )

  await logAction(
    auth,
    'PROFESSOR_UPSERT',
    'professors',
    undefined,
    `Upserted ${professors.length} professor record(s)`,
  )

  return { ok: true, count: professors.length }
})
