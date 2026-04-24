<template>
    <div class="room-viewer">
        <div class="room-search">
            <h2>Filter Rooms</h2>
            <div class="filter-grid">
                <label>
                    Building Code
                    <input v-model="filters.buildingCode" type="text" placeholder="e.g. SCI" />
                </label>
                <label>
                    Room Number
                    <input v-model="filters.roomNumber" type="text" placeholder="e.g. 101" />
                </label>
                <label>
                    Display Name
                    <input v-model="filters.displayName" type="text" placeholder="e.g. Physics Lab" />
                </label>
                <label>
                    Room Type
                    <select v-model="filters.roomType">
                        <option value="">Any</option>
                        <option v-for="type in roomTypeOptions" :key="type" :value="type">{{ type }}</option>
                    </select>
                </label>
                <label>
                    Capacity (Min)
                    <input v-model.number="filters.capacityMin" type="number" min="0" placeholder="No minimum" />
                </label>
                <label>
                    Capacity (Max)
                    <input v-model.number="filters.capacityMax" type="number" min="0" placeholder="No maximum" />
                </label>
                <label>
                    Available
                    <select v-model="filters.available">
                        <option value="any">Any</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                    </select>
                </label>
                <label>
                    Projector
                    <select v-model="filters.projector">
                        <option value="any">Any</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                    </select>
                </label>
                <label>
                    Smartboard
                    <select v-model="filters.smartboard">
                        <option value="any">Any</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                    </select>
                </label>
                <label>
                    Whiteboard
                    <select v-model="filters.whiteboard">
                        <option value="any">Any</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                    </select>
                </label>
                <label>
                    Piano
                    <select v-model="filters.piano">
                        <option value="any">Any</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                    </select>
                </label>
                <label>
                    Lab Stations
                    <select v-model="filters.labStations">
                        <option value="any">Any</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                    </select>
                </label>
                <label>
                    Computers
                    <select v-model="filters.computers">
                        <option value="any">Any</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                    </select>
                </label>
                <label>
                    Outlets
                    <select v-model="filters.outlets">
                        <option value="any">Any</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                    </select>
                </label>
            </div>
            <div class="filter-actions">
                <button @click="applyFilters">Apply Filters</button>
                <button @click="resetFilters">Clear Filters</button>
                <p class="filter-results">Showing {{ filteredRooms.length }} of {{ rooms.length }} rooms</p>
            </div>
        </div>
        <div class="room-content">
            <p v-if="pending">Loading rooms...</p>
            <div v-else-if="error" class="error-state">
                <p>Unable to load room inventory.</p>
                <button @click="retryLoad">Retry</button>
            </div>
            <div v-else class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Capacity</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Projector</th>
                            <th>Smartboard</th>
                            <th>Whiteboard</th>
                            <th>Piano</th>
                            <th>Lab Stations</th>
                            <th>Computers</th>
                            <th>Outlets</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="room in filteredRooms" :key="`${room.buildingCode}-${room.roomNumber}`">
                            <td>{{ room.displayName }}</td>
                            <td>{{ room.capacity }}</td>
                            <td>{{ room.roomType }}</td>
                            <td>
                                <span :class="getStatusClass(room.available)">{{ getStatusText(room.available) }}</span>
                            </td>
                            <td>{{ formatBoolean(room.equipment.projector) }}</td>
                            <td>{{ formatBoolean(room.equipment.smartboard) }}</td>
                            <td>{{ formatBoolean(room.equipment.whiteboard) }}</td>
                            <td>{{ formatBoolean(room.equipment.piano) }}</td>
                            <td>{{ formatBoolean(room.equipment.labStations) }}</td>
                            <td>{{ formatBoolean(room.equipment.computers) }}</td>
                            <td>{{ formatBoolean(room.equipment.outlets) }}</td>
                            <td class="row-actions">
                                <button type="button" class="action-btn action-btn--edit" @click="openEditRoomModal(room)">Edit</button>
                                <button type="button" class="action-btn action-btn--delete" @click="deleteRoom(room)">Delete</button>
                            </td>
                        </tr>
                        <tr v-if="filteredRooms.length === 0">
                            <td colspan="12">No rooms found.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p v-if="actionMessage" class="action-message">{{ actionMessage }}</p>
        </div>
    </div>
    <button class="add-room-fab" @click="openAddRoomModal" title="Add New Room">+</button>
    <div v-if="showAddRoomModal" class="modal-overlay" @click.self="closeAddRoomModal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>{{ isEditMode ? 'Edit Room' : 'Add New Room' }}</h2>
                <button class="close-btn" @click="closeAddRoomModal">✕</button>
            </div>
            <form @submit.prevent="submitNewRoom" class="room-form">
                <div class="form-group">
                    <label for="buildingCode">Building Code *</label>
                    <input
                        id="buildingCode"
                        v-model="newRoomForm.buildingCode"
                        type="text"
                        placeholder="e.g. SCI"
                        maxlength="4"
                        :disabled="isEditMode"
                        required
                    />
                    <span v-if="buildingCodeError" class="error-text">{{ buildingCodeError }}</span>
                </div>
                <div class="form-group">
                    <label for="roomNumber">Room Number *</label>
                    <input
                        id="roomNumber"
                        v-model="newRoomForm.roomNumber"
                        type="text"
                        placeholder="e.g. 101"
                        :disabled="isEditMode"
                        required
                    />
                </div>
                <div class="form-group">
                    <label for="displayName">Display Name</label>
                    <input
                        id="displayName"
                        v-model="newRoomForm.displayName"
                        type="text"
                        placeholder="e.g. Physics Lab"
                    />
                </div>
                <div class="form-group">
                    <label for="capacity">Capacity *</label>
                    <input
                        id="capacity"
                        v-model.number="newRoomForm.capacity"
                        type="number"
                        min="1"
                        required
                    />
                </div>
                <div class="form-group">
                    <label for="roomType">Room Type *</label>
                    <select id="roomType" v-model="newRoomForm.roomType" required>
                        <option value="">-- Select --</option>
                        <option value="classroom">Classroom</option>
                        <option value="lab">Lab</option>
                    </select>
                    <span v-if="roomTypeValidationError" class="error-text">{{ roomTypeValidationError }}</span>
                </div>
                <div class="form-group checkbox-group">
                    <label>Equipment</label>
                    <div class="equipment-grid">
                        <label class="checkbox-label">
                            <input v-model="newRoomForm.equipment.projector" type="checkbox" />
                            Projector
                        </label>
                        <label class="checkbox-label">
                            <input v-model="newRoomForm.equipment.smartboard" type="checkbox" />
                            Smartboard
                        </label>
                        <label class="checkbox-label">
                            <input v-model="newRoomForm.equipment.whiteboard" type="checkbox" />
                            Whiteboard
                        </label>
                        <label class="checkbox-label">
                            <input v-model="newRoomForm.equipment.piano" type="checkbox" />
                            Piano
                        </label>
                        <label class="checkbox-label">
                            <input
                                v-model="newRoomForm.equipment.labStations"
                                type="checkbox"
                                @change="validateRoomTypeForLabStations"
                            />
                            Lab Stations
                        </label>
                        <label class="checkbox-label">
                            <input v-model="newRoomForm.equipment.computers" type="checkbox" />
                            Computers
                        </label>
                        <label class="checkbox-label">
                            <input v-model="newRoomForm.equipment.outlets" type="checkbox" />
                            Outlets
                        </label>
                    </div>
                </div>
                <div class="form-group checkbox-group">
                    <label class="checkbox-label">
                        <input v-model="newRoomForm.available" type="checkbox" />
                        Available
                    </label>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" @click="closeAddRoomModal">Cancel</button>
                    <button type="submit" class="btn-primary">{{ isEditMode ? 'Save Changes' : 'Create Room' }}</button>
                </div>
            </form>
        </div>
    </div>
    <div class="temporary-debug-buttons">
        <button @click="redirectToLogin">Login Page</button>
        <button @click="redirectToAdmin">Admin Page</button>
    </div>
