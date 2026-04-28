import type { CandidateSlot, CourseWorkItem, Professor } from '../types'

/**
 * Placeholder scorer for soft-constraint analysis outside the primary ranking flow.
 *
 * @param candidate - Candidate room and slot.
 * @param workItem - Course and preference context.
 * @param professor - Assigned professor.
 * @returns A numeric score that mirrors the phase 4 ranking model.
 */
export function scoreSoftConstraints(
  candidate: CandidateSlot,
  workItem: CourseWorkItem,
  professor: Professor,
): number {
  const preferredDaysScore = workItem.preferredDays.includes(
    candidate.slot.days,
  )
    ? 20
    : 0
  const preferredTimesScore = workItem.preferredTimes.includes(
    candidate.slot.startTime,
  )
    ? 20
    : 0
  const avoidTimesScore = workItem.avoidTimes.includes(candidate.slot.startTime)
    ? 0
    : 10
  const preferredRoomScore =
    workItem.preferredRoomId !== null &&
    candidate.room._id === workItem.preferredRoomId
      ? 25
      : 0
  const preferredBuildingScore =
    workItem.preferredBuilding !== null &&
    candidate.room.buildingCode === workItem.preferredBuilding
      ? 15
      : 0
  const officeBuildingScore =
    professor.officeBuilding !== null &&
    candidate.room.buildingCode === professor.officeBuilding
      ? 10
      : 0
  const backToBackScore =
    candidate.avoidsBackToBackSameCourse === false ? 0 : 10

  return (
    preferredDaysScore +
    preferredTimesScore +
    avoidTimesScore +
    preferredRoomScore +
    preferredBuildingScore +
    officeBuildingScore +
    backToBackScore
  )
}
