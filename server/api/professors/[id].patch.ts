// server/api/professors/[id].patch.ts
// PATCH /api/professors/:id — update mutable fields of a professor record.
// Role: Admin

import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Professor } from '../../models/index'
import { logAction } from '../../services/auditService'

type ProfessorPatchPayload = {
  displayName?: string
  departmentCode?: string
  officeBuilding?: string | null
  officeRoom?: string | null
  seniorityYear?: number | null
  active?: boolean
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  const id = getRouterParam(event, 'id')
  if (!id?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Professor id is required' })
  }

  let body: ProfessorPatchPayload
  try {
    body = (await readBody<ProfessorPatchPayload>(event)) ?? {}
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Missing or invalid JSON body' })
  }

  const professorId = id.trim().toLowerCase()

  const existing = await Professor.findOne({
    $or: [{ _id: professorId }, { covenantId: professorId }],
  })
    .lean()
    .exec()

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: `Professor not found: ${professorId}` })
  }

  const patch: Record<string, unknown> = {}
  let changes = 0

  if (hasOwn(body, 'displayName')) {
    const v = body.displayName?.trim()
    if (!v) {
      throw createError({ statusCode: 400, statusMessage: 'displayName must not be empty' })
    }
    patch.displayName = v
    changes++
  }
  if (hasOwn(body, 'departmentCode')) {
    const v = body.departmentCode?.trim().toUpperCase()
    if (!v) {
      throw createError({ statusCode: 400, statusMessage: 'departmentCode must not be empty' })
    }
    patch.departmentCode = v
    changes++
  }
  if (hasOwn(body, 'officeBuilding')) {
    patch.officeBuilding = body.officeBuilding?.trim() || null
    changes++
  }
  if (hasOwn(body, 'officeRoom')) {
    patch.officeRoom = body.officeRoom?.trim() || null
    changes++
  }
  if (hasOwn(body, 'seniorityYear')) {
    patch.seniorityYear = body.seniorityYear ?? null
    changes++
  }
  if (hasOwn(body, 'active')) {
    patch.active = Boolean(body.active)
    changes++
  }

  if (changes === 0) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'No mutable fields provided. Mutable fields: displayName, departmentCode, officeBuilding, officeRoom, seniorityYear, active',
    })
  }

  const updated = await Professor.findOneAndUpdate(
    { $or: [{ _id: professorId }, { covenantId: professorId }] },
    { $set: patch },
    { new: true, runValidators: true },
  )
    .lean()
    .exec()

  await logAction(
    auth,
    'PROFESSOR_UPDATE',
    'professors',
    updated?._id,
    `Updated professor ${updated?.displayName ?? professorId}`,
  )

  return updated
})
