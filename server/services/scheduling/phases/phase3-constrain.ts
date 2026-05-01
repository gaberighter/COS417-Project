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
  const pairedCourseIds = new Set(
    [workItem.backToBackWith, ...workItem.preferredBackToBackWith]
      .filter((value): value is string => value !== null)
      .map((value) => normalizeCourseReference(value).scheduledCourseId),
  )

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

function slotKey(slot: TimeSlot): string {
  return `${slot.days}|${slot.startTime}|${slot.endTime}`
}

function roomLabel(room: Room): string {
  return room.displayName ?? `${room.buildingCode} ${room.roomNumber}`
}

function buildRoomTiers(
  workItem: CourseWorkItem,
  candidateRooms: Room[],
): Array<{ label: string; rooms: Room[] }> {
  const historicalRoomIds = new Set(workItem.placementProfile.roomIds)
  const historicalBuildings = new Set(workItem.placementProfile.buildings)
  const departmentTypicalRoomIds = new Set(workItem.departmentTypicalRoomIds)
  const roomTiers = [
    {
      label: 'preferred room',
      rooms: candidateRooms.filter(
        (room) => room._id === workItem.preferredRoomId,
      ),
    },
    {
      label: 'preferred building',
      rooms: candidateRooms.filter(
        (room) => room.buildingCode === workItem.preferredBuilding,
      ),
    },
    {
      label: 'historical rooms',
      rooms: candidateRooms.filter((room) => historicalRoomIds.has(room._id)),
    },
    {
      label: 'historical buildings',
      rooms: candidateRooms.filter((room) =>
        historicalBuildings.has(room.buildingCode),
      ),
    },
    {
      label: 'department typical rooms',
      rooms: candidateRooms.filter((room) =>
        departmentTypicalRoomIds.has(room._id),
      ),
    },
    {
      label: 'professor office building',
      rooms: candidateRooms.filter(
        (room) => room.buildingCode === workItem.professor.officeBuilding,
      ),
    },
    {
      label: 'all valid rooms',
      rooms: candidateRooms,
    },
  ]

  const seenRoomSets = new Set<string>()

  return roomTiers.filter((tier) => {
    if (tier.rooms.length === 0) return false
    const key = tier.rooms
      .map((room) => room._id)
      .sort()
      .join('|')
    if (!key || seenRoomSets.has(key)) return false
    seenRoomSets.add(key)
    return true
  })
}

function buildSlotTiers(
  workItem: CourseWorkItem,
  candidateSlots: TimeSlot[],
): Array<{ label: string; slots: TimeSlot[] }> {
  const slotTiers = [
    {
      label: 'preferred day and time',
      slots: candidateSlots.filter(
        (slot) =>
          workItem.preferredDays.includes(slot.days) &&
          workItem.preferredTimes.includes(slot.startTime),
      ),
    },
    {
      label: 'preferred day',
      slots: candidateSlots.filter((slot) =>
        workItem.preferredDays.includes(slot.days),
      ),
    },
    {
      label: 'preferred time',
      slots: candidateSlots.filter((slot) =>
        workItem.preferredTimes.includes(slot.startTime),
      ),
    },
    {
      label: 'any valid time',
      slots: candidateSlots,
    },
  ]

  const seenSlotSets = new Set<string>()

  return slotTiers.filter((tier) => {
    if (tier.slots.length === 0) return false
    const key = tier.slots
      .map((slot) => slotKey(slot))
      .sort()
      .join('|')
    if (!key || seenSlotSets.has(key)) return false
    seenSlotSets.add(key)
    return true
  })
}

function applyAvoidTimePreference(
  workItem: CourseWorkItem,
  candidates: CandidateSlot[],
  decisionLog: string[],
): CandidateSlot[] {
  if (workItem.avoidTimes.length === 0) {
    return candidates
  }

  const nonAvoided = candidates.filter(
    (candidate) => !workItem.avoidTimes.includes(candidate.slot.startTime),
  )

  if (nonAvoided.length > 0 && nonAvoided.length < candidates.length) {
    decisionLog.push(
      `Avoid-time preference removed ${
        candidates.length - nonAvoided.length
      } pairing(s) from the selected tier.`,
    )
    return nonAvoided
  }

  if (nonAvoided.length === 0) {
    decisionLog.push(
      'Every pairing in the selected tier used an avoided time, so the scheduler kept them as a fallback.',
    )
  }

  return candidates
}

