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

const exportHeaders = [
  'Department',
  'Course',
  'Section',
  'Title',
  'CreditHours',
  'CRN',
  'CourseFee',
  'Instructor',
  'InstructorCovenantId',
  'Days',
  'StartTime',
  'EndTime',
  'Time',
  'Building',
  'Room',
  'EstimatedEnrollment',
  'OverrideBy',
] as const

type ExportRow = Record<(typeof exportHeaders)[number], string | number>

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

function expandQueryKeys(value: string | null | undefined): string[] {
  if (!value) return []

  const normalized = normalizeWhitespace(String(value))
  if (!normalized) return []

  return [
    ...new Set([
      normalized,
      normalized.toLowerCase(),
      normalized.toUpperCase(),
      normalizeLookupKey(normalized),
    ]),
  ]
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

type PreferenceExportFields = {
  estimatedEnrollment: number | null
  crn: string | null
  courseFee: number | null
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

function splitRoomReference(roomReference: string | null | undefined): {
  buildingCode: string
  roomNumber: string
} {
  const normalized = normalizeWhitespace(String(roomReference ?? ''))
  if (!normalized) {
    return {
      buildingCode: '',
      roomNumber: '',
    }
  }

  const [buildingCode, ...rest] = normalized.split(/\s+/)
  return {
    buildingCode: buildingCode ?? '',
    roomNumber: rest.join(' '),
  }
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

function formatExportOverrideLabel(input: {
  overrideBy?: string | null
  professorsById: Map<string, { covenantId: string; displayName?: string }>
}) {
  const overrideBy = normalizeWhitespace(String(input.overrideBy ?? ''))
  if (!overrideBy) return ''

  const professor = getLookupValue(input.professorsById, overrideBy)
  if (professor?.displayName) {
    return professor.displayName
  }

  return overrideBy
}

function formatExportRoomLabel(
  room?: {
    abbreviation: string
    roomNumber: string
  },
  roomId?: string,
) {
  if (room?.abbreviation) {
    return room.abbreviation
  }

  if (room?.roomNumber) {
    return `Room ${room.roomNumber}`
  }

  if (roomId && !looksLikeOpaqueReference(roomId)) {
    return roomId
  }

  return 'Unresolved room'
}

function formatExportTimeLabel(assignment: IAssignment) {
  const parts = [
    assignment.days ?? '',
    [assignment.startTime ?? '', assignment.endTime ?? '']
      .filter(Boolean)
      .join('-'),
  ].filter(Boolean)

  return parts.join(' ')
}

function fallbackCourseFields(
  assignment: IAssignment,
  course?: {
    deptCode: string
    courseNumber: string
    title: string
    creditHours: number
  },
) {
  if (course) {
    return {
      department: course.deptCode,
      courseNumber: course.courseNumber,
      title: course.title,
      creditHours: course.creditHours,
    }
  }

  const normalizedReference = normalizeCourseReference(assignment.courseId)
  const catalogCourseId = normalizedReference.catalogCourseId
  const parts = catalogCourseId.split(/\s+/).filter(Boolean)

  return {
    department: parts[0] ?? '',
    courseNumber: parts.slice(1).join(' '),
    title: catalogCourseId || assignment.courseId || 'UNRESOLVED COURSE',
    creditHours: '',
  }
}

function fallbackRoomFields(
  assignment: IAssignment,
  room?: {
    abbreviation: string
    roomNumber: string
  },
) {
  if (room) {
    return {
      buildingCode: getBuildingCode(room.abbreviation),
      roomNumber: room.roomNumber,
    }
  }

  return splitRoomReference(assignment.roomId)
}

function buildExportRowData(
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
    preferenceFieldsByKey: Map<string, PreferenceExportFields>
  },
): ExportRow[] {
  const rows: ExportRow[] = []

  for (const assignment of assignments) {
    const catalogCourseId = catalogCourseIdOf(assignment.courseId)
    const course = getLookupValue(lookups.coursesById, catalogCourseId)
    const professor = getLookupValue(
      lookups.professorsById,
      assignment.professorId,
    )
    const room = getLookupValue(lookups.roomsById, assignment.roomId)
    const normalizedReference = normalizeCourseReference(assignment.courseId)
    const preferenceFields =
      lookups.preferenceFieldsByKey.get(
        buildEnrollmentKey(
          assignment.professorId,
          normalizedReference.scheduledCourseId,
        ),
      ) ??
      lookups.preferenceFieldsByKey.get(
        buildEnrollmentKey(
          assignment.professorId,
          normalizedReference.catalogCourseId,
        ),
      )
    const courseFields = fallbackCourseFields(assignment, course)
    const roomFields = fallbackRoomFields(assignment, room)
    const roomLabel = formatExportRoomLabel(room, assignment.roomId)

    const row: ExportRow = {
      Department: courseFields.department,
      Course: courseFields.courseNumber,
      Section: courseSectionOf(assignment.courseId) ?? '',
      Title: courseFields.title,
      CreditHours: courseFields.creditHours,
      CRN: preferenceFields?.crn ?? '',
      CourseFee:
        preferenceFields?.courseFee !== null &&
        preferenceFields?.courseFee !== undefined
          ? preferenceFields.courseFee
          : '',
      Instructor: formatExportProfessorLabel(professor),
      InstructorCovenantId:
        professor?.covenantId || assignment.professorId || '',
      Days: assignment.days ?? '',
      StartTime: assignment.startTime ?? '',
      EndTime: assignment.endTime ?? '',
      Time: formatExportTimeLabel(assignment),
      Building: roomFields.buildingCode,
      Room: roomLabel,
      EstimatedEnrollment:
        preferenceFields?.estimatedEnrollment !== null &&
        preferenceFields?.estimatedEnrollment !== undefined
          ? preferenceFields.estimatedEnrollment
          : '',
      OverrideBy: formatExportOverrideLabel({
        overrideBy: assignment.overrideBy,
        professorsById: lookups.professorsById,
      }),
    }

    rows.push(row)
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
      schedule.assignments.flatMap((assignment) =>
        expandQueryKeys(catalogCourseIdOf(assignment.courseId)),
      ),
    ),
  ]
  const professorIds = [
    ...new Set(
      schedule.assignments.flatMap((assignment) =>
        expandQueryKeys(assignment.professorId),
      ),
    ),
  ]
  const roomIds = [
    ...new Set(
      schedule.assignments.flatMap((assignment) =>
        expandQueryKeys(assignment.roomId),
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
      {
        $or: [
          { _id: { $in: roomIds } },
          { abbreviation: { $in: roomIds } },
          { displayName: { $in: roomIds } },
        ],
      },
      { _id: 1, abbreviation: 1, roomNumber: 1, displayName: 1 },
    )
      .collation({ locale: 'en', strength: 2 })
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
  const preferenceFieldsByKey = new Map<string, PreferenceExportFields>()
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
    setLookupAlias(professorsById, professor.displayName, payload)

    for (const submission of professor.preferences ?? []) {
      if (submission.term !== schedule.term) continue
      for (const coursePreference of submission.courses ?? []) {
        const normalizedReference = normalizeCourseReference(
          coursePreference.courseId,
          coursePreference.section ?? null,
        )
        const preferencePayload: PreferenceExportFields = {
          estimatedEnrollment: coursePreference.expectedEnrollment ?? null,
          crn: coursePreference.crn ?? null,
          courseFee: coursePreference.courseFee ?? null,
        }

        for (const professorKey of [
          professor._id,
          professor.covenantId,
          professor.displayName,
          coursePreference.instructor ?? '',
        ]) {
          if (!professorKey) continue

          preferenceFieldsByKey.set(
            buildEnrollmentKey(
              professorKey,
              normalizedReference.scheduledCourseId,
            ),
            preferencePayload,
          )
          preferenceFieldsByKey.set(
            buildEnrollmentKey(
              professorKey,
              normalizedReference.catalogCourseId,
            ),
            preferencePayload,
          )
        }
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
    setLookupAlias(roomsById, room.displayName, payload)
  }

  const rows = buildExportRowData(schedule.assignments, {
    coursesById,
    professorsById,
    roomsById,
    preferenceFieldsByKey,
  })

  const baseFilename = `schedule_${schedule.term}_run_${schedule.runNumber}`

  if (format === 'xlsx') {
    const XLSX = await loadXlsxModule()
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: [...exportHeaders],
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
    exportHeaders
      .map((header) => escapeCsv(String(row[header] ?? '')))
      .join(','),
  )
  const body = [exportHeaders.join(','), ...csvRows].join('\n')

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
