import type {
  CollectedInputs,
  CoursePreference,
  CourseWorkItem,
  HistoricalAssignment,
  PlacementProfile,
  Professor,
  PreferenceRecord,
  Room,
  ScheduleConflict,
} from '../types'
import { SchedulingInputError } from '../types'
import { schedulingConfig } from '../config'
import { buildScheduledCourseId } from '../../../utils/courseReferences'
import {
  fetchCourses,
  fetchHistoricalAssignments,
  fetchHistoricalPreferences,
  fetchPreferences,
  fetchProfessors,
  fetchRooms,
} from '../utils/dataFetchers'
import {
  areDepartmentsSimilar,
  buildPlacementProfile,
  isSimilarCourse,
} from '../utils/history'
import { computeEndTime, isBackToBack } from '../utils/timeSlots'

const NULL_PROFESSOR_ID = 'null-professor'

function makeNullProfessor(departmentCode: string): Professor {
  return {
    _id: NULL_PROFESSOR_ID,
    covenantId: NULL_PROFESSOR_ID,
    displayName: 'Unassigned Professor',
    departmentCode,
    officeBuilding: null,
    officeRoom: null,
    seniorityYear: null,
    active: true,
    preferences: [],
  }
}

function findProfessorForId(
  professors: Professor[],
  identifier: string | null,
): Professor | null {
  if (identifier === null) {
    return null
  }

  return (
    professors.find(
      (professor) =>
        professor._id === identifier ||
        professor.covenantId === identifier ||
        professor.displayName === identifier,
    ) ?? null
  )
}

function resolveProfessor(
  course: { deptCode: string; typicalProfessor: string | null },
  preference: PreferenceRecord | null,
  professors: Professor[],
): Professor {
  if (professors.length === 0) {
    throw new SchedulingInputError(['No active professors available'])
  }

  const preferredProfessor = findProfessorForId(
    professors,
    preference?.professorId ?? null,
  )
  if (preferredProfessor !== null) {
    return preferredProfessor
  }

  const typicalProfessor = findProfessorForId(
    professors,
    course.typicalProfessor,
  )
  if (typicalProfessor !== null) {
    return typicalProfessor
  }

  return makeNullProfessor(course.deptCode)
}

function buildPreferenceLookup(
  preferences: PreferenceRecord[],
): Map<string, PreferenceRecord> {
  const lookup = new Map<string, PreferenceRecord>()

  for (const record of preferences) {
    const current = lookup.get(record.scheduledCourseId)
    if (current === undefined) {
      lookup.set(record.scheduledCourseId, record)
      continue
    }

    const currentPriority =
      current.status === 'approved'
        ? 3
        : current.status === 'submitted'
          ? 2
          : current.status === 'draft'
            ? 1
            : 0
    const nextPriority =
      record.status === 'approved'
        ? 3
        : record.status === 'submitted'
          ? 2
          : record.status === 'draft'
            ? 1
            : 0

    if (nextPriority > currentPriority) {
      lookup.set(record.scheduledCourseId, record)
      continue
    }

    if (nextPriority === currentPriority) {
      const currentSubmittedAt = current.submittedAt?.getTime() ?? 0
      const nextSubmittedAt = record.submittedAt?.getTime() ?? 0
      if (nextSubmittedAt > currentSubmittedAt) {
        lookup.set(record.scheduledCourseId, record)
      }
    }
  }

  return lookup
}

function normalizeCoursePreferences(
  course: CoursePreference | null,
): CoursePreference {
  return {
    courseId: course?.courseId ?? '',
    section: course?.section ?? null,
    title: course?.title ?? '',
    expectedEnrollment: course?.expectedEnrollment ?? null,
    maxCapacity: course?.maxCapacity ?? null,
    creditHours: course?.creditHours ?? 3,
    preferredDays: course?.preferredDays ?? [],
    preferredTimes: course?.preferredTimes ?? [],
    avoidTimes: course?.avoidTimes ?? [],
    requiredEquipment: course?.requiredEquipment ?? [],
    preferredBuilding: course?.preferredBuilding ?? null,
    preferredRoomId: course?.preferredRoomId ?? null,
    backToBackWith: course?.backToBackWith ?? null,
    coreqWith: course?.coreqWith ?? [],
  }
}