function selectCandidateTier(
  workItem: CourseWorkItem,
  candidates: CandidateSlot[],
  candidateRooms: Room[],
  candidateSlots: TimeSlot[],
): {
  candidates: CandidateSlot[]
  selectedTier: string | null
  decisionLog: string[]
} {
  const decisionLog: string[] = [
    `Hard constraints kept ${candidateRooms.length} room(s) and ${candidateSlots.length} slot(s).`,
    `Built ${candidates.length} room/time pairing(s) before fallback selection.`,
  ]

  const roomTiers = buildRoomTiers(workItem, candidateRooms)
  const slotTiers = buildSlotTiers(workItem, candidateSlots)

  const roomTierByLabel = new Map(roomTiers.map((tier) => [tier.label, tier]))
  const slotTierByLabel = new Map(slotTiers.map((tier) => [tier.label, tier]))
  const tierRequests: Array<[string, string]> = []
  const pushTier = (roomLabel: string, slotLabel: string) => {
    if (!roomTierByLabel.has(roomLabel) || !slotTierByLabel.has(slotLabel)) {
      return
    }

    tierRequests.push([roomLabel, slotLabel])
  }

  for (const slotLabel of [
    'preferred day and time',
    'preferred day',
    'preferred time',
    'any valid time',
  ]) {
    pushTier('preferred room', slotLabel)
  }

  for (const roomLabel of [
    'preferred building',
    'historical rooms',
    'historical buildings',
    'department typical rooms',
    'professor office building',
    'all valid rooms',
  ]) {
    pushTier(roomLabel, 'preferred day and time')
  }

  for (const roomLabel of [
    'preferred building',
    'historical rooms',
    'historical buildings',
    'department typical rooms',
    'professor office building',
    'all valid rooms',
  ]) {
    pushTier(roomLabel, 'preferred day')
    pushTier(roomLabel, 'preferred time')
    pushTier(roomLabel, 'any valid time')
  }

  const seenTierKeys = new Set<string>()
  for (const [roomLabel, slotLabel] of tierRequests) {
    const roomTier = roomTierByLabel.get(roomLabel)
    const slotTier = slotTierByLabel.get(slotLabel)
    if (!roomTier || !slotTier) continue

    const roomIds = new Set(roomTier.rooms.map((room) => room._id))
    const slotIds = new Set(slotTier.slots.map((slot) => slotKey(slot)))
    const tierCandidates = candidates.filter(
      (candidate) =>
        roomIds.has(candidate.room._id) && slotIds.has(slotKey(candidate.slot)),
    )
    const tierKey = tierCandidates
      .map(
        (candidate) =>
          `${candidate.room._id}|${candidate.slot.days}|${candidate.slot.startTime}|${candidate.slot.endTime}`,
      )
      .sort()
      .join('||')

    if (seenTierKeys.has(tierKey)) {
      continue
    }
    seenTierKeys.add(tierKey)

    const tierLabel = `${roomLabel} + ${slotLabel}`
    decisionLog.push(
      `Tier "${tierLabel}" kept ${tierCandidates.length} pairing(s).`,
    )
    if (tierCandidates.length === 0) {
      continue
    }

    const tierAfterAvoid = applyAvoidTimePreference(
      workItem,
      tierCandidates,
      decisionLog,
    )
    decisionLog.push(`Selected tier "${tierLabel}" for final ranking.`)
    return {
      candidates: tierAfterAvoid,
      selectedTier: tierLabel,
      decisionLog,
    }
  }

  return {
    candidates: applyAvoidTimePreference(workItem, candidates, decisionLog),
    selectedTier: 'all valid rooms + any valid time',
    decisionLog,
  }
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
    options.push(
      `${roomLabel(candidate.room)} ${candidate.slot.days} ${candidate.slot.startTime}`,
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
      options.push(`${roomLabel(room)} ${slot.days} ${slot.startTime}`)
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
  const allSlots = generateAllSlots(
    workItem.course.creditHours,
    [],
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
      selectedTier: null,
      decisionLog: [],
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
  const allCandidates = buildCandidatePairs(
    workItem,
    preferredRooms,
    candidateSlots,
    currentAssignments,
  )
  const { candidates, selectedTier, decisionLog } = selectCandidateTier(
    workItem,
    allCandidates,
    preferredRooms,
    candidateSlots,
  )

  if (normalRooms.length > 0 && abnormalRooms.length > 0) {
    decisionLog.push(
      `Withheld ${abnormalRooms.length} abnormal room(s) because ${normalRooms.length} normal room(s) were still available.`,
    )
  }

  if (candidates.length === 0) {
    return {
      workItem,
      candidateRooms,
      candidateSlots,
      candidates,
      selectedTier,
      decisionLog,
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
    selectedTier,
    decisionLog,
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
