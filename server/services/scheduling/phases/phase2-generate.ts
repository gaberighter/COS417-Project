import type { CourseWorkItem } from '../types'

function difficultyScore(workItem: CourseWorkItem, maxEnrollment: number): number {
  const enrollmentScore =
    workItem.expectedEnrollment === null || maxEnrollment === 0
      ? 0
      : Math.min(20, Math.round((workItem.expectedEnrollment / maxEnrollment) * 20))

  const preferredDayScore = workItem.preferredDays.length === 1 ? 10 : 0
  const preferredTimeScore = workItem.preferredTimes.length === 1 ? 10 : 0
  const corequisiteScore = workItem.coreqWith.length > 0 ? workItem.coreqWith.length * 5 : 0

  return (
    (workItem.course.labComponent ? 30 : 0) +
    workItem.requiredEquipment.length * 10 +
    enrollmentScore +
    (workItem.course.creditHours !== 3 ? 15 : 0) +
    preferredDayScore +
    preferredTimeScore +
    corequisiteScore
  )
}

/**
 * Sorts work items from hardest to easiest so the scheduler places constrained courses first.
 *
 * @param workItems - Unordered work items produced by input collection.
 * @returns A new array ordered by descending difficulty.
 */
export function sortByDifficulty(workItems: CourseWorkItem[]): CourseWorkItem[] {
  const maxEnrollment = workItems.reduce((highest, item) => {
    if (item.expectedEnrollment === null) {
      return highest
    }

    return Math.max(highest, item.expectedEnrollment)
  }, 0)

  return [...workItems].sort((left, right) => {
    const leftScore = difficultyScore(left, maxEnrollment)
    const rightScore = difficultyScore(right, maxEnrollment)

    if (leftScore !== rightScore) {
      return rightScore - leftScore
    }

    if (left.requiredEquipment.length !== right.requiredEquipment.length) {
      return right.requiredEquipment.length - left.requiredEquipment.length
    }

    return `${left.course.deptCode}${left.course.courseNumber}`.localeCompare(
      `${right.course.deptCode}${right.course.courseNumber}`,
    )
  })
}