function buildWorkItem(
  course: Awaited<ReturnType<typeof fetchCourses>>[number],
  professor: Professor,
  preference: PreferenceRecord | null,
  historicalAssignments: HistoricalAssignment[],
  professorHistory: HistoricalAssignment[],
  similarProfessorHistory: HistoricalAssignment[],
  similarCourseHistory: HistoricalAssignment[],
  departmentHistory: HistoricalAssignment[],
  similarDepartmentHistory: HistoricalAssignment[],
  historicalPreferences: PreferenceRecord[],
  placementProfile: PlacementProfile,
  departmentTypicalRoomIds: string[],
  warnings: string[],
): CourseWorkItem {
  const preferenceCourses = preference ?? null
  const effectivePreference = preferenceCourses
    ? normalizeCoursePreferences(preferenceCourses)
    : null
  const hasSubmittedRoomBuildingPreference =
    (preferenceCourses?.preferredRoomId ?? null) !== null ||
    (preferenceCourses?.preferredBuilding ?? null) !== null
  const hasDirectRoomHistory =
    historicalAssignments.length > 0 || professorHistory.length > 0

  const expectedEnrollment =
    effectivePreference?.expectedEnrollment ?? course.typicalEnrollment ?? null

  if (expectedEnrollment === null) {
    warnings.push(
      `Enrollment unknown for ${course.deptCode} ${course.courseNumber}; capacity constraint skipped`,
    )
  }

  return {
    scheduledCourseId: preferenceCourses?.scheduledCourseId ?? course._id,
    catalogCourseId: preferenceCourses?.catalogCourseId ?? course._id,
    section: preferenceCourses?.section ?? null,
    course,
    professor,
    preference: preferenceCourses,
    historicalAssignments,
    professorHistory,
    similarProfessorHistory,
    similarCourseHistory,
    departmentHistory,
    similarDepartmentHistory,
    historicalPreferences,
    placementProfile,
    hasSubmittedRoomBuildingPreference,
    hasDirectRoomHistory,
    departmentTypicalRoomIds,
    expectedEnrollment,
    preferredDays:
      effectivePreference?.preferredDays != null &&
      effectivePreference.preferredDays.length > 0
        ? effectivePreference.preferredDays
        : course.typicalDays !== null
          ? [course.typicalDays]
          : [],
    preferredTimes:
      effectivePreference?.preferredTimes ??
      (course.typicalTime !== null ? [course.typicalTime] : []),
    avoidTimes: effectivePreference?.avoidTimes ?? [],
    requiredEquipment: effectivePreference?.requiredEquipment ?? [
      ...course.requiredEquipment,
    ],
    preferredBuilding: effectivePreference?.preferredBuilding ?? null,
    preferredRoomId: effectivePreference?.preferredRoomId ?? null,
    backToBackWith: effectivePreference?.backToBackWith ?? null,
    preferredBackToBackWith: [],
    coreqWith: effectivePreference?.coreqWith ?? [...course.corequisites],
  }
}

function derivePreferredBackToBackPairs(workItems: CourseWorkItem[]): void {
  const byProfessor = new Map<string, CourseWorkItem[]>()

  for (const workItem of workItems) {
    const list = byProfessor.get(workItem.professor._id) ?? []
    list.push(workItem)
    byProfessor.set(workItem.professor._id, list)
  }

  for (const professorItems of byProfessor.values()) {
    for (let index = 0; index < professorItems.length; index += 1) {
      const left = professorItems[index]
      if (left === undefined) continue

      for (
        let compareIndex = index + 1;
        compareIndex < professorItems.length;
        compareIndex += 1
      ) {
        const right = professorItems[compareIndex]
        if (right === undefined) continue

        if (
          left.preferredRoomId === null ||
          left.preferredRoomId !== right.preferredRoomId ||
          left.preferredDays.length !== 1 ||
          right.preferredDays.length !== 1 ||
          left.preferredTimes.length !== 1 ||
          right.preferredTimes.length !== 1
        ) {
          continue
        }

        const [leftDays] = left.preferredDays
        const [rightDays] = right.preferredDays
        const [leftStart] = left.preferredTimes
        const [rightStart] = right.preferredTimes
        if (
          leftDays === undefined ||
          rightDays === undefined ||
          leftStart === undefined ||
          rightStart === undefined ||
          leftDays !== rightDays
        ) {
          continue
        }

        const leftSlot = {
          days: leftDays,
          startTime: leftStart,
          endTime: computeEndTime(leftStart, leftDays, left.course.creditHours),
        }
        const rightSlot = {
          days: rightDays,
          startTime: rightStart,
          endTime: computeEndTime(
            rightStart,
            rightDays,
            right.course.creditHours,
          ),
        }

        if (
          !isBackToBack(leftSlot, rightSlot) &&
          !isBackToBack(rightSlot, leftSlot)
        ) {
          continue
        }

        if (!left.preferredBackToBackWith.includes(right.scheduledCourseId)) {
          left.preferredBackToBackWith.push(right.scheduledCourseId)
        }
        if (!right.preferredBackToBackWith.includes(left.scheduledCourseId)) {
          right.preferredBackToBackWith.push(left.scheduledCourseId)
        }
      }
    }
  }
}

