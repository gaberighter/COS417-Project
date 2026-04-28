import type {
  CandidateSlot,
  CourseWorkItem,
  ConstraintEvaluation,
  NearHardFlag,
  Room,
  ScheduleAssignment,
  ScheduleConflict,
  TimeSlot,
} from '../types'
import { filterRooms } from '../constraints/hard'
import { collectNearHardFlags } from '../constraints/nearHard'
import { generateAllSlots, isBackToBack, slotsOverlap } from '../utils/timeSlots'
import { schedulingConfig } from '../config'
import { hasRealDataForRoom, isPlacementAbnormal, roomRequiresRealData } from '../utils/history'

function roomIsBooked(room: Room, slot: TimeSlot, currentAssignments: ScheduleAssignment[]): boolean {
  return currentAssignments.some(
    (assignment) =>
      assignment.roomId === room._id &&
      slotsOverlap(assignment, slot),
  )
}

function professorIsBusy(professorId: string, slot: TimeSlot, currentAssignments: ScheduleAssignment[]): boolean {
  return currentAssignments.some(
    (assignment) => assignment.professorId === professorId && slotsOverlap(assignment, slot),
  )
}

function findFirstMissingEquipment(workItem: CourseWorkItem, rooms: Room[]): string | null {
  for (const equipmentId of workItem.requiredEquipment) {
    const anyRoomHasEquipment = rooms.some((room) => room.available && room.equipment[equipmentId as keyof Room['equipment']] === true)
    if (!anyRoomHasEquipment) {
      return equipmentId
    }
  }

  return null
}

function findGuardedRoomsMissingRealData(workItem: CourseWorkItem, rooms: Room[]): Room[] {
  const historicalPreferredRoomIds = workItem.historicalPreferences
    .map((record) => record.preferredRoomId)
    .filter((value): value is string => value !== null)
  const historicalPreferredBuildings = workItem.historicalPreferences
    .map((record) => record.preferredBuilding)
    .filter((value): value is string => value !== null)

  return rooms.filter(
    (room) =>
      room.available &&
      roomRequiresRealData(room) &&
      !hasRealDataForRoom(room, {
        historicalAssignments: workItem.historicalAssignments,
        preferredRoomId: workItem.preferredRoomId,
        preferredBuilding: workItem.preferredBuilding,
        historicalPreferredRoomIds,
        historicalPreferredBuildings,
      }),
  )
}

function countConcurrentAssignments(slot: TimeSlot, currentAssignments: ScheduleAssignment[]): number {
  return currentAssignments.filter((assignment) => slotsOverlap(assignment, slot)).length
}

function createConflict(workItem: CourseWorkItem, reason: string): ScheduleConflict {
  return {
    courseId: workItem.course._id,
    reason,
  }
}

function buildCandidatePairs(
  workItem: CourseWorkItem,
  candidateRooms: Room[],
  candidateSlots: TimeSlot[],
  currentAssignments: ScheduleAssignment[],
): CandidateSlot[] {
  const candidates: CandidateSlot[] = []

  for (const room of candidateRooms) {
    for (const slot of candidateSlots) {
      if (roomIsBooked(room, slot, currentAssignments)) {
        continue
      }

      const avoidsBackToBackSameCourse = !currentAssignments.some(
        (assignment) =>
          assignment.courseId === workItem.course._id &&
          assignment.professorId === workItem.professor._id &&
          isBackToBack(assignment, slot),
      )

      candidates.push({
        room,
        slot,
        avoidsBackToBackSameCourse,
      })
    }
  }

  return candidates
}

function applyPreferenceGates(workItem: CourseWorkItem, candidates: CandidateSlot[]): CandidateSlot[] {
  let gated = candidates

  if (workItem.preferredDays.length > 0) {
    const dayMatched = gated.filter((candidate) => workItem.preferredDays.includes(candidate.slot.days))
    if (dayMatched.length > 0) {
      gated = dayMatched
    }
  }

  if (workItem.preferredTimes.length > 0) {
    const timeMatched = gated.filter((candidate) => workItem.preferredTimes.includes(candidate.slot.startTime))
    if (timeMatched.length > 0) {
      gated = timeMatched
    }
  }

  if (workItem.avoidTimes.length > 0) {
    const nonAvoided = gated.filter((candidate) => !workItem.avoidTimes.includes(candidate.slot.startTime))
    if (nonAvoided.length > 0) {
      gated = nonAvoided
    }
  }

  return gated
}

