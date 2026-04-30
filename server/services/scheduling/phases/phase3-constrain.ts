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
import {
  normalizeCourseReference,
  scheduledCourseIdsShareCatalog,
} from '../../../utils/courseReferences'
import { filterRooms } from '../constraints/hard'
import { collectNearHardFlags } from '../constraints/nearHard'
import {
  generateAllSlots,
  isBackToBack,
  slotsOverlap,
} from '../utils/timeSlots'
import { schedulingConfig } from '../config'
import {
  hasRealDataForRoom,
  isPlacementAbnormal,
  roomRequiresRealData,
} from '../utils/history'

function roomIsBooked(
  room: Room,
  slot: TimeSlot,
  currentAssignments: ScheduleAssignment[],
): boolean {
  return currentAssignments.some(
    (assignment) =>
      assignment.roomId === room._id && slotsOverlap(assignment, slot),
  )
}

function professorIsBusy(
  professorId: string,
  slot: TimeSlot,
  currentAssignments: ScheduleAssignment[],
): boolean {
  return currentAssignments.some(
    (assignment) =>
      assignment.professorId === professorId && slotsOverlap(assignment, slot),
  )
}

function findFirstMissingEquipment(
  workItem: CourseWorkItem,
  rooms: Room[],
): string | null {
  for (const equipmentId of workItem.requiredEquipment) {
    const anyRoomHasEquipment = rooms.some(
      (room) =>
        room.available &&
        room.equipment[equipmentId as keyof Room['equipment']] === true,
    )
    if (!anyRoomHasEquipment) {
      return equipmentId
    }
  }

  return null
}

function findGuardedRoomsMissingRealData(
  workItem: CourseWorkItem,
  rooms: Room[],
): Room[] {
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

function countConcurrentAssignments(
  slot: TimeSlot,
  currentAssignments: ScheduleAssignment[],
): number {
  return currentAssignments.filter((assignment) =>
    slotsOverlap(assignment, slot),
  ).length
}

function createConflict(
  workItem: CourseWorkItem,
  reason: string,
): ScheduleConflict {
  return {
    courseId: workItem.scheduledCourseId,
    reason,
  }
}

function describePlacementAttempts(workItem: CourseWorkItem): string {
  const attempts: string[] = []

  if (workItem.hasSubmittedRoomBuildingPreference) {
    attempts.push('submitted room/building preferences')
  } else if (workItem.preference !== null) {
    attempts.push('submitted day/time preferences')
  }

  if (workItem.historicalAssignments.length > 0) {
    attempts.push('course historical placements')
  }

  if (workItem.professorHistory.length > 0) {
    attempts.push('professor historical placements')
  }

  if (
    !workItem.hasSubmittedRoomBuildingPreference &&
    !workItem.hasDirectRoomHistory &&
    workItem.departmentTypicalRoomIds.length > 0
  ) {
    attempts.push('department typical rooms')
  }

  attempts.push('inferred valid rooms')

  return `Placement attempts exhausted: ${attempts.join(', ')}.`
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
          scheduledCourseIdsShareCatalog(
            assignment.courseId,
            workItem.scheduledCourseId,
          ) &&
          assignment.professorId === workItem.professor._id &&
          isBackToBack(assignment, slot),
      )
      const pairedCourseIds = new Set(
        [workItem.backToBackWith, ...workItem.preferredBackToBackWith]
          .filter((value): value is string => value !== null)
          .map((value) => normalizeCourseReference(value).scheduledCourseId),
      )
      const preferredBackToBackMatchCount = currentAssignments.filter(
        (assignment) =>
          pairedCourseIds.has(assignment.courseId) &&
          assignment.roomId === room._id &&
          (isBackToBack(assignment, slot) || isBackToBack(slot, assignment)),
      ).length

      candidates.push({
        room,
        slot,
        avoidsBackToBackSameCourse,
        preferredBackToBackMatchCount,
      })
    }
  }

  return candidates
}

