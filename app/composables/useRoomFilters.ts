/**
 * Composable for Room filtering and search
 * Manages filter state and filtered room computations
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

type BooleanFilter = 'any' | 'true' | 'false'

interface RoomFilters {
  buildingName: string
  roomNumber: string
  displayName: string
  roomType: string
  capacityMin: number | null
  capacityMax: number | null
  available: BooleanFilter
  projector: BooleanFilter
  smartboard: BooleanFilter
  whiteboard: BooleanFilter
  piano: BooleanFilter
  labStations: BooleanFilter
  computers: BooleanFilter
  outlets: BooleanFilter
}

export const useRoomFilters = (rooms: Ref<Room[]>) => {
  const createDefaultFilters = (): RoomFilters => ({
    buildingName: '',
    roomNumber: '',
    displayName: '',
    roomType: '',
    capacityMin: null,
    capacityMax: null,
    available: 'any',
    projector: 'any',
    smartboard: 'any',
    whiteboard: 'any',
    piano: 'any',
    labStations: 'any',
    computers: 'any',
    outlets: 'any',
  })

  const filters = reactive<RoomFilters>(createDefaultFilters())
  const appliedFilters = reactive<RoomFilters>(createDefaultFilters())

  const roomTypeOptions = computed(() => {
    const uniqueTypes = new Set(
      rooms.value
        .map((room) => room.roomType)
        .filter((roomType) => roomType && roomType.trim().length > 0),
    )

    return Array.from(uniqueTypes).sort((left, right) =>
      left.localeCompare(right),
    )
  })

  const includesInsensitive = (value: string, query: string) => {
    return value.toLowerCase().includes(query.trim().toLowerCase())
  }

  const matchesBooleanFilter = (value: boolean, filter: BooleanFilter) => {
    if (filter === 'any') {
      return true
    }

    return filter === 'true' ? value : !value
  }

  const filteredRooms = computed(() => {
    return rooms.value.filter((room) => {
      if (
        appliedFilters.buildingName &&
        !includesInsensitive(room.buildingName, appliedFilters.buildingName)
      ) {
        return false
      }

      if (
        appliedFilters.roomNumber &&
        !includesInsensitive(room.roomNumber, appliedFilters.roomNumber)
      ) {
        return false
      }

      if (
        appliedFilters.displayName &&
        !includesInsensitive(room.displayName ?? '', appliedFilters.displayName)
      ) {
        return false
      }

      if (
        appliedFilters.roomType &&
        room.roomType !== appliedFilters.roomType
      ) {
        return false
      }

      if (
        appliedFilters.capacityMin !== null &&
        room.capacity < appliedFilters.capacityMin
      ) {
        return false
      }

      if (
        appliedFilters.capacityMax !== null &&
        room.capacity > appliedFilters.capacityMax
      ) {
        return false
      }

      if (!matchesBooleanFilter(room.available, appliedFilters.available)) {
        return false
      }

      if (
        !matchesBooleanFilter(
          room.equipment.projector,
          appliedFilters.projector,
        )
      ) {
        return false
      }

      if (
        !matchesBooleanFilter(
          room.equipment.smartboard,
          appliedFilters.smartboard,
        )
      ) {
        return false
      }

      if (
        !matchesBooleanFilter(
          room.equipment.whiteboard,
          appliedFilters.whiteboard,
        )
      ) {
        return false
      }

      if (!matchesBooleanFilter(room.equipment.piano, appliedFilters.piano)) {
        return false
      }

      if (
        !matchesBooleanFilter(
          room.equipment.labStations,
          appliedFilters.labStations,
        )
      ) {
        return false
      }

      if (
        !matchesBooleanFilter(
          room.equipment.computers,
          appliedFilters.computers,
        )
      ) {
        return false
      }

      if (
        !matchesBooleanFilter(room.equipment.outlets, appliedFilters.outlets)
      ) {
        return false
      }

      return true
    })
  })

  const applyFilters = () => {
    Object.assign(appliedFilters, filters)
  }

  const resetFilters = () => {
    Object.assign(filters, createDefaultFilters())
    Object.assign(appliedFilters, createDefaultFilters())
  }

  return {
    filters,
    appliedFilters,
    roomTypeOptions,
    filteredRooms,
    applyFilters,
    resetFilters,
  }
}
