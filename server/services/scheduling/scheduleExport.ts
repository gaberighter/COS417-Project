import { createError } from 'h3'
import {
  CourseCatalog,
  Professor,
  Room,
  Schedule,
  type IAssignment,
  type ISchedule,
} from '../../models/index'
import {
  catalogCourseIdOf,
  courseSectionOf,
  normalizeCourseReference,
} from '../../utils/courseReferences'
import { isLockedScheduleStatus } from './scheduleRecords'

export type ScheduleExportFormat = 'csv' | 'xlsx'

type ExportSchedule = Pick<
  ISchedule,
  '_id' | 'term' | 'runNumber' | 'status' | 'assignments'
>

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

type BannerRow = Record<(typeof bannerHeaders)[number], string | number>

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function looksLikeOpaqueReference(value: string): boolean {
  return /^([a-f0-9]{24})(-[a-z0-9]+)?$/i.test(value)
}

function normalizeLookupKey(value: string): string {
  const normalized = normalizeWhitespace(value)
  return looksLikeOpaqueReference(normalized)
    ? normalized.toLowerCase()
    : normalized
}

function setLookupAlias<Value>(
  map: Map<string, Value>,
  key: string | null | undefined,
  value: Value,
) {
  if (!key) return

  const normalized = normalizeWhitespace(String(key))
  if (!normalized) return

  map.set(normalized, value)
  map.set(normalized.toLowerCase(), value)
  map.set(normalized.toUpperCase(), value)
  map.set(normalizeLookupKey(normalized), value)
}

function getLookupValue<Value>(
  map: Map<string, Value>,
  key: string | null | undefined,
): Value | undefined {
  if (!key) return undefined

  const normalized = normalizeWhitespace(String(key))
  if (!normalized) return undefined

  return (
    map.get(normalized) ??
    map.get(normalized.toLowerCase()) ??
    map.get(normalized.toUpperCase()) ??
    map.get(normalizeLookupKey(normalized))
  )
}

function buildEnrollmentKey(professorKey: string, courseKey: string) {
  return `${normalizeLookupKey(professorKey)}::${normalizeLookupKey(courseKey)}`
}