</template>

<script setup lang="ts">
definePageMeta({
    pageTitle: 'Room Viewer',
})

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

type BooleanFilter = 'any' | 'true' | 'false'

interface RoomFilters {
    buildingCode: string
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

const rooms = ref<Room[]>([])
const pending = ref(false)
const error = ref<Error | null>(null)

const loadRooms = async () => {
    pending.value = true
    error.value = null
    try {
        rooms.value = await $fetch<Room[]>('/api/rooms', {
            headers: { 'x-dev-role': 'Admin' }
        })
    } catch (e) {
        error.value = e as Error
    } finally {
        pending.value = false
    }
}

onMounted(loadRooms)

const { redirectToLogin, redirectToAdmin } = useDebugNavigation()

const createDefaultFilters = (): RoomFilters => ({
    buildingCode: '',
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
            .filter((roomType) => roomType && roomType.trim().length > 0)
    )

    return Array.from(uniqueTypes).sort((left, right) => left.localeCompare(right))
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
        if (appliedFilters.buildingCode && !includesInsensitive(room.buildingCode, appliedFilters.buildingCode)) {
            return false
        }

        if (appliedFilters.roomNumber && !includesInsensitive(room.roomNumber, appliedFilters.roomNumber)) {
            return false
        }

        if (appliedFilters.displayName && !includesInsensitive(room.displayName ?? '', appliedFilters.displayName)) {
            return false
        }

        if (appliedFilters.roomType && room.roomType !== appliedFilters.roomType) {
            return false
        }

        if (appliedFilters.capacityMin !== null && room.capacity < appliedFilters.capacityMin) {
            return false
        }

        if (appliedFilters.capacityMax !== null && room.capacity > appliedFilters.capacityMax) {
            return false
        }

        if (!matchesBooleanFilter(room.available, appliedFilters.available)) {
            return false
        }

        if (!matchesBooleanFilter(room.equipment.projector, appliedFilters.projector)) {
            return false
        }

        if (!matchesBooleanFilter(room.equipment.smartboard, appliedFilters.smartboard)) {
            return false
        }

        if (!matchesBooleanFilter(room.equipment.whiteboard, appliedFilters.whiteboard)) {
            return false
        }

        if (!matchesBooleanFilter(room.equipment.piano, appliedFilters.piano)) {
            return false
        }

        if (!matchesBooleanFilter(room.equipment.labStations, appliedFilters.labStations)) {
            return false
        }

        if (!matchesBooleanFilter(room.equipment.computers, appliedFilters.computers)) {
            return false
        }

        if (!matchesBooleanFilter(room.equipment.outlets, appliedFilters.outlets)) {
            return false
        }

        return true
    })
})

