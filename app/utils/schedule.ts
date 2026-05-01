import type {
  CourseRecord,
  EnrichedScheduleRow,
  PreferenceSubmissionRecord,
  ProfessorRecord,
  RoomRecord,
  ScheduleAssignment,
  ScheduleIssue,
} from '~~/types/schedule'

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function looksLikeOpaqueId(value: string): boolean {
  return /^[a-f0-9]{24}$/i.test(value)
}

function normalizeCourseIdText(value: string): string {
  const normalized = normalizeWhitespace(value)
  return looksLikeOpaqueId(normalized) ? normalized : normalized.toUpperCase()
}

function normalizeSectionText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }

  const normalized = normalizeWhitespace(String(value)).toUpperCase()
  return normalized.length > 0 ? normalized : null
}

function parseEmbeddedSection(normalizedCourseId: string): {
  catalogCourseId: string
  section: string | null
} {
  const match = normalizedCourseId.match(/^(.+\s+\S+)-([A-Z0-9]+)$/)
  if (!match) {
    return {
      catalogCourseId: normalizedCourseId,
      section: null,
    }
  }

  return {
    catalogCourseId: normalizeCourseIdText(match[1] ?? normalizedCourseId),
    section: normalizeSectionText(match[2] ?? null),
  }
}

export function buildScheduledCourseId(
  catalogCourseId: string,
  section: string | null,
): string {
  const normalizedSection = normalizeSectionText(section)

  return normalizedSection
    ? `${normalizeCourseIdText(catalogCourseId)}-${normalizedSection}`
    : normalizeCourseIdText(catalogCourseId)
}

export function normalizeCourseReference(
  courseId: string,
  section?: string | null,
): {
  rawCourseId: string
  catalogCourseId: string
  scheduledCourseId: string
  section: string | null
} {
  const rawCourseId = normalizeCourseIdText(courseId)
  const normalizedSection = normalizeSectionText(section)

  if (normalizedSection !== null) {
    const suffix = `-${normalizedSection}`
    const catalogCourseId = rawCourseId.endsWith(suffix)
      ? normalizeCourseIdText(rawCourseId.slice(0, -suffix.length))
      : rawCourseId

    return {
      rawCourseId,
      catalogCourseId,
      scheduledCourseId: buildScheduledCourseId(
        catalogCourseId,
        normalizedSection,
      ),
      section: normalizedSection,
    }
  }

  const parsed = parseEmbeddedSection(rawCourseId)
  return {
    rawCourseId,
    catalogCourseId: parsed.catalogCourseId,
    scheduledCourseId: buildScheduledCourseId(
      parsed.catalogCourseId,
      parsed.section,
    ),
    section: parsed.section,
  }
}

export function issueTypeFromReason(reason: string): string {
  const match = reason.match(/^\[([A-Z0-9_]+)\]/)
  return match?.[1] ?? 'GENERAL'
}

export function buildScheduleLookupData(input: {
  courses: CourseRecord[]
  professors: ProfessorRecord[]
  rooms: RoomRecord[]
  preferences: PreferenceSubmissionRecord[]
}) {
  const coursesById = new Map(input.courses.map((course) => [course._id, course]))
  const professorsById = new Map<string, ProfessorRecord>()
  const roomsById = new Map<string, RoomRecord>()
  const enrollmentByKey = new Map<string, number>()

  for (const professor of input.professors) {
    professorsById.set(professor._id, professor)
    professorsById.set(professor.covenantId, professor)
    professorsById.set(professor.covenantId.toLowerCase(), professor)
  }

  for (const room of input.rooms) {
    roomsById.set(room._id, room)
    roomsById.set(room.abbreviation, room)
  }

  for (const submission of input.preferences) {
    for (const course of submission.courses ?? []) {
      const normalized = normalizeCourseReference(
        course.courseId,
        course.section ?? null,
      )
      for (const professorKey of [
        submission.professorId,
        submission.covenantId,
        submission.covenantId.toLowerCase(),
      ]) {
        enrollmentByKey.set(
          `${professorKey}::${normalized.scheduledCourseId}`,
          course.expectedEnrollment,
        )
        enrollmentByKey.set(
          `${professorKey}::${normalized.catalogCourseId}`,
          course.expectedEnrollment,
        )
      }
    }
  }

  return {
    coursesById,
    professorsById,
    roomsById,
    enrollmentByKey,
  }
}

