import type {
  CandidateSlot,
  CourseWorkItem,
  Professor,
  Room,
  TimeSlot,
} from '../types'
import { schedulingConfig } from '../config'
import { isPlacementAbnormal } from './history'

function parseTime(value: string): number {
  const [hoursText, minutesText] = value.split(':')
  return Number(hoursText) * 60 + Number(minutesText)
}

function computeCapacityScore(
  room: Room,
  expectedEnrollment: number | null,
): number {
  if (expectedEnrollment === null) {
    return 0
  }

  const wastedSeats = Math.max(0, room.capacity - expectedEnrollment)
  if (wastedSeats === 0) {
    return schedulingConfig.weights.capacityFit
  }

  const penalty = Math.min(4, Math.floor(wastedSeats / 10))
  return Math.max(1, schedulingConfig.weights.capacityFit - penalty)
}

function computeBackToBackScore(candidate: CandidateSlot): number {
  let score = candidate.avoidsBackToBackSameCourse === false ? 0 : 10
  score += (candidate.preferredBackToBackMatchCount ?? 0) * 18
  return score
}

function computeHistoryMaps(
  assignments: CourseWorkItem['historicalAssignments'],
) {
  const exact = new Map<string, number>()
  const time = new Map<string, number>()
  const room = new Map<string, number>()
  const building = new Map<string, number>()

  assignments.forEach((entry, index) => {
    const weight = Math.pow(schedulingConfig.historyRecencyDecay, index)
    const exactKey = `${entry.roomId}|${entry.days}|${entry.startTime}`
    const timeKey = `${entry.days}|${entry.startTime}`

    exact.set(exactKey, (exact.get(exactKey) ?? 0) + weight)
    time.set(timeKey, (time.get(timeKey) ?? 0) + weight)
    room.set(entry.roomId, (room.get(entry.roomId) ?? 0) + weight)

    if (entry.buildingCode) {
      building.set(
        entry.buildingCode,
        (building.get(entry.buildingCode) ?? 0) + weight,
      )
    }
  })

  return { exact, time, room, building }
}

function normalizedFromMap(map: Map<string, number>, key: string): number {
  if (map.size === 0) {
    return 0
  }

  let max = 0
  for (const value of map.values()) {
    if (value > max) {
      max = value
    }
  }

  if (max === 0) {
    return 0
  }

  return (map.get(key) ?? 0) / max
}

function computeHistoryStrength(
  assignments: CourseWorkItem['historicalAssignments'],
  candidate: CandidateSlot,
): number {
  if (assignments.length === 0) {
    return 0
  }

  const maps = computeHistoryMaps(assignments)
  const exactKey = `${candidate.room._id}|${candidate.slot.days}|${candidate.slot.startTime}`
  const timeKey = `${candidate.slot.days}|${candidate.slot.startTime}`
  const roomKey = candidate.room._id
  const buildingKey = candidate.room.buildingCode

  const exactScore = normalizedFromMap(maps.exact, exactKey)
  const timeScore = normalizedFromMap(maps.time, timeKey)
  const roomScore = normalizedFromMap(maps.room, roomKey)
  const buildingScore = normalizedFromMap(maps.building, buildingKey)

  const weightSum =
    schedulingConfig.weights.historyExactPlacement +
    schedulingConfig.weights.historyExactTime +
    schedulingConfig.weights.historyExactRoom +
    schedulingConfig.weights.historyBuilding

  if (weightSum === 0) {
    return 0
  }

  const weighted =
    exactScore * schedulingConfig.weights.historyExactPlacement +
    timeScore * schedulingConfig.weights.historyExactTime +
    roomScore * schedulingConfig.weights.historyExactRoom +
    buildingScore * schedulingConfig.weights.historyBuilding

  return weighted / weightSum
}

