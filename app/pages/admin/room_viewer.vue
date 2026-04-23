<template>
    <div class="room-viewer">
        <div class="top-bar">
            <h1>Room Viewer</h1>
        </div>
        <div class="main-content">
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
                            <th>Building</th>
                            <th>Room #</th>
                            <th>Name</th>
                            <th>Capacity</th>
                            <th>Type</th>
                            <th>Available</th>
                            <th>Projector</th>
                            <th>Smartboard</th>
                            <th>Whiteboard</th>
                            <th>Piano</th>
                            <th>Lab Stations</th>
                            <th>Computers</th>
                            <th>Outlets</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="room in filteredRooms" :key="`${room.buildingCode}-${room.roomNumber}`">
                            <td>{{ room.buildingCode }}</td>
                            <td>{{ room.roomNumber }}</td>
                            <td>{{ room.displayName }}</td>
                            <td>{{ room.capacity }}</td>
                            <td>{{ room.roomType }}</td>
                            <td>{{ formatBoolean(room.available) }}</td>
                            <td>{{ formatBoolean(room.equipment.projector) }}</td>
                            <td>{{ formatBoolean(room.equipment.smartboard) }}</td>
                            <td>{{ formatBoolean(room.equipment.whiteboard) }}</td>
                            <td>{{ formatBoolean(room.equipment.piano) }}</td>
                            <td>{{ formatBoolean(room.equipment.labStations) }}</td>
                            <td>{{ formatBoolean(room.equipment.computers) }}</td>
                            <td>{{ formatBoolean(room.equipment.outlets) }}</td>
                        </tr>
                        <tr v-if="filteredRooms.length === 0">
                            <td colspan="13">No rooms found.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
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
</script>

<style scoped>
.room-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.top-bar {
    width: 100%;
    padding: 1.5rem;
    background-color: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 1rem;
}

.top-bar h1 {
    margin: 0;
    font-size: 1.75rem;
}

.main-content {
    display: grid;
    grid-template-columns: 25% 75%;
    gap: 1rem;
    padding: 0 1rem 1rem 1rem;
    flex: 1;
    overflow: hidden;
}

.room-search {
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 1rem;
    height: fit-content;
}

.room-search h2 {
    margin-top: 0;
}

.filter-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
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
}

.filter-results {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
}

.filter-actions button {
    width: 100%;
}

.table-container {
    overflow-x: auto;
    overflow-y: auto;
    max-height: 600px;
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
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
    .main-content {
        grid-template-columns: 1fr;
    }

    .top-bar {
        padding: 1rem;
    }
}
</style>