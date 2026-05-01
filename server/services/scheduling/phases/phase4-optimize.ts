import type {
  CandidateSlot,
  CourseWorkItem,
  Professor,
  TimeSlot,
} from '../types'
import { scoreAndRank } from '../utils/scoring'

/**
 * Chooses the highest-ranked placement from the surviving hard-constraint candidates.
 *
 * @param candidates - Candidate room and slot combinations.
 * @param workItem - Course and preference context used for ranking.
 * @param professor - Professor assigned to the course.
 * @returns The best candidate, or null when no candidates exist.
 */
export function optimizeCandidatePlacement(
  candidates: Array<{
    room: CandidateSlot['room']
    slot: TimeSlot
    avoidsBackToBackSameCourse?: boolean
  }>,
  workItem: CourseWorkItem,
  professor: Professor,
): {
  room: CandidateSlot['room']
  slot: TimeSlot
  score: number
  decisionLog: string[]
} | null {
  return scoreAndRank(candidates, workItem, professor)
}
