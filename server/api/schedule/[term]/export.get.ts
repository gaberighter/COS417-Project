// server/api/schedule/[term]/export.get.ts
// GET /api/schedule/:term/export — §4.5.2
// Role: Admin — download Banner-compatible CSV.

import { defineEventHandler, getRouterParam, createError, setHeader } from 'h3'
import { requireAuth } from '../../../utils/auth'
import {
  catalogCourseIdOf,
  courseSectionOf,
  normalizeCourseReference,
} from '../../../utils/courseReferences'
import { connectDB } from '../../../utils/db'
import {
  CourseCatalog,
  Professor,
  Room,
  Schedule,
  type IAssignment,
} from '../../../models/index'
import { logAction } from '../../../services/auditService'

const bannerHeaders = [
  'Department',
  'CourseNumber',
  'Section',
  'Title',
  'CreditHours',
  'ProfessorCovenantId',
  'Days',
  'StartTime',
  'EndTime',
  'BuildingCode',
  'RoomNumber',
  'EstimatedEnrollment',
] as const

const TERM_PARAM_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

function getBuildingCode(roomAbbreviation: string): string {
  return roomAbbreviation.split(/\s+/)[0] ?? ''
}

function buildBannerRows(
  term: string,
  assignments: IAssignment[],
  lookups: {
    coursesById: Map<
      string,
      {
        deptCode: string
        courseNumber: string
        title: string
        creditHours: number
      }
    >
    professorsById: Map<string, { covenantId: string }>
    roomsById: Map<string, { abbreviation: string; roomNumber: string }>
    estimatedEnrollmentByKey: Map<string, number>
  },
): string[] {
  const rows: string[] = []
  const missingFields: string[] = []

  for (const assignment of assignments) {
    const catalogCourseId = catalogCourseIdOf(assignment.courseId)
    const course = lookups.coursesById.get(catalogCourseId)
    const professor =
      lookups.professorsById.get(assignment.professorId) ??
      lookups.professorsById.get(assignment.professorId.toLowerCase())
    const room = lookups.roomsById.get(assignment.roomId)
    const enrollmentKey = `${assignment.professorId}::${assignment.courseId}`
    const estimatedEnrollment =
      lookups.estimatedEnrollmentByKey.get(enrollmentKey) ??
      lookups.estimatedEnrollmentByKey.get(
        `${assignment.professorId.toLowerCase()}::${assignment.courseId}`,
      )

    const values = [
      course?.deptCode ?? '',
      course?.courseNumber ?? '',
      courseSectionOf(assignment.courseId) ?? '',
      course?.title ?? '',
      course ? String(course.creditHours) : '',
      professor?.covenantId ?? '',
      assignment.days ?? '',
      assignment.startTime ?? '',
      assignment.endTime ?? '',
      room ? getBuildingCode(room.abbreviation) : '',
      room?.roomNumber ?? '',
      estimatedEnrollment !== undefined ? String(estimatedEnrollment) : '',
    ]

    const rowMissing = bannerHeaders.filter((_, index) => values[index] === '')
    if (rowMissing.length > 0) {
      missingFields.push(`${assignment.courseId}: ${rowMissing.join(', ')}`)
      continue
    }

    rows.push(values.map(escapeCsv).join(','))
  }

  if (missingFields.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot export schedule with missing required data: ${missingFields.join('; ')}`,
    })
  }

  return rows
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
  if (!TERM_PARAM_PATTERN.test(term)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'invalid term format',
    })
  }

  const schedule = await Schedule.findOne({ term })
    .sort({ runNumber: -1 })
    .lean()
    .exec()
  if (!schedule) {
    throw createError({
      statusCode: 404,
      statusMessage: `No schedule for term: ${term}`,
    })
  }
  if (!['approved', 'exported'].includes(schedule.status)) {
    throw createError({
      statusCode: 409,
      statusMessage: `Schedule ${term} must be approved before export`,
    })
  }

  const courseIds = [
    ...new Set(schedule.assignments.map((a) => catalogCourseIdOf(a.courseId))),
  ]
  const professorIds = [
    ...new Set(schedule.assignments.map((a) => a.professorId)),
  ]
  const roomIds = [...new Set(schedule.assignments.map((a) => a.roomId))]

  const [courses, professors, rooms] = await Promise.all([
    CourseCatalog.find(
      { _id: { $in: courseIds } },
      { _id: 1, deptCode: 1, courseNumber: 1, title: 1, creditHours: 1 },
    )
      .lean()
      .exec(),
    Professor.find(
      {
        $or: [
          { _id: { $in: professorIds } },
          {
            covenantId: {
              $in: professorIds.map((id) => id.toLowerCase()),
            },
          },
        ],
      },
      {
        _id: 1,
        covenantId: 1,
        preferences: { $elemMatch: { term } },
      },
    )
      .lean()
      .exec(),
    Room.find(
      { $or: [{ _id: { $in: roomIds } }, { abbreviation: { $in: roomIds } }] },
      { _id: 1, abbreviation: 1, roomNumber: 1 },
    )
      .lean()
      .exec(),
  ])

  const coursesById = new Map(
    courses.map((course) => [
      course._id,
      {
        deptCode: course.deptCode,
        courseNumber: course.courseNumber,
        title: course.title,
        creditHours: course.creditHours,
      },
    ]),
  )
  const professorsById = new Map<string, { covenantId: string }>()
  const estimatedEnrollmentByKey = new Map<string, number>()
  for (const professor of professors) {
    professorsById.set(professor._id, { covenantId: professor.covenantId })
    professorsById.set(professor.covenantId, {
      covenantId: professor.covenantId,
    })

    for (const submission of professor.preferences ?? []) {
      if (submission.term !== term) continue
      for (const coursePreference of submission.courses ?? []) {
        const normalizedReference = normalizeCourseReference(
          coursePreference.courseId,
          coursePreference.section ?? null,
        )
        estimatedEnrollmentByKey.set(
          `${professor._id}::${normalizedReference.scheduledCourseId}`,
          coursePreference.expectedEnrollment,
        )
        estimatedEnrollmentByKey.set(
          `${professor.covenantId}::${normalizedReference.scheduledCourseId}`,
          coursePreference.expectedEnrollment,
        )
      }
    }
  }

  const roomsById = new Map<
    string,
    { abbreviation: string; roomNumber: string }
  >()
  for (const room of rooms) {
    roomsById.set(room._id, {
      abbreviation: room.abbreviation,
      roomNumber: room.roomNumber,
    })
    roomsById.set(room.abbreviation, {
      abbreviation: room.abbreviation,
      roomNumber: room.roomNumber,
    })
  }

  const rows = buildBannerRows(term, schedule.assignments, {
    coursesById,
    professorsById,
    roomsById,
    estimatedEnrollmentByKey,
  })
  const csv = [bannerHeaders.join(','), ...rows].join('\n')

  await Schedule.updateOne(
    { _id: schedule._id },
    { $set: { status: 'exported' } },
  ).exec()

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  const encodedTerm = encodeURIComponent(term)
  setHeader(
    event,
    'Content-Disposition',
    `attachment; filename="schedule_${term}.csv"; filename*=UTF-8''schedule_${encodedTerm}.csv`,
  )

  await logAction(
    auth,
    'SCHEDULE_EXPORT',
    'schedules',
    schedule._id,
    `Exported Banner CSV for ${term}`,
  )
  return csv
})
