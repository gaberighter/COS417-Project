import type {
  CandidateSlot,
  CourseWorkItem,
  NearHardFlag,
  ScheduleAssignment,
} from '../types'
import {
  normalizeCourseReference,
  scheduledCourseIdsShareCatalog,
} from '../../../utils/courseReferences'
import { isBackToBack, slotsOverlap } from '../utils/timeSlots'
import { isPlacementAbnormal } from '../utils/history'

function makeFlag(courseId: string, reason: string): NearHardFlag {
  return {
    courseId,
    reason,
  }
}

/**
 * Collects non-blocking constraint flags for a candidate placement.
 *
 * @param workItem - Course and preference context.
 * @param candidate - Selected room and slot.
 * @param currentAssignments - Already accepted assignments for this scheduling run.
 * @returns Near-hard flags that should surface the run as under review.
 */
export function collectNearHardFlags(
  workItem: CourseWorkItem,
  candidate: CandidateSlot,
  currentAssignments: ScheduleAssignment[],
): NearHardFlag[] {
  const flags: NearHardFlag[] = []
  const courseId = workItem.scheduledCourseId
  const professorId = workItem.professor._id

  const abnormalCheck = isPlacementAbnormal(
    candidate.room,
    workItem.placementProfile,
  )
  if (abnormalCheck.abnormal) {
    flags.push(
      makeFlag(
        courseId,
        `Abnormal placement: ${abnormalCheck.reasons.join('; ')}. Manual review recommended.`,
      ),
    )
  }

  for (const assignment of currentAssignments) {
    if (
      scheduledCourseIdsShareCatalog(assignment.courseId, courseId) &&
      assignment.professorId === professorId &&
      isBackToBack(assignment, candidate.slot)
    ) {
      flags.push(
        makeFlag(
          courseId,
          `Back-to-back placement with another section of the same course: ${workItem.course.title}`,
        ),
      )
    }

    const pairedCourseIds = new Set(
      [workItem.backToBackWith, ...workItem.preferredBackToBackWith]
        .filter((value): value is string => value !== null)
        .map((value) => normalizeCourseReference(value).scheduledCourseId),
    )
    if (
      pairedCourseIds.size > 0 &&
      pairedCourseIds.has(assignment.courseId) &&
      !isBackToBack(assignment, candidate.slot) &&
      !isBackToBack(candidate.slot, assignment)
    ) {
      flags.push(
        makeFlag(
          courseId,
          `Preferred back-to-back pairing could not be preserved with course ${assignment.courseId}.`,
        ),
      )
    }

    const corequisiteCourseIds = new Set(
      [...workItem.coreqWith, ...workItem.course.corequisites].map(
        (courseReference) =>
          normalizeCourseReference(courseReference).scheduledCourseId,
      ),
    )
    if (
      corequisiteCourseIds.has(assignment.courseId) &&
      slotsOverlap(assignment, candidate.slot)
    ) {
      flags.push(
        makeFlag(
          courseId,
          `Corequisite overlap with course ${assignment.courseId}`,
        ),
      )
    }
  }

  return flags
}