function applyPreferenceGates(
  workItem: CourseWorkItem,
  candidates: CandidateSlot[],
): CandidateSlot[] {
  let gated = candidates

  if (workItem.preferredDays.length > 0) {
    const dayMatched = gated.filter((candidate) =>
      workItem.preferredDays.includes(candidate.slot.days),
    )
    if (dayMatched.length > 0) {
      gated = dayMatched
    }
  }

  if (workItem.preferredTimes.length > 0) {
    const timeMatched = gated.filter((candidate) =>
      workItem.preferredTimes.includes(candidate.slot.startTime),
    )
    if (timeMatched.length > 0) {
      gated = timeMatched
    }
  }

  if (workItem.avoidTimes.length > 0) {
    const nonAvoided = gated.filter(
      (candidate) => !workItem.avoidTimes.includes(candidate.slot.startTime),
    )
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
  candidates: CandidateSlot[] = [],
): string {
  const manualOptions = buildManualOptions(
    candidates,
    candidateRooms,
    candidateSlots,
  )
  const attemptSummary = describePlacementAttempts(workItem)

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
        attemptSummary,
      )
    }
  }

  const missingEquipment = findFirstMissingEquipment(workItem, rooms)
  if (missingEquipment !== null) {
    return formatConflict(
      'EQUIPMENT_MISSING',
      `No room found with required equipment: ${missingEquipment}.`,
      manualOptions,
      attemptSummary,
    )
  }

  if (candidateRooms.length === 0) {
    const blockedGuardedRooms = findGuardedRoomsMissingRealData(workItem, rooms)
    if (blockedGuardedRooms.length > 0) {
      const roomLabels = blockedGuardedRooms
        .slice(0, 3)
        .map(
          (room) =>
            room.displayName ?? `${room.buildingCode} ${room.roomNumber}`,
        )
        .join(', ')
      return formatConflict(
        'GUARDED_ROOM_REQUIRES_REAL_DATA',
        `Guarded rooms withheld until this course has direct room data (preference or direct history): ${roomLabels}.`,
        manualOptions,
        attemptSummary,
      )
    }
  }

  if (workItem.course.labComponent && candidateRooms.length === 0) {
    return formatConflict(
      'LAB_CAPACITY',
      'No eligible lab rooms remain (capacity, equipment, or real-data constraints).',
      manualOptions,
      attemptSummary,
    )
  }

  if (workItem.expectedEnrollment !== null && candidateRooms.length === 0) {
    return formatConflict(
      'CAPACITY_OVERFLOW',
      `No room with sufficient capacity (${workItem.expectedEnrollment} seats needed).`,
      manualOptions,
      attemptSummary,
    )
  }

  if (
    candidateSlots.length === 0 &&
    currentAssignments.some(
      (assignment) => assignment.professorId === workItem.professor._id,
    )
  ) {
    return formatConflict(
      'PROFESSOR_UNAVAILABLE',
      'Professor unavailable for all valid time slots.',
      manualOptions,
      attemptSummary,
    )
  }

  if (
    candidateSlots.length === 0 &&
    currentAssignments.length >= rooms.length - 1
  ) {
    return formatConflict(
      'SLOT_SATURATED',
      'All valid time slots were saturated by concurrent assignments under the current global occupancy limit.',
      manualOptions,
      attemptSummary,
    )
  }

  if (candidateSlots.length === 0) {
    return formatConflict(
      'NO_VALID_SLOT',
      'No valid slot found after applying all hard constraints.',
      manualOptions,
      attemptSummary,
    )
  }

  return formatConflict(
    'NO_VALID_SLOT',
    'No valid slot found after applying all hard constraints.',
    manualOptions,
    attemptSummary,
  )
}

function formatConflict(
  code: string,
  message: string,
  manualOptions: string[],
  attemptSummary: string,
): string {
  const optionsText =
    manualOptions.length > 0
      ? ` Manual options: ${manualOptions.join(' | ')}.`
      : ''
  return `[${code}] ${message} ${attemptSummary}${optionsText}`
}