function roomBuilding(room: RoomRecord | undefined): string {
  if (!room) return 'Unassigned'
  return room.abbreviation?.split(/\s+/)[0] ?? room.buildingName ?? 'Unknown'
}

function roomLabel(room: RoomRecord | undefined, roomId: string): string {
  if (!room) return roomId
  return room.abbreviation || room.displayName || `${room.buildingName} ${room.roomNumber}`
}

export function buildEnrichedScheduleRows(
  assignments: ScheduleAssignment[],
  lookups: ReturnType<typeof buildScheduleLookupData>,
): EnrichedScheduleRow[] {
  return assignments.map((assignment) => {
    const normalized = normalizeCourseReference(assignment.courseId)
    const course = lookups.coursesById.get(normalized.catalogCourseId)
    const professor =
      lookups.professorsById.get(assignment.professorId) ??
      lookups.professorsById.get(assignment.professorId.toLowerCase())
    const room =
      lookups.roomsById.get(assignment.roomId) ??
      lookups.roomsById.get(assignment.roomId.toUpperCase())
    const enrollment =
      lookups.enrollmentByKey.get(
        `${assignment.professorId}::${normalized.scheduledCourseId}`,
      ) ??
      lookups.enrollmentByKey.get(
        `${assignment.professorId.toLowerCase()}::${normalized.scheduledCourseId}`,
      ) ??
      lookups.enrollmentByKey.get(
        `${assignment.professorId}::${normalized.catalogCourseId}`,
      ) ??
      lookups.enrollmentByKey.get(
        `${assignment.professorId.toLowerCase()}::${normalized.catalogCourseId}`,
      ) ??
      null

    return {
      courseId: assignment.courseId,
      catalogCourseId: normalized.catalogCourseId,
      section: normalized.section,
      department: course?.deptCode ?? normalized.catalogCourseId.split(/\s+/)[0] ?? '',
      courseNumber:
        course?.courseNumber ?? normalized.catalogCourseId.split(/\s+/).slice(1).join(' '),
      courseTitle: course?.title ?? normalized.catalogCourseId,
      instructorId: assignment.professorId,
      instructorName: professor?.displayName ?? assignment.professorId,
      roomId: assignment.roomId,
      building: roomBuilding(room),
      roomNumber: room?.roomNumber ?? assignment.roomId,
      roomLabel: roomLabel(room, assignment.roomId),
      enrollment,
      days: assignment.days,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      timeLabel: `${assignment.days} ${assignment.startTime}-${assignment.endTime}`,
      overrideBy: assignment.overrideBy ?? null,
    }
  })
}

export function buildIssueTableRows(
  issues: ScheduleIssue[],
  rows: EnrichedScheduleRow[],
): Array<{
  courseId: string
  courseTitle: string
  instructor: string
  room: string
  time: string
  issueType: string
  reason: string
}> {
  const rowsByCourseId = new Map(rows.map((row) => [row.courseId, row]))

  return issues.map((issue) => {
    const row = rowsByCourseId.get(issue.courseId)
    return {
      courseId: issue.courseId,
      courseTitle: row?.courseTitle ?? issue.courseId,
      instructor: row?.instructorName ?? 'Unassigned',
      room: row?.roomLabel ?? 'Unassigned',
      time: row?.timeLabel ?? 'Unassigned',
      issueType: issueTypeFromReason(issue.reason),
      reason: issue.reason,
    }
  })
}
