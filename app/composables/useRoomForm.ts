/**
 * Composable for Room form management
 * Handles modal state, form state, validation, and submission
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
  buildingName: string
  abbreviation: string
  buildingCode?: string
  roomNumber: string
  displayName: string
  capacity: number
  roomType: string
  available: boolean
  equipment: RoomEquipment
}

interface NewRoomForm {
  buildingCode: string
  roomNumber: string
  displayName: string
  capacity: number | null
  roomType: string
  available: boolean
  equipment: RoomEquipment
}

export const useRoomForm = (onRoomSaved: () => Promise<void>) => {
  const showAddRoomModal = ref(false)
  const isEditMode = ref(false)
  const buildingCodeError = ref('')
  const roomTypeValidationError = ref('')
  const actionMessage = ref('')

  const createEmptyRoomForm = (): NewRoomForm => ({
    buildingCode: '',
    roomNumber: '',
    displayName: '',
    capacity: null,
    roomType: '',
    available: true,
    equipment: {
      projector: false,
      smartboard: false,
      whiteboard: false,
      piano: false,
      labStations: false,
      computers: false,
      outlets: true,
    },
  })

  const newRoomForm = reactive<NewRoomForm>(createEmptyRoomForm())

  const deriveBuildingCode = (abbreviation: string): string => {
    return abbreviation.trim().split(/\s+/)[0]?.toUpperCase() ?? ''
  }

  const validateBuildingCode = (): boolean => {
    const regex = /^[A-Z]{2,4}$/
    if (!regex.test(newRoomForm.buildingCode)) {
      buildingCodeError.value = 'Building code must be 2-4 uppercase letters'
      return false
    }
    buildingCodeError.value = ''
    return true
  }

  const validateRoomTypeForLabStations = () => {
    if (newRoomForm.equipment.labStations && newRoomForm.roomType !== 'lab') {
      roomTypeValidationError.value =
        'Lab stations require room type to be "Lab"'
    } else {
      roomTypeValidationError.value = ''
    }
  }

  const openAddRoomModal = () => {
    isEditMode.value = false
    Object.assign(newRoomForm, createEmptyRoomForm())
    buildingCodeError.value = ''
    roomTypeValidationError.value = ''
    actionMessage.value = ''
    showAddRoomModal.value = true
  }

  const openEditRoomModal = (room: Room) => {
    isEditMode.value = true
    actionMessage.value = ''
    Object.assign(newRoomForm, {
      buildingCode:
        room.buildingCode?.trim().toUpperCase() ||
        deriveBuildingCode(room.abbreviation),
      roomNumber: room.roomNumber,
      displayName: room.displayName,
      capacity: room.capacity,
      roomType: room.roomType,
      available: room.available,
      equipment: {
        projector: room.equipment.projector,
        smartboard: room.equipment.smartboard,
        whiteboard: room.equipment.whiteboard,
        piano: room.equipment.piano,
        labStations: room.equipment.labStations,
        computers: room.equipment.computers,
        outlets: room.equipment.outlets,
      },
    })
    showAddRoomModal.value = true
  }

  const closeAddRoomModal = () => {
    showAddRoomModal.value = false
    isEditMode.value = false
    Object.assign(newRoomForm, createEmptyRoomForm())
    buildingCodeError.value = ''
    roomTypeValidationError.value = ''
  }

  const submitNewRoom = async () => {
    // Validate building code
    if (!validateBuildingCode()) {
      return
    }

    // Validate room type if lab stations selected
    if (newRoomForm.equipment.labStations && newRoomForm.roomType !== 'lab') {
      roomTypeValidationError.value =
        'Lab stations require room type to be "Lab"'
      return
    }

    try {
      await $fetch('/api/rooms', {
        method: 'POST',
        body: {
          buildingCode: newRoomForm.buildingCode.toUpperCase(),
          roomNumber: newRoomForm.roomNumber,
          displayName: newRoomForm.displayName,
          capacity: newRoomForm.capacity,
          roomType: newRoomForm.roomType,
          available: newRoomForm.available,
          equipment: newRoomForm.equipment,
        },
        headers: { 'x-dev-role': 'Admin' },
      })
      actionMessage.value = isEditMode.value ? 'Room updated.' : 'Room created.'
      await onRoomSaved()
      closeAddRoomModal()
    } catch (e) {
      console.error('Failed to create room:', e)
      throw e
    }
  }

  return {
    showAddRoomModal,
    isEditMode,
    buildingCodeError,
    roomTypeValidationError,
    actionMessage,
    newRoomForm,
    validateBuildingCode,
    validateRoomTypeForLabStations,
    openAddRoomModal,
    openEditRoomModal,
    closeAddRoomModal,
    submitNewRoom,
  }
}
