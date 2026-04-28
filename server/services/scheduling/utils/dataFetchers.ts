import {
  CourseCatalog,
  Professor as ProfessorModel,
  Room as RoomModel,
  Schedule,
  type IAssignment,
  type ICourse,
  type IPreferenceSubmission,
  type IProfessor,
  type IRoom,
} from '../../../models/index'
import { connectDB } from '../../../utils/db'
import type {
  Course,
  DayPattern,
  HistoricalAssignment,
  PreferenceRecord,
  PreferenceSubmission,
  Professor,
  Room,
} from '../types'

function normalizeDayPattern(value: string): DayPattern {
  if (value === 'MWF' || value === 'TR' || value === 'MW' || value === 'MTWF') {
    return value
  }

  return 'MWF'
}

function deriveBuildingCode(abbreviation: string | null | undefined, buildingName: string | null | undefined): string {
  if (abbreviation !== null && abbreviation !== undefined) {
    const trimmedAbbreviation = abbreviation.trim()
    if (trimmedAbbreviation.length > 0) {
      return (trimmedAbbreviation.split(/\s+/)[0] ?? 'UNKNOWN').toUpperCase()
    }
  }

  if (buildingName !== null && buildingName !== undefined) {
    const initials = buildingName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0] ?? '')
      .join('')

    if (initials.length > 0) {
      return initials.toUpperCase()
    }
  }

  return 'UNKNOWN'
}

function cloneRoom(room: IRoom): Room {
  return {
    _id: String(room._id ?? room.abbreviation ?? ''),
    buildingCode: deriveBuildingCode(room.abbreviation, room.buildingName),
    roomNumber: room.roomNumber,
    displayName: room.displayName ?? null,
    capacity: room.capacity,
    roomType: room.roomType,
    available: room.available,
    equipment: { ...room.equipment },
  }
}

function cloneCourse(course: ICourse): Course {
  return {
    _id: String(course._id ?? ''),
    deptCode: course.deptCode,
    courseNumber: course.courseNumber,
    title: course.title,
    creditHours: course.creditHours,
    typicalEnrollment: course.typicalEnrollment ?? null,
    labComponent: course.labComponent,
    active: course.active,
    typicalProfessor: course.typicalProfessor ?? null,
    typicalDays: course.typicalDays ? normalizeDayPattern(course.typicalDays) : null,
    typicalTime: course.typicalTime ?? null,
    requiredEquipment: [...course.requiredEquipment],
    prerequisites: [...course.prerequisites],
    corequisites: [...course.corequisites],
  }
}

function clonePreferenceSubmission(submission: IPreferenceSubmission): PreferenceSubmission {
  return {
    term: submission.term,
    department: submission.department,
    submittedBy: submission.submittedBy,
    submittedAt: submission.submittedAt ? new Date(submission.submittedAt) : null,
    status: submission.status,
    courses: submission.courses.map((course) => ({
      courseId: course.courseId,
      title: course.title,
      expectedEnrollment: course.expectedEnrollment,
      maxCapacity: course.maxCapacity ?? null,
      creditHours: course.creditHours,
      preferredDays: [...(course.preferredDays ?? [])].map((days) => normalizeDayPattern(days)),
      preferredTimes: [...(course.preferredTimes ?? [])],
      avoidTimes: [...(course.avoidTimes ?? [])],
      requiredEquipment: [...(course.requiredEquipment ?? [])],
      preferredBuilding: course.preferredBuilding ?? null,
      preferredRoomId: course.preferredRoomId ?? null,
      backToBackWith: course.backToBackWith ?? null,
      coreqWith: [...(course.coreqWith ?? [])],
    })),
  }
}

function cloneProfessor(professor: IProfessor): Professor {
  return {
    _id: String(professor._id ?? professor.covenantId),
    covenantId: professor.covenantId,
    displayName: professor.displayName,
    departmentCode: professor.departmentCode,
    officeBuilding: professor.officeBuilding ?? null,
    officeRoom: professor.officeRoom ?? null,
    seniorityYear: professor.seniorityYear ?? null,
    active: professor.active,
    preferences: professor.preferences.map(clonePreferenceSubmission),
  }
}

/**
 * Loads the current room inventory from the in-memory database or connected MongoDB model.
 *
 * @returns A cloned list of rooms so callers can safely transform the data.
 */
export async function fetchRooms(): Promise<Room[]> {
  await connectDB()
  const rooms = await RoomModel.find({ available: true }).lean<IRoom[]>().exec()
  return rooms.map((room) => cloneRoom(room))
}

/**
 * Loads the active course catalog from the in-memory database or connected MongoDB model.
 *
 * @returns A cloned list of active courses.
 */
export async function fetchCourses(): Promise<Course[]> {
  await connectDB()
  const courses = await CourseCatalog.find({ active: true }).lean<ICourse[]>().exec()
  return courses.map((course) => cloneCourse(course))
}

/**
 * Loads the active professor directory, including embedded preference submissions.
 *
 * @returns A cloned list of active professors.
 */
export async function fetchProfessors(): Promise<Professor[]> {
  await connectDB()
  const professors = await ProfessorModel.find({ active: true }).lean<IProfessor[]>().exec()
  return professors.map((professor) => cloneProfessor(professor))
}

/**
 * Loads preference submissions for a term and flattens them into course-level records.
 *
 * @param term - Academic term identifier.
 * @returns Flattened preference records for the requested term.
 */