const formatBoolean = (value: boolean) => (value ? 'Yes' : 'No')
const retryLoad = () => loadRooms()
const applyFilters = () => {
    Object.assign(appliedFilters, filters)
}
const resetFilters = () => {
    Object.assign(filters, createDefaultFilters())
    Object.assign(appliedFilters, createDefaultFilters())
}

// Room creation form state
const showAddRoomModal = ref(false)
const isEditMode = ref(false)
const buildingCodeError = ref('')
const roomTypeValidationError = ref('')
const actionMessage = ref('')

interface NewRoomForm {
    buildingCode: string
    roomNumber: string
    displayName: string
    capacity: number | null
    roomType: string
    available: boolean
    equipment: RoomEquipment
}

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
        buildingCode: room.buildingCode,
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

const getStatusText = (available: boolean) => (available ? 'Available' : 'Unavailable')

const getStatusClass = (available: boolean) => {
    return available ? 'status-badge status-badge--available' : 'status-badge status-badge--unavailable'
}

const deleteRoom = async (room: Room) => {
    const shouldDelete = window.confirm(`Delete room ${room.buildingCode} ${room.roomNumber}?`)
    if (!shouldDelete) {
        return
    }

    actionMessage.value = 'Delete is not available yet on the backend. Add a DELETE /api/rooms route to enable it.'
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
        roomTypeValidationError.value = 'Lab stations require room type to be "Lab"'
    } else {
        roomTypeValidationError.value = ''
    }
}

const submitNewRoom = async () => {
    // Validate building code
    if (!validateBuildingCode()) {
        return
    }

    // Validate room type if lab stations selected
    if (newRoomForm.equipment.labStations && newRoomForm.roomType !== 'lab') {
        roomTypeValidationError.value = 'Lab stations require room type to be "Lab"'
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
        await loadRooms()
        closeAddRoomModal()
    } catch (e) {
        console.error('Failed to create room:', e)
        error.value = e as Error
    }
}
</script>

<style scoped>
:deep(.app-content) {
    width: 100%;
    margin: 0;
    padding: 0;
}

.room-viewer {
    display: grid;
    grid-template-columns: 350px 1fr;
    gap: 1rem;
    height: calc(100vh - 4rem);
    width: 100vw;
    margin-left: calc(-50vw + 50%);
    padding: 1rem;
}

