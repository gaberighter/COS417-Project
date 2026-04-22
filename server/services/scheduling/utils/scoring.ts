import type { CandidateSlot, CourseWorkItem, Professor, Room, TimeSlot } from '../types'

interface ScoredCandidate {
  score: number
  seniorityBonus: number
}

function parseTime(value: string): number {
  const [hoursText, minutesText] = value.split(':')
  return Number(hoursText) * 60 + Number(minutesText)
}

function computeCapacityScore(room: Room, expectedEnrollment: number | null): number {
  if (expectedEnrollment === null) {
    return 0
  }

  const wastedSeats = Math.max(0, room.capacity - expectedEnrollment)
  if (wastedSeats === 0) {
    return 5
  }

  return Math.max(1, 5 - Math.min(4, Math.floor(wastedSeats / 10)))
}

function computeSeniorityBonus(professor: Professor): number {
  if (professor.seniorityYear === null) {
    return 0
  }

  const decadeSpan = Math.max(0, Math.floor((new Date().getFullYear() - professor.seniorityYear) / 10))
  return decadeSpan
}

function computeBackToBackScore(candidate: CandidateSlot): number {
  return candidate.avoidsBackToBackSameCourse === false ? 0 : 10
}

/**
 * Scores a single room and slot combination for a work item.
 *
 * @param candidate - Room and time slot under consideration.
 * @param workItem - Course and preference context for the candidate.
 * @param professor - Professor assigned to the course.
 * @returns The computed score and seniority tie-break value.
 */
export function scoreCandidateSlot(
  candidate: CandidateSlot,
  workItem: CourseWorkItem,
  professor: Professor,
): ScoredCandidate {
  let score = 0

  if (workItem.preferredDays.includes(candidate.slot.days)) {
    score += 20
  }

  if (workItem.preferredTimes.includes(candidate.slot.startTime)) {
    score += 20
  }

  if (!workItem.avoidTimes.includes(candidate.slot.startTime)) {
    score += 10
  }

  if (workItem.preferredRoomId !== null && candidate.room._id === workItem.preferredRoomId) {
    score += 25
  }

  if (workItem.preferredBuilding !== null && candidate.room.buildingCode === workItem.preferredBuilding) {
    score += 15
  }

  if (professor.officeBuilding !== null && candidate.room.buildingCode === professor.officeBuilding) {
    score += 10
  }

  score += computeCapacityScore(candidate.room, workItem.expectedEnrollment)
  score += computeBackToBackScore(candidate)

  return {
    score,
    seniorityBonus: computeSeniorityBonus(professor),
  }
}

/**
 * Selects the highest scoring room and slot combination for a work item.
 *
 * @param candidates - Candidate room and slot combinations.
 * @param workItem - Course and preference context for ranking.
 * @param professor - Professor assigned to the course.
 * @returns The best candidate, or null when no candidates exist.
 */
export function scoreAndRank(
  candidates: Array<{ room: Room; slot: TimeSlot; avoidsBackToBackSameCourse?: boolean }>,
  workItem: CourseWorkItem,
  professor: Professor,
): { room: Room; slot: TimeSlot } | null {
  if (candidates.length === 0) {
    return null
  }

  let bestCandidate: { room: Room; slot: TimeSlot } | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  let bestSeniority = Number.NEGATIVE_INFINITY

  for (const candidate of candidates) {
    const scored = scoreCandidateSlot(candidate, workItem, professor)
    if (
      scored.score > bestScore ||
      (scored.score === bestScore && scored.seniorityBonus > bestSeniority) ||
      (scored.score === bestScore && scored.seniorityBonus === bestSeniority && bestCandidate !== null && parseTime(candidate.slot.startTime) < parseTime(bestCandidate.slot.startTime))
    ) {
      bestCandidate = {
        room: candidate.room,
        slot: candidate.slot,
      }
      bestScore = scored.score
      bestSeniority = scored.seniorityBonus
    }
  }

  return bestCandidate
}