function createCollectionConflict(
  courseId: string,
  reason: string,
): ScheduleConflict {
  return {
    courseId,
    reason,
  }
}

function resolveDepartmentTypicalRoomIds(
  departmentCode: string,
  rooms: Room[],
  warnings: string[],
): string[] {
  const configuredRooms =
    schedulingConfig.departmentTypicalRooms[departmentCode] ?? []
  if (configuredRooms.length === 0) {
    return []
  }

  const roomsByNormalizedLabel = new Map<string, Room>()
  for (const room of rooms) {
    const labels = new Set(
      [room._id, room.displayName, room.abbreviation]
        .map((value) =>
          String(value ?? '')
            .trim()
            .toUpperCase(),
        )
        .filter((value) => value.length > 0),
    )

    for (const label of labels) {
      if (!roomsByNormalizedLabel.has(label)) {
        roomsByNormalizedLabel.set(label, room)
      }
    }
  }

  const resolved: string[] = []
  for (const configuredRoom of configuredRooms) {
    const normalizedConfiguredRoom = configuredRoom.trim().toUpperCase()
    if (normalizedConfiguredRoom.length === 0) {
      continue
    }

    const matchedRoom = roomsByNormalizedLabel.get(normalizedConfiguredRoom)
    if (matchedRoom === undefined) {
      warnings.push(
        `Department typical room "${configuredRoom}" for ${departmentCode} does not match any active room`,
      )
      continue
    }

    resolved.push(matchedRoom._id)
  }

  return [...new Set(resolved)]
}

/**
 * Fetches and validates all data needed for a scheduling run.
 *
 * @param term - Academic term to prepare.
 * @returns The filtered inventory, active catalog data, and work items to schedule.
 * @throws SchedulingInputError when the run cannot begin safely.
 */
