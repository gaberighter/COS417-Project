<template>
    <div class="room-viewer">
        <h1>Room Viewer</h1>
        <div class="room-search">
            <p>Room search functionality goes here.</p>
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
                        <tr v-for="room in rooms" :key="`${room.buildingCode}-${room.roomNumber}`">
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
                        <tr v-if="rooms.length === 0">
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

const { data: rooms, pending, error, refresh } = await useFetch<Room[]>('/api/rooms', {
    default: () => []
})

const { redirectToLogin, redirectToAdmin } = useDebugNavigation()

const formatBoolean = (value: boolean) => (value ? 'Yes' : 'No')
const retryLoad = () => refresh()
</script>

<style scoped>
.table-container {
    overflow-x: auto;
    background-color: #fff;
    border: 1px solid #d0d7de;
    border-radius: 10px;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th,
td {
    border: 1px solid #d0d7de;
    padding: 0.5rem;
    text-align: left;
}

thead {
    background-color: #f6f8fa;
}

.error-state {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}
</style>