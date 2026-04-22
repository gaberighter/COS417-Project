import type { CourseWorkItem, Room } from '../types'

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

    return hasRequiredEquipment(room, workItem.requiredEquipment)
  })
}