export async function collectInputs(term: string): Promise<CollectedInputs> {
  const [rooms, courses, professors, preferences, historicalPreferences] =
    await Promise.all([
      fetchRooms(),
      fetchCourses(),
      fetchProfessors(),
      fetchPreferences(term),
      fetchHistoricalPreferences(term),
    ])

  const warnings: string[] = []
  const conflicts: ScheduleConflict[] = []

  if (rooms.length === 0) {
    throw new SchedulingInputError(['No active rooms available'])
  }

  if (courses.length === 0) {
    throw new SchedulingInputError([
      `No active courses available for term ${term}`,
    ])
  }

  if (professors.length === 0) {
    throw new SchedulingInputError([
      `No active professors available for term ${term}`,
    ])
  }

  const normalizedAvailableRoomNames = new Set(
    rooms
      .map((room) => room.displayName?.trim().toLowerCase() ?? null)
      .filter((value): value is string => value !== null && value.length > 0),
  )

  for (const configuredName of schedulingConfig.guardedRoomDisplayNamesRequiringRealData ??
    []) {
    const normalizedConfiguredName = configuredName.trim().toLowerCase()
    if (normalizedConfiguredName.length === 0) {
      continue
    }

    if (!normalizedAvailableRoomNames.has(normalizedConfiguredName)) {
      warnings.push(
        `Guarded room "${configuredName}" does not match any active room displayName`,
      )
    }
  }

  const preferenceLookup = buildPreferenceLookup(preferences)
  const submittedCourseIds = [...preferenceLookup.keys()]
  const submittedPreferences = [...preferenceLookup.values()]
  if (submittedCourseIds.length === 0) {
    throw new SchedulingInputError([
      `No course preferences submitted for term ${term}`,
    ])
  }

  const missingScheduledCourseIds = submittedPreferences.filter(
    (preference) =>
      !courses.some((course) => course._id === preference.catalogCourseId),
  )

  if (missingScheduledCourseIds.length > 0) {
    for (const preference of missingScheduledCourseIds) {
      conflicts.push(
        createCollectionConflict(
          preference.scheduledCourseId,
          '[COURSE_MISSING_FROM_CATALOG] Preference submission references a course missing from the active catalog.',
        ),
      )
    }
  }

  const historyByCourse = await fetchHistoricalAssignments(
    courses.map((course) => course._id),
    term,
    schedulingConfig.maxHistoryRuns,
  )

  const roomsById = new Map<string, Room>(rooms.map((room) => [room._id, room]))

  const historyByProfessor = new Map<string, HistoricalAssignment[]>()
  const historyByDepartment = new Map<string, HistoricalAssignment[]>()

  for (const [courseId, assignments] of historyByCourse.entries()) {
    const course = courses.find((entry) => entry._id === courseId)
    const departmentCode = course?.deptCode ?? null

    for (const assignment of assignments) {
      const professorList = historyByProfessor.get(assignment.professorId) ?? []
      professorList.push(assignment)
      historyByProfessor.set(assignment.professorId, professorList)

      if (departmentCode !== null) {
        const deptList = historyByDepartment.get(departmentCode) ?? []
        deptList.push(assignment)
        historyByDepartment.set(departmentCode, deptList)
      }
    }
  }

  const historicalPreferencesByCourse = new Map<string, PreferenceRecord[]>()
  for (const record of historicalPreferences) {
    const list = historicalPreferencesByCourse.get(record.catalogCourseId) ?? []
    list.push(record)
    historicalPreferencesByCourse.set(record.catalogCourseId, list)
  }

  const scheduledCourses = submittedPreferences
    .map((preference) => ({
      preference,
      course:
        courses.find((course) => course._id === preference.catalogCourseId) ??
        null,
    }))
    .filter(
      (
        entry,
      ): entry is {
        preference: PreferenceRecord
        course: NonNullable<(typeof courses)[number]>
      } => entry.course !== null,
    )

  if (scheduledCourses.length === 0) {
    throw new SchedulingInputError([
      `No submitted courses for term ${term} could be matched to the active catalog`,
    ])
  }

  const workItems: CourseWorkItem[] = []
  for (const scheduledCourse of scheduledCourses) {
    try {
      const { course, preference } = scheduledCourse
      const professor = resolveProfessor(course, preference, professors)
      const historicalAssignments = historyByCourse.get(course._id) ?? []

      const professorHistory = historyByProfessor.get(professor._id) ?? []

      const similarProfessorHistory: HistoricalAssignment[] = []
      for (const peer of professors) {
        if (peer._id === professor._id) {
          continue
        }

        if (
          areDepartmentsSimilar(peer.departmentCode, professor.departmentCode)
        ) {
          const peerHistory = historyByProfessor.get(peer._id) ?? []
          similarProfessorHistory.push(...peerHistory)
        }
      }

      const baseEnrollment =
        preference?.expectedEnrollment ?? course.typicalEnrollment ?? null
      const similarCourses = courses.filter(
        (candidate) =>
          candidate._id !== course._id &&
          isSimilarCourse(course, baseEnrollment, candidate),
      )
      const similarCourseHistory = similarCourses.flatMap(
        (candidate) => historyByCourse.get(candidate._id) ?? [],
      )

      const departmentHistory = historyByDepartment.get(course.deptCode) ?? []
      const similarDepartmentHistory: HistoricalAssignment[] = []
      for (const [deptCode, deptAssignments] of historyByDepartment.entries()) {
        if (deptCode === course.deptCode) {
          continue
        }

        if (areDepartmentsSimilar(deptCode, course.deptCode)) {
          similarDepartmentHistory.push(...deptAssignments)
        }
      }

      const historicalPreferenceRecords =
        historicalPreferencesByCourse.get(course._id) ?? []
      const departmentTypicalRoomIds = resolveDepartmentTypicalRoomIds(
        course.deptCode,
        rooms,
        warnings,
      )

      const profileAssignments = [
        ...historicalAssignments,
        ...similarCourseHistory,
      ].slice(0, schedulingConfig.maxHistoryForProfile)
      const placementProfile = buildPlacementProfile(
        profileAssignments,
        roomsById,
      )

      workItems.push(
        buildWorkItem(
          course,
          professor,
          preference,
          historicalAssignments.slice(0, schedulingConfig.maxHistoryPerCourse),
          professorHistory,
          similarProfessorHistory,
          similarCourseHistory,
          departmentHistory,
          similarDepartmentHistory,
          historicalPreferenceRecords,
          placementProfile,
          departmentTypicalRoomIds,
          warnings,
        ),
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown scheduling error'
      conflicts.push(
        createCollectionConflict(
          buildScheduledCourseId(
            scheduledCourse.course._id,
            scheduledCourse.preference.section,
          ),
          `[COLLECTION_FAILED] Unable to prepare this course for scheduling. ${message}`,
        ),
      )
    }
  }

  if (workItems.length === 0) {
    throw new SchedulingInputError([
      `No submitted courses for term ${term} could be prepared for scheduling`,
    ])
  }

  derivePreferredBackToBackPairs(workItems)

  return {
    rooms,
    courses,
    professors,
    workItems,
    conflicts,
    warnings,
  }
}