function computeHistoricalPreferenceScore(
  workItem: CourseWorkItem,
  candidate: CandidateSlot,
): number {
  if (workItem.historicalPreferences.length === 0) {
    return 0
  }

  const dayCounts = new Map<string, number>()
  const timeCounts = new Map<string, number>()

  for (const record of workItem.historicalPreferences) {
    for (const days of record.preferredDays) {
      dayCounts.set(days, (dayCounts.get(days) ?? 0) + 1)
    }

    for (const startTime of record.preferredTimes) {
      timeCounts.set(startTime, (timeCounts.get(startTime) ?? 0) + 1)
    }
  }

  const dayScore =
    normalizedFromMap(dayCounts, candidate.slot.days) *
    schedulingConfig.weights.historicalPreferenceDays
  const timeScore =
    normalizedFromMap(timeCounts, candidate.slot.startTime) *
    schedulingConfig.weights.historicalPreferenceTimes

  return dayScore + timeScore
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
): number {
  let score = 0

  const { abnormal, reasons } = isPlacementAbnormal(
    candidate.room,
    workItem.placementProfile,
  )
  if (abnormal) {
    score -= schedulingConfig.abnormalPlacement.penaltyScore
  }

  if (workItem.preferredDays.includes(candidate.slot.days)) {
    score += schedulingConfig.weights.currentPreferredDays
  }

  if (workItem.preferredTimes.includes(candidate.slot.startTime)) {
    score += schedulingConfig.weights.currentPreferredTimes
  }

  if (workItem.avoidTimes.includes(candidate.slot.startTime)) {
    score += schedulingConfig.weights.currentAvoidTimes
  } else {
    score += Math.max(
      0,
      Math.floor(Math.abs(schedulingConfig.weights.currentAvoidTimes) / 4),
    )
  }

  if (
    workItem.preferredRoomId !== null &&
    candidate.room._id === workItem.preferredRoomId
  ) {
    score += schedulingConfig.weights.currentPreferredRoom
  }

  if (
    workItem.preferredBuilding !== null &&
    candidate.room.buildingCode === workItem.preferredBuilding
  ) {
    score += schedulingConfig.weights.currentPreferredBuilding
  }

  if (
    professor.officeBuilding !== null &&
    candidate.room.buildingCode === professor.officeBuilding
  ) {
    score += schedulingConfig.weights.officeBuilding
  }

  score += computeCapacityScore(candidate.room, workItem.expectedEnrollment)
  score += computeBackToBackScore(candidate)

  const historyBaseWeight =
    schedulingConfig.weights.historyExactPlacement +
    schedulingConfig.weights.historyExactTime +
    schedulingConfig.weights.historyExactRoom +
    schedulingConfig.weights.historyBuilding
  score +=
    computeHistoryStrength(workItem.historicalAssignments, candidate) *
    historyBaseWeight
  score +=
    computeHistoryStrength(workItem.professorHistory, candidate) *
    schedulingConfig.weights.professorHistory
  score +=
    computeHistoryStrength(workItem.similarProfessorHistory, candidate) *
    schedulingConfig.weights.similarProfessorHistory
  score +=
    computeHistoryStrength(workItem.similarCourseHistory, candidate) *
    schedulingConfig.weights.similarCourseHistory
  score +=
    computeHistoryStrength(workItem.departmentHistory, candidate) *
    schedulingConfig.weights.departmentHistory
  score +=
    computeHistoryStrength(workItem.similarDepartmentHistory, candidate) *
    schedulingConfig.weights.similarDepartmentHistory

  if (!abnormal) {
    const profile = workItem.placementProfile
    if (profile.floors.length > 0) {
      score += schedulingConfig.weights.historyFloor
    }

    if (profile.roomTypes.length > 0) {
      score += schedulingConfig.weights.historyRoomType
    }

    if (profile.capacityMin !== null && profile.capacityMax !== null) {
      score += schedulingConfig.weights.historyCapacityBand
    }
  }

  score += computeHistoricalPreferenceScore(workItem, candidate)

  if (abnormal && reasons.length > 0) {
    score -= Math.min(200, reasons.length * 50)
  }

  return score
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
  candidates: Array<{
    room: Room
    slot: TimeSlot
    avoidsBackToBackSameCourse?: boolean
  }>,
  workItem: CourseWorkItem,
  professor: Professor,
): { room: Room; slot: TimeSlot } | null {
  if (candidates.length === 0) {
    return null
  }

  let bestCandidate: { room: Room; slot: TimeSlot } | null = null
  let bestScore = Number.NEGATIVE_INFINITY

  for (const candidate of candidates) {
    const scored = scoreCandidateSlot(candidate, workItem, professor)
    if (
      scored > bestScore ||
      (scored === bestScore &&
        bestCandidate !== null &&
        parseTime(candidate.slot.startTime) <
          parseTime(bestCandidate.slot.startTime))
    ) {
      bestCandidate = {
        room: candidate.room,
        slot: candidate.slot,
      }
      bestScore = scored
    }
  }

  return bestCandidate
}
