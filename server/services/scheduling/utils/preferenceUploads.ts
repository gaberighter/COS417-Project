import { normalizeCourseReference } from '../../../utils/courseReferences'
import type {
  Course,
  PreferenceRecord,
  PreferenceUploadMongoStub,
  PreferenceUploadPreview,
  Professor,
} from '../types'

function deriveCourseIdentity(record: PreferenceRecord): {
  deptCode: string
  courseNumber: string
  syntheticReference: string
} {
  const normalized = normalizeCourseReference(
    record.catalogCourseId,
    record.section,
  )
  const parts = normalized.catalogCourseId.trim().split(/\s+/, 2)
  const deptCode =
    parts[0]?.trim().toUpperCase() ??
    record.departmentCode.trim().toUpperCase() ??
    'UNKNOWN'
  const courseNumber =
    parts[1]?.trim() ??
    (normalized.rawCourseId.trim() || record.title.trim() || 'NEW')

  return {
    deptCode,
    courseNumber,
    syntheticReference: normalized.catalogCourseId,
  }
}

function synthesizeCourse(record: PreferenceRecord): Course {
  const identity = deriveCourseIdentity(record)
  return {
    _id: identity.syntheticReference || `${identity.deptCode} ${identity.courseNumber}`,
    deptCode: identity.deptCode,
    courseNumber: identity.courseNumber,
    title: record.title,
    creditHours: record.creditHours,
    typicalEnrollment: record.expectedEnrollment,
    requiredEquipment: [...record.requiredEquipment],
    labComponent: false,
    active: true,
    typicalProfessor: null,
    typicalDays: null,
    typicalTime: null,
    prerequisites: [],
    corequisites: [...record.coreqWith],
  }
}

function synthesizeProfessor(record: PreferenceRecord): Professor {
  return {
    _id: record.professorId,
    covenantId: record.professorId,
    displayName: record.professorName,
    departmentCode: record.departmentCode,
    officeBuilding: null,
    officeRoom: null,
    seniorityYear: null,
    active: true,
    preferences: [],
  }
}

function dedupeById<T extends { _id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const unique: T[] = []

  for (const item of items) {
    if (seen.has(item._id)) {
      continue
    }

    seen.add(item._id)
    unique.push(item)
  }

  return unique
}

export function buildPreferenceUploadPreview(
  uploadedPreferences: PreferenceRecord[],
): PreferenceUploadPreview {
  const courses: Course[] = []
  const professors: Professor[] = []
  const warnings: string[] = []
  const courseIds = new Set<string>()
  const professorIds = new Set<string>()

  for (const record of uploadedPreferences) {
    if (!courseIds.has(record.catalogCourseId)) {
      const syntheticCourse = synthesizeCourse(record)
      courses.push(syntheticCourse)
      courseIds.add(syntheticCourse._id)

      if (syntheticCourse._id !== record.catalogCourseId) {
        warnings.push(
          `Synthesized course ${syntheticCourse._id} from uploaded preference ${record.scheduledCourseId}; the upload should later be persisted to Mongo.`,
        )
      }
    }

    if (!professorIds.has(record.professorId)) {
      professors.push(synthesizeProfessor(record))
      professorIds.add(record.professorId)
    }
  }

  return {
    courses: dedupeById(courses),
    professors: dedupeById(professors),
    preferences: [...uploadedPreferences],
    warnings,
  }
}

export function preparePreferenceUploadMongoStub(
  uploadedPreferences: PreferenceRecord[],
): PreferenceUploadMongoStub {
  const preview = buildPreferenceUploadPreview(uploadedPreferences)

  return {
    ok: false,
    message: 'Mongo persistence for preference uploads is not wired yet.',
    preview,
  }
}