.room-search {
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 1rem;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    min-height: 0;
    margin-bottom: 3rem;
}

.room-search h2 {
    margin-top: 0;
    flex-shrink: 0;
}

.room-content {
    display: flex;
    flex-direction: column;
    max-height: 100%;
    min-height: 0;
}

.filter-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    flex: 1;
}

.filter-grid label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.9rem;
}

.filter-grid input,
.filter-grid select {
    background-color: var(--color-surface-elevated);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    border-radius: 6px;
    min-height: 2.1rem;
    padding: 0.25rem 0.5rem;
}

.filter-grid input:focus-visible,
.filter-grid select:focus-visible {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: 2px;
}

.filter-actions {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex-shrink: 0;
}

.filter-results {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
}

.filter-actions button {
    width: 100%;
}

.action-message {
    margin: 0.6rem 0 0;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
}

.status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 88px;
    padding: 0.2rem 0.45rem;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 600;
    border: 1px solid transparent;
}

.status-badge--available {
    background-color: rgba(34, 197, 94, 0.16);
    color: #16a34a;
    border-color: rgba(34, 197, 94, 0.4);
}

.status-badge--unavailable {
    background-color: rgba(239, 68, 68, 0.16);
    color: #dc2626;
    border-color: rgba(239, 68, 68, 0.4);
}

.row-actions {
    white-space: nowrap;
}

.action-btn {
    border-radius: 6px;
    border: 1px solid var(--color-action-secondary-border);
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
    cursor: pointer;
    background: var(--color-action-secondary-bg);
    color: var(--color-action-secondary-text);
}

.action-btn + .action-btn {
    margin-left: 0.4rem;
}

.action-btn--edit:hover,
.action-btn--delete:hover {
    background: var(--color-action-secondary-bg-hover);
}

.add-room-fab {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background-color: var(--color-action-primary-bg);
    color: var(--color-action-primary-text);
    border: none;
    font-size: 2rem;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
    z-index: 40;
}

.add-room-fab:hover {
    background-color: var(--color-action-primary-bg-hover);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.add-room-fab:active {
    transform: scale(0.95);
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
}

.modal-content {
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-border);
}

.modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
}

.close-btn {
    background: none;
    border: none;
    color: var(--color-text-primary);
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.close-btn:hover {
    color: var(--color-text-secondary);
}

.room-form {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.form-group label {
    font-weight: 500;
    font-size: 0.9rem;
    color: var(--color-text-primary);
}

.form-group input[type="text"],
.form-group input[type="number"],
.form-group select {
    background-color: var(--color-surface-elevated);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    border-radius: 6px;
    padding: 0.5rem;
    font-size: 0.95rem;
}

.form-group input[type="text"]:focus,
.form-group input[type="number"]:focus,
.form-group select:focus {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: 2px;
}

.error-text {
    color: var(--color-text-danger);
    font-size: 0.85rem;
}

.checkbox-group {
    padding: 0.5rem 0;
}

.equipment-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-top: 0.5rem;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: normal;
    cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
    cursor: pointer;
    width: 18px;
    height: 18px;
}

.form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
}

.btn-primary,
.btn-secondary {
    padding: 0.5rem 1.5rem;
    border-radius: 6px;
    border: none;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.btn-primary {
    background-color: var(--color-action-primary-bg);
    color: var(--color-action-primary-text);
}

.btn-primary:hover {
    background-color: var(--color-action-primary-bg-hover);
}

.btn-secondary {
    background-color: var(--color-action-secondary-bg);
    color: var(--color-action-secondary-text);
    border: 1px solid var(--color-action-secondary-border);
}

.btn-secondary:hover {
    background-color: var(--color-action-secondary-bg-hover);
}

.table-container {
    overflow-x: auto;
    overflow-y: auto;
    height: 100%;
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    min-height: 0;
    margin-right: 3rem;
    margin-bottom: 3rem;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    border: 1px solid var(--color-border);
    padding: 0.5rem;
    text-align: left;
}

thead {
    background-color: var(--color-surface-elevated);
    position: sticky;
    top: 0;
}

.error-state {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

@media (max-width: 900px) {
    .room-viewer {
        grid-template-columns: 1fr;
    }
}
</style>