function resolveConflictReason(
  workItem: CourseWorkItem,
  rooms: Room[],
  candidateRooms: Room[],
  candidateSlots: TimeSlot[],
  currentAssignments: ScheduleAssignment[],
): string {
  const manualOptions = buildManualOptions(candidateRooms, candidateSlots)

  if (
    schedulingConfig.abnormalPlacement.requireHistoricalBuilding &&
    workItem.placementProfile.buildings.length === 1
  ) {
    const [preferredBuilding] = workItem.placementProfile.buildings
    const availableInBuilding = rooms.some(
      (room) => room.available && room.buildingCode === preferredBuilding,
    )

    if (!availableInBuilding) {
      return formatConflict(
        'BUILDING_UNAVAILABLE',
        `No available rooms remain in the historically required building ${preferredBuilding}.`,
        manualOptions,
      )
    }
  }

  const missingEquipment = findFirstMissingEquipment(workItem, rooms)
  if (missingEquipment !== null) {
    return formatConflict(
      'EQUIPMENT_MISSING',
      `No room found with required equipment: ${missingEquipment}.`,
      manualOptions,
    )
  }

  if (candidateRooms.length === 0) {
    const blockedGuardedRooms = findGuardedRoomsMissingRealData(workItem, rooms)
    if (blockedGuardedRooms.length > 0) {
      const roomLabels = blockedGuardedRooms
        .slice(0, 3)
        .map((room) => room.displayName ?? `${room.buildingCode} ${room.roomNumber}`)
        .join(', ')
      return formatConflict(
        'GUARDED_ROOM_REQUIRES_REAL_DATA',
        `Guarded rooms withheld until this course has direct room data (preference or direct history): ${roomLabels}.`,
        manualOptions,
      )
    }
  }

  if (workItem.course.labComponent && candidateRooms.length === 0) {
    return formatConflict('LAB_CAPACITY', 'Lab capacity exhausted for this time slot.', manualOptions)
  }

  if (workItem.expectedEnrollment !== null && candidateRooms.length === 0) {
    return formatConflict(
      'CAPACITY_OVERFLOW',
      `No room with sufficient capacity (${workItem.expectedEnrollment} seats needed).`,
      manualOptions,
    )
  }

  if (
    candidateSlots.length === 0 &&
    currentAssignments.some((assignment) => assignment.professorId === workItem.professor._id)
  ) {
    return formatConflict('PROFESSOR_UNAVAILABLE', 'Professor unavailable for all valid time slots.', manualOptions)
  }

  if (candidateSlots.length === 0) {
    return formatConflict('NO_VALID_SLOT', 'No valid slot found after applying all hard constraints.', manualOptions)
  }

  return formatConflict('NO_VALID_SLOT', 'No valid slot found after applying all hard constraints.', manualOptions)
}

function formatConflict(code: string, message: string, manualOptions: string[]): string {
  const optionsText = manualOptions.length > 0 ? ` Manual options: ${manualOptions.join(' | ')}.` : ''
  return `[${code}] ${message}${optionsText}`
}

function buildManualOptions(candidateRooms: Room[], candidateSlots: TimeSlot[], limit = 5): string[] {
  if (candidateRooms.length === 0 || candidateSlots.length === 0) {
    return []
  }

  const options: string[] = []
  for (const room of candidateRooms) {
    for (const slot of candidateSlots) {
      const roomLabel = room.displayName ?? `${room.buildingCode} ${room.roomNumber}`
      options.push(`${roomLabel} ${slot.days} ${slot.startTime}`)
      if (options.length >= limit) {
        return options
      }
    }
  }

  return options
}

function filterNormalRooms(workItem: CourseWorkItem, candidateRooms: Room[]): { normal: Room[]; abnormal: Room[] } {
  const normal: Room[] = []
  const abnormal: Room[] = []

  for (const room of candidateRooms) {
    const { abnormal: isAbnormal } = isPlacementAbnormal(room, workItem.placementProfile)
    if (isAbnormal) {
      abnormal.push(room)
    } else {
      normal.push(room)
    }
  }

  return { normal, abnormal }
}

/**
 * Applies the hard-constraint filters and turns a work item into room/slot candidates.
 *
 * @param workItem - Work item under evaluation.
 * @param rooms - Available rooms.
 * @param currentAssignments - Assignments already accepted in the current run.
 * @returns The candidate rooms, candidate slots, cross-product candidates, and any conflict.
 */
export function evaluatePlacementOptions(
  workItem: CourseWorkItem,
  rooms: Room[],
  currentAssignments: ScheduleAssignment[],
): ConstraintEvaluation {
  const candidateRooms = filterRooms(workItem, rooms)
  const allSlots = generateAllSlots(workItem.course.creditHours)
  const candidateSlots = allSlots.filter((slot) => {
    if (professorIsBusy(workItem.professor._id, slot, currentAssignments)) {
      return false
    }

    const concurrentAssignments = countConcurrentAssignments(slot, currentAssignments)
    return concurrentAssignments < rooms.length - 1
  })

  if (candidateRooms.length === 0 || candidateSlots.length === 0) {
    return {
      workItem,
      candidateRooms,
      candidateSlots,
      candidates: [],
      conflict: createConflict(
        workItem,
        resolveConflictReason(workItem, rooms, candidateRooms, candidateSlots, currentAssignments),
      ),
    }
  }

  const { normal: normalRooms, abnormal: abnormalRooms } = filterNormalRooms(workItem, candidateRooms)
  const preferredRooms = normalRooms.length > 0 ? normalRooms : abnormalRooms

  const candidates = applyPreferenceGates(
    workItem,
    buildCandidatePairs(workItem, preferredRooms, candidateSlots, currentAssignments),
  )

  if (candidates.length === 0) {
    return {
      workItem,
      candidateRooms,
      candidateSlots,
      candidates,
      conflict: createConflict(
        workItem,
        resolveConflictReason(workItem, rooms, candidateRooms, candidateSlots, currentAssignments),
      ),
    }
  }

  return {
    workItem,
    candidateRooms,
    candidateSlots,
    candidates,
    conflict: null,
  }
}

/**
 * Collects all near-hard constraint flags for the selected placement.
 *
 * @param workItem - Work item that produced the placement.
 * @param candidate - Chosen room and slot.
 * @param currentAssignments - Assignments already accepted in the current run.
 * @returns A list of non-blocking warnings.
 */
export function collectPlacementFlags(
  workItem: CourseWorkItem,
  candidate: CandidateSlot,
  currentAssignments: ScheduleAssignment[],
): NearHardFlag[] {
  return collectNearHardFlags(workItem, candidate, currentAssignments)
}
