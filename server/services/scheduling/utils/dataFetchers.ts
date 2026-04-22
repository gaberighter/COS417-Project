import { db } from '../../../models/index'
import { connectDB } from '../../../utils/db'
import type {
  Course,
  PreferenceRecord,
  PreferenceSubmission,
  Professor,
  Room,
} from '../types'

function cloneRoom(room: Room): Room {
  return {
    ...room,
    equipment: { ...room.equipment },
  }
}

function cloneCourse(course: Course): Course {
  return {
    ...course,
    requiredEquipment: [...course.requiredEquipment],
    prerequisites: [...course.prerequisites],
    corequisites: [...course.corequisites],
  }
}

function clonePreferenceSubmission(submission: PreferenceSubmission): PreferenceSubmission {
  return {
    ...submission,
    submittedAt: submission.submittedAt ? new Date(submission.submittedAt) : null,
    courses: submission.courses.map((course) => ({
      ...course,
      preferredDays: [...course.preferredDays],
      preferredTimes: [...course.preferredTimes],
      avoidTimes: [...course.avoidTimes],
      requiredEquipment: [...course.requiredEquipment],
      coreqWith: [...course.coreqWith],
    })),
  }
}

function cloneProfessor(professor: Professor): Professor {
  return {
    ...professor,
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
  return db.rooms.map((room) => cloneRoom(room as Room))
}

/**
 * Loads the active course catalog from the in-memory database or connected MongoDB model.
 *
 * @returns A cloned list of active courses.
 */
export async function fetchCourses(): Promise<Course[]> {
  await connectDB()
  return db.courses.filter((course) => course.active).map((course) => cloneCourse(course as Course))
}

/**
 * Loads the active professor directory, including embedded preference submissions.
 *
 * @returns A cloned list of active professors.
 */
export async function fetchProfessors(): Promise<Professor[]> {
  await connectDB()
  return db.professors.filter((professor) => professor.active).map((professor) => cloneProfessor(professor as Professor))
}

/**
 * Loads preference submissions for a term and flattens them into course-level records.
 *
 * @param term - Academic term identifier.
 * @returns Flattened preference records for the requested term.
 */
export async function fetchPreferences(term: string): Promise<PreferenceRecord[]> {
  await connectDB()

  return db.professors
    .filter((professor) => professor.active)
    .flatMap((professor) =>
      professor.preferences
        .filter((submission) => submission.term === term)
        .flatMap((submission) =>
          submission.courses.map((course) => ({
            ...course,
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
