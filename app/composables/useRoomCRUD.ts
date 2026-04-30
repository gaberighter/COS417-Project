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
  abbreviation: string
  buildingName: string
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
  const deleteMessage = ref('')

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

  const buildRoomId = (room: Room) => {
    return room.abbreviation.trim().toUpperCase()
  }

  const deleteRoom = async (room: Room) => {
    const roomId = buildRoomId(room)
    deleteMessage.value = ''
    const shouldDelete = window.confirm(
      `Delete room ${room.buildingName} ${room.roomNumber}?`,
    )
    if (!shouldDelete) {
      return
    }

    try {
      await $fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
        method: 'DELETE',
        headers: { 'x-dev-role': 'Admin' },
      })
      deleteMessage.value = 'Room deleted.'
      await loadRooms()
    } catch (e) {
      console.error('Failed to delete room:', e)
      deleteMessage.value = 'Failed to delete room. Please try again.'
    }
  }

  return {
    rooms,
    pending,
    error,
    loadRooms,
    retryLoad,
    deleteRoom,
    deleteMessage,
  }
}