async function loadXlsxModule() {
  const module = await import('xlsx')
  return module.default ?? module
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

function getBuildingCode(roomAbbreviation: string): string {
  return roomAbbreviation.split(/\s+/)[0] ?? ''
}

function looksLikeOpaqueId(value: string): boolean {
  return /^[a-f0-9]{24}$/i.test(value)
}

function formatExportCourseLabel(input: {
  assignment: IAssignment
  course?: {
    deptCode: string
    courseNumber: string
    title: string
    creditHours: number
  }
}) {
  const section = courseSectionOf(input.assignment.courseId)
  const base = input.course
    ? [input.course.deptCode, input.course.courseNumber]
        .filter(Boolean)
        .join(' ')
    : null

  if (base) {
    return section ? `${base}-${section}` : base
  }

  return section ? `Unresolved course (${section})` : 'Unresolved course'
}

function formatExportProfessorLabel(professor?: {
  covenantId: string
  displayName?: string
}) {
  if (professor?.displayName) {
    return professor.displayName
  }

  if (professor?.covenantId && !looksLikeOpaqueId(professor.covenantId)) {
    return professor.covenantId
  }

  return 'Unresolved professor'
}

function formatExportRoomLabel(room?: {
  abbreviation: string
  roomNumber: string
}) {
  if (room?.abbreviation) {
    return room.abbreviation
  }

  if (room?.roomNumber) {
    return `Room ${room.roomNumber}`
  }

  return 'Unresolved room'
}

function buildBannerRowData(
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
    professorsById: Map<string, { covenantId: string; displayName?: string }>
    roomsById: Map<string, { abbreviation: string; roomNumber: string }>
    estimatedEnrollmentByKey: Map<string, number>
  },
): BannerRow[] {
  const rows: BannerRow[] = []
  const missingFields: string[] = []

  for (const assignment of assignments) {
    const catalogCourseId = catalogCourseIdOf(assignment.courseId)
    const course = getLookupValue(lookups.coursesById, catalogCourseId)
    const professor = getLookupValue(
      lookups.professorsById,
      assignment.professorId,
    )
    const room = getLookupValue(lookups.roomsById, assignment.roomId)
    const normalizedReference = normalizeCourseReference(assignment.courseId)
    const estimatedEnrollment =
      lookups.estimatedEnrollmentByKey.get(
        buildEnrollmentKey(
          assignment.professorId,
          normalizedReference.scheduledCourseId,
        ),
      ) ??
      lookups.estimatedEnrollmentByKey.get(
        buildEnrollmentKey(
          assignment.professorId,
          normalizedReference.catalogCourseId,
        ),
      )
    const exportRowLabel = [
      formatExportCourseLabel({ assignment, course }),
      formatExportProfessorLabel(professor),
      formatExportRoomLabel(room),
    ].join(' | ')

    const row: BannerRow = {
      Department: course?.deptCode ?? '',
      CourseNumber: course?.courseNumber ?? '',
      Section: courseSectionOf(assignment.courseId) ?? '',
      Title: course?.title ?? '',
      CreditHours: course ? course.creditHours : '',
      ProfessorCovenantId: professor?.covenantId ?? '',
      Days: assignment.days ?? '',
      StartTime: assignment.startTime ?? '',
      EndTime: assignment.endTime ?? '',
      BuildingCode: room ? getBuildingCode(room.abbreviation) : '',
      RoomNumber: room?.roomNumber ?? '',
      EstimatedEnrollment:
        estimatedEnrollment !== undefined ? estimatedEnrollment : '',
    }

    const rowMissing = bannerHeaders.filter((header) => row[header] === '')
    if (rowMissing.length > 0) {
      missingFields.push(`${exportRowLabel}: ${rowMissing.join(', ')}`)
      continue
    }

    rows.push(row)
  }

  if (missingFields.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot export schedule with missing required data: ${missingFields.join('; ')}`,
    })
  }

  return rows
}

export function parseScheduleExportFormat(
  value: unknown,
): ScheduleExportFormat {
  const normalized = String(value ?? 'csv')
    .trim()
    .toLowerCase()
  if (normalized === 'csv' || normalized === 'xlsx') {
    return normalized
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'format must be csv or xlsx',
  })
}

export async function buildScheduleExportFile(
  schedule: ExportSchedule,
  format: ScheduleExportFormat,
) {
  if (!isLockedScheduleStatus(schedule.status)) {
    throw createError({
      statusCode: 409,
      statusMessage: `Schedule ${schedule.term} run ${schedule.runNumber} must be approved before export`,
    })
  }

  const courseIds = [
    ...new Set(
      schedule.assignments.map((assignment) =>
        normalizeLookupKey(catalogCourseIdOf(assignment.courseId)),
      ),
    ),
  ]
  const professorIds = [
    ...new Set(
      schedule.assignments.map((assignment) =>
        normalizeLookupKey(assignment.professorId),
      ),
    ),
  ]
  const roomIds = [
    ...new Set(
      schedule.assignments.map((assignment) =>
        normalizeLookupKey(assignment.roomId),
      ),
    ),
  ]

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
        displayName: 1,
        preferences: { $elemMatch: { term: schedule.term } },
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

  const coursesById = new Map<
    string,
    {
      deptCode: string
      courseNumber: string
      title: string
      creditHours: number
    }
  >()
  const professorsById = new Map<
    string,
    { covenantId: string; displayName?: string }
  >()
  const estimatedEnrollmentByKey = new Map<string, number>()
  for (const course of courses) {
    const payload = {
      deptCode: course.deptCode,
      courseNumber: course.courseNumber,
      title: course.title,
      creditHours: course.creditHours,
    }
    setLookupAlias(coursesById, course._id, payload)
  }
  for (const professor of professors) {
    const payload = {
      covenantId: professor.covenantId,
      displayName: professor.displayName,
    }
    setLookupAlias(professorsById, professor._id, payload)
    setLookupAlias(professorsById, professor.covenantId, payload)

    for (const submission of professor.preferences ?? []) {
      if (submission.term !== schedule.term) continue
      for (const coursePreference of submission.courses ?? []) {
        const normalizedReference = normalizeCourseReference(
          coursePreference.courseId,
          coursePreference.section ?? null,
        )
        estimatedEnrollmentByKey.set(
          buildEnrollmentKey(
            professor._id,
            normalizedReference.scheduledCourseId,
          ),
          coursePreference.expectedEnrollment,
        )
        estimatedEnrollmentByKey.set(
          buildEnrollmentKey(
            professor._id,
            normalizedReference.catalogCourseId,
          ),
          coursePreference.expectedEnrollment,
        )
        estimatedEnrollmentByKey.set(
          buildEnrollmentKey(
            professor.covenantId,
            normalizedReference.scheduledCourseId,
          ),
          coursePreference.expectedEnrollment,
        )
        estimatedEnrollmentByKey.set(
          buildEnrollmentKey(
            professor.covenantId,
            normalizedReference.catalogCourseId,
          ),
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
    const payload = {
      abbreviation: room.abbreviation,
      roomNumber: room.roomNumber,
    }
    setLookupAlias(roomsById, room._id, payload)
    setLookupAlias(roomsById, room.abbreviation, payload)
  }

  const rows = buildBannerRowData(schedule.term, schedule.assignments, {
    coursesById,
    professorsById,
    roomsById,
    estimatedEnrollmentByKey,
  })

  const baseFilename = `schedule_${schedule.term}_run_${schedule.runNumber}`

  if (format === 'xlsx') {
    const XLSX = await loadXlsxModule()
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: [...bannerHeaders],
    })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedule')
    const body = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })

    return {
      body,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${baseFilename}.xlsx`,
    }
  }

  const csvRows = rows.map((row) =>
    bannerHeaders
      .map((header) => escapeCsv(String(row[header] ?? '')))
      .join(','),
  )
  const body = [bannerHeaders.join(','), ...csvRows].join('\n')

  return {
    body,
    contentType: 'text/csv; charset=utf-8',
    filename: `${baseFilename}.csv`,
  }
}

export async function markScheduleAsExported(scheduleId: string) {
  await Schedule.updateOne(
    { _id: scheduleId },
    { $set: { status: 'exported' } },
  ).exec()
}
