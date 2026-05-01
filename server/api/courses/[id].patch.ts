// server/api/courses/[id].patch.ts
// PATCH /api/courses/:id — update mutable fields of a course catalog record.
// Role: Admin

import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import mongoose from 'mongoose'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { CourseCatalog } from '../../models/index'
import { logAction } from '../../services/auditService'

const IS_OBJECT_ID = /^[0-9a-f]{24}$/i

async function findCourseByAnyId(courseId: string) {
  const byString = await CourseCatalog.findById(courseId).lean().exec()
  if (byString) return byString
  if (IS_OBJECT_ID.test(courseId)) {
    const raw = await CourseCatalog.collection.findOne({
      _id: new mongoose.Types.ObjectId(courseId),
    })
    return raw as typeof byString | null
  }
  return null
}

type DayPattern = 'MWF' | 'TR' | 'MW' | 'MTWF' | 'MWRF' | 'M' | 'W' | 'T' | 'R'

const VALID_DAY_PATTERNS: DayPattern[] = [
  'MWF',
  'TR',
  'MW',
  'MTWF',
  'MWRF',
  'M',
  'W',
  'T',
  'R',
]

type CoursePatchPayload = {
  title?: string
  creditHours?: number
  typicalEnrollment?: number | null
  requiredEquipment?: string[]
  labComponent?: boolean
  active?: boolean
  typicalProfessor?: string | null
  typicalDays?: DayPattern | null
  typicalTime?: string | null
  prerequisites?: string[]
  corequisites?: string[]
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  const id = getRouterParam(event, 'id', { decode: true })
  if (!id?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Course id is required',
    })
  }

  let body: CoursePatchPayload
  try {
    body = (await readBody<CoursePatchPayload>(event)) ?? {}
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing or invalid JSON body',
    })
  }

  const courseId = id.trim()

  const existing = await findCourseByAnyId(courseId)
  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: `Course not found: ${courseId}`,
    })
  }

  const patch: Record<string, unknown> = {}
  let changes = 0

  if (hasOwn(body, 'title')) {
    const v = body.title?.trim()
    if (!v) {
      throw createError({
        statusCode: 400,
        statusMessage: 'title must not be empty',
      })
    }
    patch.title = v
    changes++
  }
  if (hasOwn(body, 'creditHours')) {
    const v = body.creditHours
    if (v === undefined || v === null || !Number.isFinite(v) || v < 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'creditHours must be a non-negative number',
      })
    }
    patch.creditHours = v
    changes++
  }
  if (hasOwn(body, 'typicalEnrollment')) {
    const v = body.typicalEnrollment
    if (v !== null && v !== undefined && (!Number.isInteger(v) || v < 0)) {
      throw createError({
        statusCode: 400,
        statusMessage:
          'typicalEnrollment must be a non-negative integer or null',
      })
    }
    patch.typicalEnrollment = v ?? null
    changes++
  }
  if (hasOwn(body, 'requiredEquipment')) {
    if (!Array.isArray(body.requiredEquipment)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'requiredEquipment must be an array of strings',
      })
    }
    patch.requiredEquipment = body.requiredEquipment
    changes++
  }
  if (hasOwn(body, 'labComponent')) {
    patch.labComponent = Boolean(body.labComponent)
    changes++
  }
  if (hasOwn(body, 'active')) {
    patch.active = Boolean(body.active)
    changes++
  }
  if (hasOwn(body, 'typicalProfessor')) {
    patch.typicalProfessor = body.typicalProfessor?.trim() || null
    changes++
  }
  if (hasOwn(body, 'typicalDays')) {
    if (
      body.typicalDays !== null &&
      body.typicalDays !== undefined &&
      !VALID_DAY_PATTERNS.includes(body.typicalDays)
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: `typicalDays must be one of: ${VALID_DAY_PATTERNS.join(', ')} or null`,
      })
    }
    patch.typicalDays = body.typicalDays ?? null
    changes++
  }
  if (hasOwn(body, 'typicalTime')) {
    patch.typicalTime = body.typicalTime?.trim() || null
    changes++
  }
  if (hasOwn(body, 'prerequisites')) {
    if (!Array.isArray(body.prerequisites)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'prerequisites must be an array of strings',
      })
    }
    patch.prerequisites = body.prerequisites
    changes++
  }
  if (hasOwn(body, 'corequisites')) {
    if (!Array.isArray(body.corequisites)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'corequisites must be an array of strings',
      })
    }
    patch.corequisites = body.corequisites
    changes++
  }

  if (changes === 0) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'No mutable fields provided. Mutable fields: title, creditHours, typicalEnrollment, requiredEquipment, labComponent, active, typicalProfessor, typicalDays, typicalTime, prerequisites, corequisites',
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await CourseCatalog.collection.findOneAndUpdate(
    { _id: existing._id } as any,
    { $set: patch },
    { returnDocument: 'after' },
  )

  await logAction(
    auth,
    'COURSE_UPDATE',
    'courseCatalog',
    String(updated?._id ?? courseId),
    `Updated course ${courseId}`,
  )

  return { ok: true, id: courseId }
})
