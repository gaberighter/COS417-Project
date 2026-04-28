import type {
  CollectedInputs,
  CoursePreference,
  CourseWorkItem,
  HistoricalAssignment,
  PlacementProfile,
  Professor,
  PreferenceRecord,
  Room,
} from '../types'
import { SchedulingInputError } from '../types'
import { schedulingConfig } from '../config'
import {
  fetchCourses,
  fetchHistoricalAssignments,
  fetchHistoricalPreferences,
  fetchPreferences,
  fetchProfessors,
  fetchRooms,
} from '../utils/dataFetchers'
import { areDepartmentsSimilar, buildPlacementProfile, isSimilarCourse } from '../utils/history'

function findProfessorForId(professors: Professor[], identifier: string | null): Professor | null {
  if (identifier === null) {
    return null
  }

  return (
    professors.find(
      (professor) =>
        professor._id === identifier ||
        professor.covenantId === identifier ||
        professor.displayName === identifier,
    ) ??
    null
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

  const preferredProfessor = findProfessorForId(professors, preference?.professorId ?? null)
  if (preferredProfessor !== null) {
    return preferredProfessor
  }

  const typicalProfessor = findProfessorForId(professors, course.typicalProfessor)
  if (typicalProfessor !== null) {
    return typicalProfessor
  }

  const departmentProfessor = professors.find((professor) => professor.departmentCode === course.deptCode)
  if (departmentProfessor !== undefined) {
    return departmentProfessor
  }

  return professors[0]!
}

function buildPreferenceLookup(preferences: PreferenceRecord[]): Map<string, PreferenceRecord> {
  const lookup = new Map<string, PreferenceRecord>()

  for (const record of preferences) {
    const current = lookup.get(record.courseId)
    if (current === undefined) {
      lookup.set(record.courseId, record)
      continue
    }

    const currentPriority = current.status === 'approved' ? 3 : current.status === 'submitted' ? 2 : current.status === 'draft' ? 1 : 0
    const nextPriority = record.status === 'approved' ? 3 : record.status === 'submitted' ? 2 : record.status === 'draft' ? 1 : 0

    if (nextPriority > currentPriority) {
      lookup.set(record.courseId, record)
      continue
    }

    if (nextPriority === currentPriority) {
      const currentSubmittedAt = current.submittedAt?.getTime() ?? 0
      const nextSubmittedAt = record.submittedAt?.getTime() ?? 0
      if (nextSubmittedAt > currentSubmittedAt) {
        lookup.set(record.courseId, record)
      }
    }
  }

  return lookup
}

function normalizeCoursePreferences(course: CoursePreference | null, professor: Professor): CoursePreference {
  return {
    courseId: course?.courseId ?? '',
    title: course?.title ?? '',
    expectedEnrollment: course?.expectedEnrollment ?? null,
    maxCapacity: course?.maxCapacity ?? null,
    creditHours: course?.creditHours ?? 3,
    preferredDays: course?.preferredDays ?? [],
    preferredTimes: course?.preferredTimes ?? [],
    avoidTimes: course?.avoidTimes ?? [],
    requiredEquipment: course?.requiredEquipment ?? [],
    preferredBuilding: course?.preferredBuilding ?? professor.officeBuilding ?? null,
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
  warnings: string[],
): CourseWorkItem {
  const preferenceCourses = preference ?? null
  const effectivePreference = preferenceCourses
    ? normalizeCoursePreferences(preferenceCourses, professor)
    : null

  const expectedEnrollment =
    effectivePreference?.expectedEnrollment ?? course.typicalEnrollment ?? null

  if (expectedEnrollment === null) {
    warnings.push(
      `Enrollment unknown for ${course.deptCode} ${course.courseNumber}; capacity constraint skipped`,
    )
  }

  return {
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
    expectedEnrollment,
    preferredDays: effectivePreference?.preferredDays ?? (course.typicalDays !== null ? [course.typicalDays] : []),
    preferredTimes: effectivePreference?.preferredTimes ?? (course.typicalTime !== null ? [course.typicalTime] : []),
    avoidTimes: effectivePreference?.avoidTimes ?? [],
    requiredEquipment: effectivePreference?.requiredEquipment ?? [...course.requiredEquipment],
    preferredBuilding: effectivePreference?.preferredBuilding ?? null,
    preferredRoomId: effectivePreference?.preferredRoomId ?? null,
    backToBackWith: effectivePreference?.backToBackWith ?? null,
    coreqWith: effectivePreference?.coreqWith ?? [...course.corequisites],
  }
}

/**
 * Fetches and validates all data needed for a scheduling run.
 *
 * @param term - Academic term to prepare.
 * @returns The filtered inventory, active catalog data, and work items to schedule.
 * @throws SchedulingInputError when the run cannot begin safely.
 */
export async function collectInputs(term: string): Promise<CollectedInputs> {
  const [rooms, courses, professors, preferences, historicalPreferences] = await Promise.all([
    fetchRooms(),
    fetchCourses(),
    fetchProfessors(),
    fetchPreferences(term),
    fetchHistoricalPreferences(term),
  ])

  const warnings: string[] = []

  if (rooms.length === 0) {
    throw new SchedulingInputError(['No active rooms available'])
  }

  if (courses.length === 0) {
    throw new SchedulingInputError([`No active courses available for term ${term}`])
  }

  if (professors.length === 0) {
    throw new SchedulingInputError([`No active professors available for term ${term}`])
  }

  const normalizedAvailableRoomNames = new Set(
    rooms
      .map((room) => room.displayName?.trim().toLowerCase() ?? null)
      .filter((value): value is string => value !== null && value.length > 0),
  )

  for (const configuredName of schedulingConfig.guardedRoomDisplayNamesRequiringRealData) {
    const normalizedConfiguredName = configuredName.trim().toLowerCase()
    if (normalizedConfiguredName.length === 0) {
      continue
    }

    if (!normalizedAvailableRoomNames.has(normalizedConfiguredName)) {
      warnings.push(`Guarded room "${configuredName}" does not match any active room displayName`)
    }
  }

  const preferenceLookup = buildPreferenceLookup(preferences)
  const scheduledCourseIds = [...preferenceLookup.keys()]

  if (scheduledCourseIds.length === 0) {
    throw new SchedulingInputError([`No course preferences submitted for term ${term}`])
  }

  const scheduledCourses = scheduledCourseIds
    .map((courseId) => courses.find((course) => course._id === courseId) ?? null)
    .filter((course): course is NonNullable<typeof course> => course !== null)

  const missingScheduledCourseIds = scheduledCourseIds.filter(
    (courseId) => !scheduledCourses.some((course) => course._id === courseId),
  )

  if (missingScheduledCourseIds.length > 0) {
    throw new SchedulingInputError([
      `Preference submissions reference courses missing from the active catalog: ${missingScheduledCourseIds.join(', ')}`,
    ])
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
    const list = historicalPreferencesByCourse.get(record.courseId) ?? []
    list.push(record)
    historicalPreferencesByCourse.set(record.courseId, list)
  }

  const workItems = scheduledCourses.map((course) => {
    const preference = preferenceLookup.get(course._id) ?? null
    const professor = resolveProfessor(course, preference, professors)
    const historicalAssignments = historyByCourse.get(course._id) ?? []

    const professorHistory = historyByProfessor.get(professor._id) ?? []

    const similarProfessorHistory: HistoricalAssignment[] = []
    for (const peer of professors) {
      if (peer._id === professor._id) {
        continue
      }

      if (areDepartmentsSimilar(peer.departmentCode, professor.departmentCode)) {
        const peerHistory = historyByProfessor.get(peer._id) ?? []
        similarProfessorHistory.push(...peerHistory)
      }
    }

    const baseEnrollment = preference?.expectedEnrollment ?? course.typicalEnrollment ?? null
    const similarCourses = courses.filter((candidate) => candidate._id !== course._id && isSimilarCourse(course, baseEnrollment, candidate))
    const similarCourseHistory = similarCourses.flatMap((candidate) => historyByCourse.get(candidate._id) ?? [])

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

    const historicalPreferenceRecords = historicalPreferencesByCourse.get(course._id) ?? []

    const profileAssignments = [...historicalAssignments, ...similarCourseHistory].slice(0, schedulingConfig.maxHistoryForProfile)
    const placementProfile = buildPlacementProfile(profileAssignments, roomsById)

    return buildWorkItem(
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
      warnings,
    )
  })

  return {
    rooms,
    courses,
    professors,
    workItems,
    warnings,
  }
}
