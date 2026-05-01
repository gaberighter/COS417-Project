import type {
  CourseRecord,
  EnrichedScheduleRow,
  PlacementTrace,
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

  if (looksLikeOpaqueId(normalized)) {
    map.set(normalized.toLowerCase(), value)
  }
}

function getLookupValue<Value>(
  map: Map<string, Value>,
  key: string,
): Value | undefined {
  const normalized = normalizeWhitespace(key)
  if (!normalized) return undefined

  return (
    map.get(normalized) ??
    map.get(normalized.toLowerCase()) ??
    map.get(normalized.toUpperCase()) ??
    map.get(normalizeLookupKey(normalized))
  )
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
  const opaqueMatch = normalizedCourseId.match(/^([a-f0-9]{24})-([A-Z0-9]+)$/i)
  if (opaqueMatch) {
    return {
      catalogCourseId: normalizeCourseIdText(
        opaqueMatch[1] ?? normalizedCourseId,
      ),
      section: normalizeSectionText(opaqueMatch[2] ?? null),
    }
  }

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
  const coursesById = new Map<string, CourseRecord>()
  const professorsById = new Map<string, ProfessorRecord>()
  const roomsById = new Map<string, RoomRecord>()
  const enrollmentByKey = new Map<string, number>()

  function buildEnrollmentKey(professorKey: string, courseKey: string) {
    return `${normalizeLookupKey(professorKey)}::${normalizeLookupKey(courseKey)}`
  }

  for (const course of input.courses) {
    setLookupAlias(coursesById, course._id, course)
  }

  for (const professor of input.professors) {
    setLookupAlias(professorsById, professor._id, professor)
    setLookupAlias(professorsById, professor.covenantId, professor)
    setLookupAlias(professorsById, professor.displayName, professor)
  }

  for (const room of input.rooms) {
    setLookupAlias(roomsById, room._id, room)
    setLookupAlias(roomsById, room.abbreviation, room)
    setLookupAlias(roomsById, room.displayName, room)
    setLookupAlias(roomsById, `${room.buildingName} ${room.roomNumber}`, room)
  }

  for (const submission of input.preferences) {
    for (const course of submission.courses ?? []) {
      const normalized = normalizeCourseReference(
        course.courseId,
        course.section ?? null,
      )
      const resolvedInstructor = course.instructor
        ? lookupProfessor(
            {
              coursesById,
              professorsById,
              roomsById,
              enrollmentByKey,
            },
            course.instructor,
          )
        : undefined
      for (const professorKey of [
        submission.professorId,
        submission.covenantId,
        submission.covenantId.toLowerCase(),
        course.instructor ?? '',
        resolvedInstructor?._id ?? '',
        resolvedInstructor?.covenantId ?? '',
        resolvedInstructor?.displayName ?? '',
      ]) {
        if (!professorKey) continue
        enrollmentByKey.set(
          buildEnrollmentKey(professorKey, normalized.scheduledCourseId),
          course.expectedEnrollment,
        )
        enrollmentByKey.set(
          buildEnrollmentKey(professorKey, normalized.catalogCourseId),
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

function lookupCourse(
  lookups: ReturnType<typeof buildScheduleLookupData>,
  courseId: string,
  section?: string | null,
) {
  const normalized = normalizeCourseReference(courseId, section)

  return {
    normalized,
    course:
      getLookupValue(lookups.coursesById, normalized.catalogCourseId) ??
      getLookupValue(lookups.coursesById, normalized.rawCourseId),
  }
}

function lookupProfessor(
  lookups: ReturnType<typeof buildScheduleLookupData>,
  professorId: string,
) {
  return getLookupValue(lookups.professorsById, professorId)
}

function lookupRoom(
  lookups: ReturnType<typeof buildScheduleLookupData>,
  roomId: string,
) {
  return getLookupValue(lookups.roomsById, roomId)
}

function resolveReferenceLabel(
  lookups: ReturnType<typeof buildScheduleLookupData>,
  value: string,
): string | null {
  const professor = lookupProfessor(lookups, value)
  if (professor) {
    return professor.displayName
  }

  const room = lookupRoom(lookups, value)
  if (room) {
    return roomLabel(room, value)
  }

  const { normalized, course } = lookupCourse(lookups, value)
  if (course || normalized.catalogCourseId !== value) {
    return formatCourseLabel({
      catalogCourseId: normalized.catalogCourseId,
      course,
      section: normalized.section,
      fallbackCourseId: value,
    })
  }

  return null
}

function replaceOpaqueReferences(
  text: string,
  lookups?: ReturnType<typeof buildScheduleLookupData>,
) {
  if (!lookups) return text

  return text.replace(
    /\b[a-f0-9]{24}(?:-[a-z0-9]+)?\b/gi,
    (match) => resolveReferenceLabel(lookups, match) ?? match,
  )
}

function summarizeList(items: string[], maxVisible = 2): string {
  if (items.length === 0) return 'None'

  const visible = items.slice(0, maxVisible)
  const remaining = items.length - visible.length
  return remaining > 0
    ? `${visible.join(', ')} +${remaining} more`
    : visible.join(', ')
}

function compactTraceReason(
  reason: string,
  lookups: ReturnType<typeof buildScheduleLookupData>,
) {
  const withNames = replaceOpaqueReferences(reason, lookups)
  const withoutManualOptions = withNames.replace(
    /\s*Manual options:\s*.+$/i,
    '',
  )
  const withoutAttemptSummary = withoutManualOptions.replace(
    /\s*Placement attempts exhausted:[^.]+\./i,
    '',
  )
  return withoutAttemptSummary.trim().replace(/\s+/g, ' ')
}

function lookupEnrollment(
  lookups: ReturnType<typeof buildScheduleLookupData>,
  professorId: string,
  normalizedCourseId: {
    scheduledCourseId: string
    catalogCourseId: string
  },
) {
  for (const key of [
    `${normalizeLookupKey(professorId)}::${normalizeLookupKey(normalizedCourseId.scheduledCourseId)}`,
    `${normalizeLookupKey(professorId)}::${normalizeLookupKey(normalizedCourseId.catalogCourseId)}`,
  ]) {
    const match = lookups.enrollmentByKey.get(key)
    if (match !== undefined) {
      return match
    }
  }

  return null
}

function formatCourseLabel(input: {
  catalogCourseId: string
  course?: CourseRecord
  section?: string | null
  fallbackCourseId?: string
}) {
  const baseLabel = input.course
    ? [input.course.deptCode, input.course.courseNumber]
        .filter(Boolean)
        .join(' ')
    : input.catalogCourseId

  if (!baseLabel) {
    return input.fallbackCourseId ?? 'Unassigned'
  }

  return input.section ? `${baseLabel}-${input.section}` : baseLabel
}

function roomBuilding(room: RoomRecord | undefined): string {
  if (!room) return 'Unassigned'
  return room.abbreviation?.split(/\s+/)[0] ?? room.buildingName ?? 'Unknown'
}

function roomLabel(room: RoomRecord | undefined, roomId: string): string {
  if (!room) return roomId
  return (
    room.abbreviation ||
    room.displayName ||
    `${room.buildingName} ${room.roomNumber}`
  )
}

export function buildEnrichedScheduleRows(
  assignments: ScheduleAssignment[],
  lookups: ReturnType<typeof buildScheduleLookupData>,
): EnrichedScheduleRow[] {
  return assignments.map((assignment) => {
    const { normalized, course } = lookupCourse(lookups, assignment.courseId)
    const professor = lookupProfessor(lookups, assignment.professorId)
    const room = lookupRoom(lookups, assignment.roomId)
    const enrollment = lookupEnrollment(
      lookups,
      assignment.professorId,
      normalized,
    )

    return {
      courseId: assignment.courseId,
      catalogCourseId: normalized.catalogCourseId,
      section: normalized.section,
      department:
        course?.deptCode ?? normalized.catalogCourseId.split(/\s+/)[0] ?? '',
      courseNumber:
        course?.courseNumber ??
        normalized.catalogCourseId.split(/\s+/).slice(1).join(' '),
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
  lookups?: ReturnType<typeof buildScheduleLookupData>,
): Array<{
  courseId: string
  courseLabel: string
  courseTitle: string
  instructor: string
  room: string
  time: string
  issueType: string
  reason: string
}> {
  const rowsByCourseId = new Map<string, EnrichedScheduleRow>()

  for (const row of rows) {
    rowsByCourseId.set(row.courseId, row)
    rowsByCourseId.set(normalizeLookupKey(row.courseId), row)
    rowsByCourseId.set(normalizeLookupKey(row.catalogCourseId), row)
  }

  return issues.map((issue) => {
    const row =
      rowsByCourseId.get(issue.courseId) ??
      rowsByCourseId.get(normalizeLookupKey(issue.courseId))

    return {
      courseId: issue.courseId,
      courseLabel: row
        ? formatCourseLabel({
            catalogCourseId: row.catalogCourseId,
            section: row.section,
            fallbackCourseId: row.courseId,
            course: {
              _id: row.catalogCourseId,
              deptCode: row.department,
              courseNumber: row.courseNumber,
              title: row.courseTitle,
              creditHours: 0,
            },
          })
        : issue.courseId,
      courseTitle: row?.courseTitle ?? issue.courseId,
      instructor: row?.instructorName ?? 'Unassigned',
      room: row?.roomLabel ?? 'Unassigned',
      time: row?.timeLabel ?? 'Unassigned',
      issueType: issueTypeFromReason(issue.reason),
      reason: replaceOpaqueReferences(issue.reason, lookups),
    }
  })
}

export function buildTraceTableRows(
  traces: PlacementTrace[],
  lookups: ReturnType<typeof buildScheduleLookupData>,
) {
  return traces.map((trace) => {
    const { normalized, course } = lookupCourse(
      lookups,
      trace.courseId,
      trace.courseId === trace.catalogCourseId ? null : undefined,
    )
    const normalizedCatalog = normalizeCourseReference(trace.catalogCourseId)
    const catalogCourse =
      lookupCourse(lookups, trace.catalogCourseId, normalizedCatalog.section)
        .course ?? course
    const professor = lookupProfessor(lookups, trace.professorId)
    const chosenRoom = trace.chosen?.roomId
      ? lookupRoom(lookups, trace.chosen.roomId)
      : undefined

    const candidateRoomLabels = trace.candidateRooms.map((candidateRoomId) =>
      roomLabel(lookupRoom(lookups, candidateRoomId), candidateRoomId),
    )
    const candidateSlotLabels = trace.candidateSlots.map(
      (slot) => `${slot.days} ${slot.startTime}-${slot.endTime}`,
    )
    const compactReasons = trace.reasons
      .map((reason) => compactTraceReason(reason, lookups))
      .filter(Boolean)
    const decisionLog = (trace.decisionLog ?? [])
      .map((entry) => replaceOpaqueReferences(entry, lookups))
      .filter(Boolean)

    return {
      courseId: trace.courseId,
      courseLabel: formatCourseLabel({
        catalogCourseId: normalized.catalogCourseId,
        course,
        section: normalized.section,
        fallbackCourseId: trace.courseId,
      }),
      catalogCourseId: trace.catalogCourseId,
      catalogCourseLabel: formatCourseLabel({
        catalogCourseId: normalizedCatalog.catalogCourseId,
        course: catalogCourse,
        section: normalizedCatalog.section,
        fallbackCourseId: trace.catalogCourseId,
      }),
      courseTitle:
        course?.title ?? catalogCourse?.title ?? normalized.catalogCourseId,
      professorId: trace.professorId,
      professorName: professor?.displayName ?? trace.professorId,
      status: trace.status,
      outcomeLabel: `${trace.status === 'assigned' ? 'Assigned' : 'Conflict'} / ${trace.stage
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase())}`,
      stageLabel: trace.stage
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase()),
      candidateCount: trace.candidateCount,
      selectedTier: trace.selectedTier ?? 'Not recorded',
      chosenPlacement: trace.chosen
        ? `${trace.chosen.days} ${trace.chosen.startTime}-${trace.chosen.endTime} @ ${roomLabel(chosenRoom, trace.chosen.roomId)}`
        : 'None',
      candidateRoomsLabel: candidateRoomLabels.join(', ') || 'None',
      candidateSlotsLabel: candidateSlotLabels.join(', ') || 'None',
      candidateSummary:
        trace.candidateCount > 0
          ? `${trace.candidateCount} pairings from ${candidateRoomLabels.length} room(s) and ${candidateSlotLabels.length} slot(s)`
          : `${candidateRoomLabels.length} room(s), ${candidateSlotLabels.length} slot(s), no surviving pairings`,
      candidatePreview: `Rooms: ${summarizeList(candidateRoomLabels)} | Slots: ${summarizeList(candidateSlotLabels)}`,
      reasonsLabel: compactReasons.join('; ') || 'None',
      notesSummary: summarizeList(compactReasons, 1),
      decisionLog,
      decisionSummary: summarizeList(decisionLog, 2),
    }
  })
}
