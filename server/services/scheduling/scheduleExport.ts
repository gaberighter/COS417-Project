import { createError } from 'h3'
import {
  CourseCatalog,
  Professor,
  Room,
  Schedule,
  type IAssignment,
  type ISchedule,
} from '../../models/index'
import { normalizeCourseReference } from '../../utils/courseReferences'
import { isLockedScheduleStatus } from './scheduleRecords'

export type ScheduleExportFormat = 'csv' | 'xlsx'

type ExportSchedule = Pick<
  ISchedule,
  '_id' | 'term' | 'runNumber' | 'status' | 'assignments'
>

const exportHeaders = [
  'Dept',
  'Course',
  'Section',
  'Title',
  'Instructor',
  'Time',
  'Building',
  'Room',
  'Enroll',
  'CRN',
  'Course Fee',
] as const

type ExportRow = Record<(typeof exportHeaders)[number], string | number>
const UNRESOLVED_COURSE_CELL = 'ERROR: Unresolved course'
const UNRESOLVED_INSTRUCTOR_CELL = 'ERROR: Unresolved instructor'
const UNRESOLVED_ROOM_CELL = 'ERROR: Unresolved room'

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
  roomLabel: string
} {
  const normalized = readableValueOrError(roomReference, UNRESOLVED_ROOM_CELL)
  if (!normalized) {
    return {
      buildingCode: '',
      roomLabel: '',
    }
  }

  if (normalized === UNRESOLVED_ROOM_CELL) {
    return {
      buildingCode: UNRESOLVED_ROOM_CELL,
      roomLabel: UNRESOLVED_ROOM_CELL,
    }
  }

  const buildingCode = getBuildingCode(normalized)
  return {
    buildingCode: buildingCode ?? '',
    roomLabel: normalized,
  }
}

function readableValueOrBlank(value: string | null | undefined): string {
  const normalized = normalizeWhitespace(String(value ?? ''))
  if (!normalized || looksLikeOpaqueReference(normalized)) {
    return ''
  }

  return normalized
}

function readableValueOrError(
  value: string | null | undefined,
  errorMessage: string,
): string {
  const normalized = normalizeWhitespace(String(value ?? ''))
  if (!normalized) {
    return ''
  }

  return looksLikeOpaqueReference(normalized) ? errorMessage : normalized
}

function formatExportProfessorLabel(
  professor?: {
    covenantId: string
    displayName?: string
  },
  professorId?: string,
) {
  const displayName = readableValueOrBlank(professor?.displayName)
  if (displayName) {
    return displayName
  }

  const covenantId = readableValueOrBlank(professor?.covenantId)
  if (covenantId) {
    return covenantId
  }

  return readableValueOrError(professorId, UNRESOLVED_INSTRUCTOR_CELL)
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
  },
) {
  const normalizedReference = normalizeCourseReference(assignment.courseId)
  const readableCatalogCourseId =
    readableValueOrBlank(normalizedReference.catalogCourseId) ||
    readableValueOrBlank(normalizedReference.rawCourseId)
  const unresolvedCourseCell =
    readableValueOrError(
      normalizedReference.catalogCourseId || normalizedReference.rawCourseId,
      UNRESOLVED_COURSE_CELL,
    ) || UNRESOLVED_COURSE_CELL

  if (course) {
    return {
      department:
        readableValueOrBlank(course.deptCode) ||
        readableCatalogCourseId.split(/\s+/)[0] ||
        unresolvedCourseCell,
      courseNumber:
        readableValueOrBlank(course.courseNumber) ||
        readableCatalogCourseId.split(/\s+/).slice(1).join(' ') ||
        unresolvedCourseCell,
      section: normalizedReference.section ?? '',
      title:
        readableValueOrBlank(course.title) ||
        readableCatalogCourseId ||
        unresolvedCourseCell,
    }
  }

  const parts = readableCatalogCourseId.split(/\s+/).filter(Boolean)

  return {
    department: parts[0] || unresolvedCourseCell,
    courseNumber: parts.slice(1).join(' ') || unresolvedCourseCell,
    section: normalizedReference.section ?? '',
    title: readableCatalogCourseId || unresolvedCourseCell,
  }
}

function fallbackRoomFields(
  assignment: IAssignment,
  room?: {
    abbreviation: string
    roomNumber: string
    displayName?: string
  },
) {
  const abbreviation = readableValueOrBlank(room?.abbreviation)
  if (abbreviation) {
    return {
      buildingCode: getBuildingCode(abbreviation),
      roomLabel: abbreviation,
    }
  }

  const displayName = readableValueOrBlank(room?.displayName)
  if (displayName) {
    return {
      buildingCode: displayName.includes(' ')
        ? getBuildingCode(displayName)
        : '',
      roomLabel: displayName,
    }
  }

  const roomNumber = readableValueOrBlank(room?.roomNumber)
  if (roomNumber) {
    return {
      buildingCode: '',
      roomLabel: roomNumber,
    }
  }

  return splitRoomReference(assignment.roomId)
}

function formatCourseFee(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(2)
    : ''
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
      }
    >
    professorsById: Map<string, { covenantId: string; displayName?: string }>
    roomsById: Map<
      string,
      { abbreviation: string; roomNumber: string; displayName?: string }
    >
    preferenceFieldsByKey: Map<string, PreferenceExportFields>
  },
): ExportRow[] {
  const rows: ExportRow[] = []

  for (const assignment of assignments) {
    const normalizedReference = normalizeCourseReference(assignment.courseId)
    const course = getLookupValue(
      lookups.coursesById,
      normalizedReference.catalogCourseId,
    )
    const professor = getLookupValue(
      lookups.professorsById,
      assignment.professorId,
    )
    const room = getLookupValue(lookups.roomsById, assignment.roomId)
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

    const row: ExportRow = {
      Dept: courseFields.department,
      Course: courseFields.courseNumber,
      Section: courseFields.section,
      Title: courseFields.title,
      Instructor: formatExportProfessorLabel(professor, assignment.professorId),
      Time: formatExportTimeLabel(assignment),
      Building: roomFields.buildingCode,
      Room: roomFields.roomLabel,
      Enroll:
        assignment.enrollmentOverride !== null &&
        assignment.enrollmentOverride !== undefined
          ? assignment.enrollmentOverride
          : preferenceFields?.estimatedEnrollment !== null &&
              preferenceFields?.estimatedEnrollment !== undefined
            ? preferenceFields.estimatedEnrollment
            : '',
      CRN: readableValueOrBlank(preferenceFields?.crn ?? ''),
      'Course Fee': formatCourseFee(preferenceFields?.courseFee),
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
        expandQueryKeys(
          normalizeCourseReference(assignment.courseId).catalogCourseId,
        ),
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
      { _id: 1, deptCode: 1, courseNumber: 1, title: 1 },
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
          { displayName: { $in: professorIds } },
        ],
      },
      {
        _id: 1,
        covenantId: 1,
        displayName: 1,
        preferences: { $elemMatch: { term: schedule.term } },
      },
    )
      .collation({ locale: 'en', strength: 2 })
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
    { abbreviation: string; roomNumber: string; displayName?: string }
  >()
  for (const room of rooms) {
    const payload = {
      abbreviation: room.abbreviation,
      roomNumber: room.roomNumber,
      displayName: room.displayName,
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
