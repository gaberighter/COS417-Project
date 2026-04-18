// server/api/courses/index.post.ts
// POST /api/courses — upsert one or more course catalog records.
// Role: Admin

import { createError, defineEventHandler, readBody } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { CourseCatalog, courseCode, type ICourse } from '../../models/index'
import { logAction } from '../../services/auditService'

type CourseInput = Partial<ICourse>

interface Payload {
  courses?: CourseInput[]
}

type CourseKey = {
  _id: string
  deptCode: string
  courseNumber: string
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function normalizeCourseKeyField(
  value: unknown,
  fieldName: 'deptCode' | 'courseNumber' | '_id',
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

  return value.trim()
}

function parseCourseKey(input: CourseInput): CourseKey {
  const deptCode = normalizeCourseKeyField(
    input.deptCode,
    'deptCode',
  )?.toUpperCase()
  const courseNumber = normalizeCourseKeyField(
    input.courseNumber,
    'courseNumber',
  )

  if (deptCode && courseNumber) {
    return {
      _id: courseCode({ deptCode, courseNumber }),
      deptCode,
      courseNumber,
    }
  }

  const fromId = normalizeCourseKeyField(input._id, '_id')
  if (fromId) {
    const split = fromId.split(/\s+/)
    if (split.length >= 2) {
      const parsedDeptCode = split[0]?.toUpperCase() ?? ''
      const parsedCourseNumber = split.slice(1).join(' ')

      if (parsedDeptCode && parsedCourseNumber) {
        return {
          _id: courseCode({
            deptCode: parsedDeptCode,
            courseNumber: parsedCourseNumber,
          }),
          deptCode: parsedDeptCode,
          courseNumber: parsedCourseNumber,
        }
      }
    }
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'deptCode and courseNumber are required',
  })
}

function mergeCourse(
  input: CourseInput,
  existing: ICourse | null,
  key: CourseKey,
): ICourse {
  return {
    _id: key._id,
    deptCode: key.deptCode,
    courseNumber: key.courseNumber,
    title: hasOwn(input, 'title')
      ? String(input.title ?? '').trim()
      : (existing?.title ?? ''),
    creditHours: hasOwn(input, 'creditHours')
      ? Number(input.creditHours ?? 0)
      : (existing?.creditHours ?? 0),
    typicalEnrollment: hasOwn(input, 'typicalEnrollment')
      ? (input.typicalEnrollment ?? null)
      : (existing?.typicalEnrollment ?? null),
    requiredEquipment: hasOwn(input, 'requiredEquipment')
      ? (input.requiredEquipment ?? [])
      : (existing?.requiredEquipment ?? []),
    labComponent: hasOwn(input, 'labComponent')
      ? Boolean(input.labComponent)
      : (existing?.labComponent ?? false),
    active: hasOwn(input, 'active')
      ? Boolean(input.active)
      : (existing?.active ?? true),
    typicalProfessor: hasOwn(input, 'typicalProfessor')
      ? (input.typicalProfessor ?? null)
      : (existing?.typicalProfessor ?? null),
    typicalDays: hasOwn(input, 'typicalDays')
      ? (input.typicalDays ?? null)
      : (existing?.typicalDays ?? null),
    typicalTime: hasOwn(input, 'typicalTime')
      ? (input.typicalTime ?? null)
      : (existing?.typicalTime ?? null),
    prerequisites: hasOwn(input, 'prerequisites')
      ? (input.prerequisites ?? [])
      : (existing?.prerequisites ?? []),
    corequisites: hasOwn(input, 'corequisites')
      ? (input.corequisites ?? [])
      : (existing?.corequisites ?? []),
  }
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  let body: Payload | CourseInput | CourseInput[]
  try {
    body = (await readBody<Payload | CourseInput | CourseInput[]>(event)) ?? {}
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing or invalid JSON body',
    })
  }

  const rawCourses = Array.isArray(body)
    ? body
    : 'courses' in body && Array.isArray(body.courses)
      ? body.courses
      : [body as CourseInput]

  if (rawCourses.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'At least one course is required',
    })
  }

  const keyed = rawCourses.map((raw) => ({ raw, key: parseCourseKey(raw) }))
  const existing = await CourseCatalog.find({
    _id: { $in: keyed.map((entry) => entry.key._id) },
  })
    .lean()
    .exec()
  const existingById = new Map(
    existing.map((course) => [course._id ?? '', course]),
  )

  const courses = keyed.map(({ raw, key }) =>
    mergeCourse(raw, existingById.get(key._id) ?? null, key),
  )

  await CourseCatalog.bulkWrite(
    courses.map((course) => ({
      updateOne: {
        filter: { _id: course._id },
        update: {
          $set: {
            deptCode: course.deptCode,
            courseNumber: course.courseNumber,
            title: course.title,
            creditHours: course.creditHours,
            typicalEnrollment: course.typicalEnrollment,
            requiredEquipment: course.requiredEquipment,
            labComponent: course.labComponent,
            active: course.active,
            typicalProfessor: course.typicalProfessor,
            typicalDays: course.typicalDays,
            typicalTime: course.typicalTime,
            prerequisites: course.prerequisites,
            corequisites: course.corequisites,
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
    'COURSE_UPSERT',
    'courseCatalog',
    undefined,
    `Upserted ${courses.length} course record(s)`,
  )

  return { ok: true, count: courses.length }
})
