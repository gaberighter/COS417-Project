import type { ICoursePreference, IPreferenceSubmission } from '../models/index'

export const VALID_PREFERENCE_STATUSES: IPreferenceSubmission['status'][] = [
  'not_submitted',
  'submitted',
]

export function normalizePreferenceStatus(
  status: unknown,
): IPreferenceSubmission['status'] {
  return status === 'submitted' || status === 'approved'
    ? 'submitted'
    : 'not_submitted'
}

export function normalizePreferenceSubmissionStatus(
  submission: Pick<IPreferenceSubmission, 'status' | 'submittedAt'>,
): void {
  submission.status = normalizePreferenceStatus(submission.status)
  if (submission.status !== 'submitted') {
    submission.submittedAt = null
  }
}

export const VALID_PREFERENCE_DAYS = [
  'MWF',
  'TR',
  'MW',
  'MTWF',
  'MWRF',
  'M',
  'W',
  'T',
  'R',
] as const

const TIME_PATTERN = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
const TIME_RANGE_PATTERN =
  /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](?:-([0-1]?[0-9]|2[0-3]):[0-5][0-9])?$/
const CRN_PATTERN = /^\d{4,10}$/

export function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

export function validateCoursePreference(
  course: unknown,
  index: number,
): string | null {
  if (typeof course !== 'object' || course === null) {
    return `Course ${index}: must be an object, got ${typeof course}`
  }
  const candidate = course as Record<string, unknown>

  if (!candidate.courseId || typeof candidate.courseId !== 'string') {
    return `Course ${index}: courseId is required and must be a string`
  }
  if (!candidate.title || typeof candidate.title !== 'string') {
    return `Course ${index}: title is required and must be a string`
  }
  if (
    candidate.expectedEnrollment === undefined ||
    typeof candidate.expectedEnrollment !== 'number' ||
    !Number.isFinite(candidate.expectedEnrollment)
  ) {
    return `Course ${index}: expectedEnrollment is required and must be a number`
  }
  if (candidate.expectedEnrollment < 0) {
    return `Course ${index}: expectedEnrollment must be >= 0`
  }
  if (
    typeof candidate.creditHours !== 'number' ||
    !Number.isFinite(candidate.creditHours)
  ) {
    return `Course ${index}: creditHours is required and must be a number`
  }
  if (candidate.creditHours < 0) {
    return `Course ${index}: creditHours must be >= 0`
  }

  for (const optionalStringField of [
    'section',
    'crn',
    'instructor',
    'preferredBuilding',
    'preferredRoomId',
    'backToBackWith',
  ] as const) {
    const value = candidate[optionalStringField]
    if (value !== undefined && value !== null && typeof value !== 'string') {
      return `Course ${index}: ${optionalStringField} must be a string or null`
    }
  }

  if (typeof candidate.crn === 'string' && !CRN_PATTERN.test(candidate.crn)) {
    return `Course ${index}: crn must contain 4 to 10 digits`
  }

  if (candidate.courseFee !== undefined && candidate.courseFee !== null) {
    if (
      typeof candidate.courseFee !== 'number' ||
      !Number.isFinite(candidate.courseFee) ||
      candidate.courseFee < 0
    ) {
      return `Course ${index}: courseFee must be a non-negative number or null`
    }
  }

  if (candidate.preferredDays !== undefined) {
    if (!Array.isArray(candidate.preferredDays)) {
      return `Course ${index}: preferredDays must be an array`
    }
    for (const day of candidate.preferredDays) {
      if (
        typeof day !== 'string' ||
        !VALID_PREFERENCE_DAYS.includes(
          day as (typeof VALID_PREFERENCE_DAYS)[number],
        )
      ) {
        return `Course ${index}: preferredDays must contain only ${VALID_PREFERENCE_DAYS.join(', ')}`
      }
    }
  }

  for (const timeField of ['preferredTimes', 'avoidTimes'] as const) {
    const times = candidate[timeField]
    if (times !== undefined) {
      if (!Array.isArray(times)) {
        return `Course ${index}: ${timeField} must be an array`
      }
      for (let timeIndex = 0; timeIndex < times.length; timeIndex += 1) {
        const timeRange = times[timeIndex]
        if (
          typeof timeRange !== 'string' ||
          !TIME_RANGE_PATTERN.test(timeRange)
        ) {
          return `Course ${index}: ${timeField}[${timeIndex}] must be in HH:MM or HH:MM-HH:MM format`
        }
      }
    }
  }

  if (candidate.maxCapacity !== undefined && candidate.maxCapacity !== null) {
    if (
      typeof candidate.maxCapacity !== 'number' ||
      !Number.isFinite(candidate.maxCapacity) ||
      candidate.maxCapacity < 0
    ) {
      return `Course ${index}: maxCapacity must be a non-negative number or null`
    }
  }

  if (candidate.requiredEquipment !== undefined) {
    if (!Array.isArray(candidate.requiredEquipment)) {
      return `Course ${index}: requiredEquipment must be an array of strings`
    }
    for (
      let equipmentIndex = 0;
      equipmentIndex < candidate.requiredEquipment.length;
      equipmentIndex += 1
    ) {
      if (typeof candidate.requiredEquipment[equipmentIndex] !== 'string') {
        return `Course ${index}: requiredEquipment[${equipmentIndex}] must be a string`
      }
    }
  }

  if (candidate.coreqWith !== undefined) {
    if (!Array.isArray(candidate.coreqWith)) {
      return `Course ${index}: coreqWith must be an array of strings`
    }
    for (
      let coreqIndex = 0;
      coreqIndex < candidate.coreqWith.length;
      coreqIndex += 1
    ) {
      if (typeof candidate.coreqWith[coreqIndex] !== 'string') {
        return `Course ${index}: coreqWith[${coreqIndex}] must be a string`
      }
    }
  }

  return null
}

export function validateCourses(courses: unknown): string | null {
  if (!Array.isArray(courses)) {
    return 'courses must be an array'
  }
  for (let index = 0; index < courses.length; index += 1) {
    const error = validateCoursePreference(courses[index], index)
    if (error) {
      return error
    }
  }
  return null
}

export function normalizeTimeInput(value: string): string {
  if (!TIME_PATTERN.test(value.trim())) {
    return value.trim()
  }

  const [hoursText, minutesText] = value.trim().split(':')
  return `${String(Number(hoursText)).padStart(2, '0')}:${minutesText}`
}

export type CoursePreferenceInput = Partial<ICoursePreference>