export async function fetchPreferences(term: string): Promise<PreferenceRecord[]> {
  await connectDB()

  const professors = await ProfessorModel.find({ active: true }).lean<IProfessor[]>().exec()

  return professors
    .filter((professor) => professor.active)
    .flatMap((professor) =>
      professor.preferences
        .filter((submission) => submission.term === term)
        .flatMap((submission) =>
          submission.courses.map((course) => ({
            courseId: course.courseId,
            title: course.title,
            expectedEnrollment: course.expectedEnrollment,
            maxCapacity: course.maxCapacity ?? null,
            creditHours: course.creditHours,
            preferredDays: [...(course.preferredDays ?? [])].map((days) => normalizeDayPattern(days)),
            preferredTimes: [...(course.preferredTimes ?? [])],
            avoidTimes: [...(course.avoidTimes ?? [])],
            requiredEquipment: [...(course.requiredEquipment ?? [])],
            preferredBuilding: course.preferredBuilding ?? null,
            preferredRoomId: course.preferredRoomId ?? null,
            backToBackWith: course.backToBackWith ?? null,
            coreqWith: [...(course.coreqWith ?? [])],
            professorId: professor._id ?? professor.covenantId,
            professorName: professor.displayName,
            departmentCode: professor.departmentCode,
            submittedAt: submission.submittedAt ? new Date(submission.submittedAt) : null,
            status: submission.status,
            term: submission.term,
          })),
        ),
    )
}

/**
 * Loads preference submissions for all terms except the provided term.
 *
 * @param term - Academic term identifier to exclude.
 * @returns Flattened preference records for prior terms.
 */
export async function fetchHistoricalPreferences(term: string): Promise<PreferenceRecord[]> {
  await connectDB()

  const professors = await ProfessorModel.find({ active: true }).lean<IProfessor[]>().exec()

  return professors
    .filter((professor) => professor.active)
    .flatMap((professor) =>
      professor.preferences
        .filter((submission) => submission.term !== term)
        .flatMap((submission) =>
          submission.courses.map((course) => ({
            courseId: course.courseId,
            title: course.title,
            expectedEnrollment: course.expectedEnrollment,
            maxCapacity: course.maxCapacity ?? null,
            creditHours: course.creditHours,
            preferredDays: [...(course.preferredDays ?? [])].map((days) => normalizeDayPattern(days)),
            preferredTimes: [...(course.preferredTimes ?? [])],
            avoidTimes: [...(course.avoidTimes ?? [])],
            requiredEquipment: [...(course.requiredEquipment ?? [])],
            preferredBuilding: course.preferredBuilding ?? null,
            preferredRoomId: course.preferredRoomId ?? null,
            backToBackWith: course.backToBackWith ?? null,
            coreqWith: [...(course.coreqWith ?? [])],
            professorId: professor._id ?? professor.covenantId,
            professorName: professor.displayName,
            departmentCode: professor.departmentCode,
            submittedAt: submission.submittedAt ? new Date(submission.submittedAt) : null,
            status: submission.status,
            term: submission.term,
          })),
        ),
    )
}

/**
 * Loads recent historical assignments for the provided courses across prior terms.
 *
 * @param courseIds - Course IDs to include in the historical query.
 * @param termToExclude - Current term, excluded from history.
 * @param maxRuns - Maximum number of prior schedule runs to scan.
 * @returns A map keyed by course ID with newest-first historical assignments.
 */
export async function fetchHistoricalAssignments(
  courseIds: string[],
  termToExclude: string,
  maxRuns = 24,
): Promise<Map<string, HistoricalAssignment[]>> {
  await connectDB()

  const targetCourseIds = new Set(courseIds)
  const [rooms, schedules] = await Promise.all([
    RoomModel.find({}).lean<IRoom[]>().exec(),
    Schedule.find({ term: { $ne: termToExclude } })
      .sort({ updatedAt: -1, runNumber: -1 })
      .limit(maxRuns)
      .lean<Array<{ term: string; runNumber: number; assignments: IAssignment[] }>>()
      .exec(),
  ])

  const roomBuildingById = new Map<string, string | null>(
    rooms.map((room) => [String(room._id ?? room.abbreviation ?? ''), deriveBuildingCode(room.abbreviation, room.buildingName)]),
  )

  const recentSchedules = schedules

  const historyByCourse = new Map<string, HistoricalAssignment[]>()
  const seenAssignments = new Set<string>()

  for (const schedule of recentSchedules) {
    for (const assignment of schedule.assignments ?? []) {
      if (!targetCourseIds.has(assignment.courseId)) {
        continue
      }

      const dedupeKey = [
        schedule.term,
        schedule.runNumber,
        assignment.courseId,
        assignment.professorId,
        assignment.roomId,
        assignment.days,
        assignment.startTime,
        assignment.endTime,
      ].join('|')

      if (seenAssignments.has(dedupeKey)) {
        continue
      }

      seenAssignments.add(dedupeKey)

      const existing = historyByCourse.get(assignment.courseId) ?? []
      existing.push({
        term: schedule.term,
        runNumber: schedule.runNumber,
        courseId: assignment.courseId,
        professorId: assignment.professorId,
        roomId: assignment.roomId,
        days: normalizeDayPattern(assignment.days),
        startTime: assignment.startTime,
        endTime: assignment.endTime,
        buildingCode: roomBuildingById.get(assignment.roomId) ?? null,
      })
      historyByCourse.set(assignment.courseId, existing)
    }
  }

  return historyByCourse
}
