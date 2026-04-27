/**
 * Composable for Room CRUD operations
 * Manages room data loading, error states, and deletion
 */

interface RoomEquipment {
  projector: boolean
  smartboard: boolean
  whiteboard: boolean
  piano: boolean
  labStations: boolean
  computers: boolean
  outlets: boolean
}

interface Room {
  buildingCode: string
  roomNumber: string
  displayName: string
  capacity: number
  roomType: string
  available: boolean
  equipment: RoomEquipment
}

export const useRoomCRUD = () => {
  const rooms = ref<Room[]>([])
  const pending = ref(false)
  const error = ref<Error | null>(null)

  const loadRooms = async () => {
    pending.value = true
    error.value = null
    try {
      rooms.value = await $fetch<Room[]>('/api/rooms', {
        headers: { 'x-dev-role': 'Admin' },
      })
    } catch (e) {
      error.value = e as Error
    } finally {
      pending.value = false
    }
  }

  const retryLoad = () => loadRooms()

  const deleteRoom = (room: Room) => {
    const shouldDelete = window.confirm(
      `Delete room ${room.buildingCode} ${room.roomNumber}?`,
    )
    if (!shouldDelete) {
      return
    }

    // Delete not supported yet on backend
    return 'Delete is not available yet on the backend. Add a DELETE /api/rooms route to enable it.'
  }

  return {
    rooms,
    pending,
    error,
    loadRooms,
    retryLoad,
    deleteRoom,
  }
}
