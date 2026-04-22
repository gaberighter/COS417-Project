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

function resolveConflictReason(
  workItem: CourseWorkItem,
  rooms: Room[],
  candidateRooms: Room[],
  candidateSlots: TimeSlot[],
  currentAssignments: ScheduleAssignment[],
): string {
  const missingEquipment = findFirstMissingEquipment(workItem, rooms)
  if (missingEquipment !== null) {
    return `No room found with required equipment: ${missingEquipment}`
  }

  if (workItem.course.labComponent && candidateRooms.length === 0) {
    return 'Lab capacity exhausted for this time slot'
  }

  if (workItem.expectedEnrollment !== null && candidateRooms.length === 0) {
    return `No room with sufficient capacity (${workItem.expectedEnrollment} seats needed)`
  }

  if (
    candidateSlots.length === 0 &&
    currentAssignments.some((assignment) => assignment.professorId === workItem.professor._id)
  ) {
    return 'Professor unavailable for all valid time slots'
  }

  if (candidateSlots.length === 0) {
    return 'No valid slot found after applying all hard constraints'
  }

  return 'No valid slot found after applying all hard constraints'
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
  const allSlots = generateAllSlots()
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

  const candidates = buildCandidatePairs(workItem, candidateRooms, candidateSlots, currentAssignments)

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