function buildManualOptions(
  candidates: CandidateSlot[],
  candidateRooms: Room[],
  candidateSlots: TimeSlot[],
  limit = 5,
): string[] {
  const options: string[] = []
  for (const candidate of candidates) {
    const roomLabel =
      candidate.room.displayName ??
      `${candidate.room.buildingCode} ${candidate.room.roomNumber}`
    options.push(
      `${roomLabel} ${candidate.slot.days} ${candidate.slot.startTime}`,
    )
    if (options.length >= limit) {
      return options
    }
  }

  if (options.length > 0) {
    return options
  }

  if (candidateRooms.length === 0 || candidateSlots.length === 0) {
    return []
  }

  for (const room of candidateRooms) {
    for (const slot of candidateSlots) {
      const roomLabel =
        room.displayName ?? `${room.buildingCode} ${room.roomNumber}`
      options.push(`${roomLabel} ${slot.days} ${slot.startTime}`)
      if (options.length >= limit) {
        return options
      }
    }
  }

  return options
}

function filterNormalRooms(
  workItem: CourseWorkItem,
  candidateRooms: Room[],
): { normal: Room[]; abnormal: Room[] } {
  const normal: Room[] = []
  const abnormal: Room[] = []

  for (const room of candidateRooms) {
    const { abnormal: isAbnormal } = isPlacementAbnormal(
      room,
      workItem.placementProfile,
    )
    if (isAbnormal) {
      abnormal.push(room)
    } else {
      normal.push(room)
    }
  }

  return { normal, abnormal }
}

function applyDepartmentTypicalRoomFallback(
  workItem: CourseWorkItem,
  candidateRooms: Room[],
): Room[] {
  if (workItem.hasSubmittedRoomBuildingPreference) {
    return candidateRooms
  }

  if (workItem.hasDirectRoomHistory) {
    return candidateRooms
  }

  if (workItem.departmentTypicalRoomIds.length === 0) {
    return candidateRooms
  }

  const typicalRoomIdSet = new Set(workItem.departmentTypicalRoomIds)
  const departmentTypicalRooms = candidateRooms.filter((room) =>
    typicalRoomIdSet.has(room._id),
  )

  return departmentTypicalRooms.length > 0
    ? departmentTypicalRooms
    : candidateRooms
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
  const unconstrainedCandidateRooms = filterRooms(workItem, rooms)
  const candidateRooms = applyDepartmentTypicalRoomFallback(
    workItem,
    unconstrainedCandidateRooms,
  )
  const allSlots = generateAllSlots(
    workItem.course.creditHours,
    workItem.preferredDays,
    workItem.preferredTimes,
  )
  const candidateSlots = allSlots.filter((slot) => {
    if (professorIsBusy(workItem.professor._id, slot, currentAssignments)) {
      return false
    }

    const concurrentAssignments = countConcurrentAssignments(
      slot,
      currentAssignments,
    )
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
        resolveConflictReason(
          workItem,
          rooms,
          candidateRooms,
          candidateSlots,
          currentAssignments,
          [],
        ),
      ),
    }
  }

  const { normal: normalRooms, abnormal: abnormalRooms } = filterNormalRooms(
    workItem,
    candidateRooms,
  )
  const preferredRooms = normalRooms.length > 0 ? normalRooms : abnormalRooms

  const candidates = applyPreferenceGates(
    workItem,
    buildCandidatePairs(
      workItem,
      preferredRooms,
      candidateSlots,
      currentAssignments,
    ),
  )

  if (candidates.length === 0) {
    return {
      workItem,
      candidateRooms,
      candidateSlots,
      candidates,
      conflict: createConflict(
        workItem,
        resolveConflictReason(
          workItem,
          rooms,
          candidateRooms,
          candidateSlots,
          currentAssignments,
          candidates,
        ),
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
