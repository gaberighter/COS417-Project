import type { CollectedInputs, CoursePreference, CourseWorkItem, Professor, PreferenceRecord } from '../types'
import { SchedulingInputError } from '../types'
import { fetchCourses, fetchPreferences, fetchProfessors, fetchRooms } from '../utils/dataFetchers'

function findProfessorForId(professors: Professor[], identifier: string | null): Professor | null {
  if (identifier === null) {
    return null
  }

  return (
    professors.find((professor) => professor._id === identifier || professor.covenantId === identifier) ??
    null
  )
}

function resolveProfessor(
  course: { deptCode: string; typicalProfessor: string | null },
  preference: PreferenceRecord | null,
  professors: Professor[],
): Professor {
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

  return professors[0]
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
  const [rooms, courses, professors, preferences] = await Promise.all([
    fetchRooms(),
    fetchCourses(),
    fetchProfessors(),
    fetchPreferences(term),
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

  const preferenceLookup = buildPreferenceLookup(preferences)

  const workItems = courses.map((course) => {
    const preference = preferenceLookup.get(course._id) ?? null
    const professor = resolveProfessor(course, preference, professors)

    return buildWorkItem(course, professor, preference, warnings)
  })

  return {
    rooms,
    courses,
    professors,
    workItems,
    warnings,
  }
}
