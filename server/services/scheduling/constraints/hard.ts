import type { CourseWorkItem, Room } from '../types'
import { hasRealDataForRoom } from '../utils/history'

function hasRequiredEquipment(room: Room, requiredEquipment: string[]): boolean {
  return requiredEquipment.every((equipmentId) => {
    const equipmentFlag = room.equipment as Record<string, boolean>
    return equipmentFlag[equipmentId] === true
  })
}

/**
 * Filters the room inventory down to rooms that satisfy the hard placement constraints.
 *
 * @param workItem - Course and preference context for the placement.
 * @param rooms - Available rooms to evaluate.
 * @returns Rooms that can satisfy the hard constraints for the work item.
 */
export function filterRooms(workItem: CourseWorkItem, rooms: Room[]): Room[] {
  const expectedEnrollment = workItem.expectedEnrollment
  const historicalPreferredRoomIds = workItem.historicalPreferences
    .map((record) => record.preferredRoomId)
    .filter((value): value is string => value !== null)
  const historicalPreferredBuildings = workItem.historicalPreferences
    .map((record) => record.preferredBuilding)
    .filter((value): value is string => value !== null)

  return rooms.filter((room) => {
    if (!room.available) {
      return false
    }

    if (workItem.course.labComponent && room.roomType !== 'lab') {
      return false
    }

    if (expectedEnrollment !== null && room.capacity < expectedEnrollment) {
      return false
    }

    if (!hasRequiredEquipment(room, workItem.requiredEquipment)) {
      return false
    }

    return hasRealDataForRoom(room, {
      historicalAssignments: workItem.historicalAssignments,
      preferredRoomId: workItem.preferredRoomId,
      preferredBuilding: workItem.preferredBuilding,
      historicalPreferredRoomIds,
      historicalPreferredBuildings,
    })
  })
}
