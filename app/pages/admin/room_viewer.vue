<template>
  <div class="room-viewer">
    <div class="room-search">
      <h2>Filter Rooms</h2>
      <div class="filter-grid">
        <label>
          Building Code
          <input
            v-model="filters.buildingCode"
            type="text"
            placeholder="e.g. SCI"
          />
        </label>
        <label>
          Room Number
          <input
            v-model="filters.roomNumber"
            type="text"
            placeholder="e.g. 101"
          />
        </label>
        <label>
          Display Name
          <input
            v-model="filters.displayName"
            type="text"
            placeholder="e.g. Physics Lab"
          />
        </label>
        <label>
          Room Type
          <select v-model="filters.roomType">
            <option value="">Any</option>
            <option v-for="type in roomTypeOptions" :key="type" :value="type">
              {{ type }}
            </option>
          </select>
        </label>
        <label>
          Capacity (Min)
          <input
            v-model.number="filters.capacityMin"
            type="number"
            min="0"
            placeholder="No minimum"
          />
        </label>
        <label>
          Capacity (Max)
          <input
            v-model.number="filters.capacityMax"
            type="number"
            min="0"
            placeholder="No maximum"
          />
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
        <p class="filter-results">
          Showing {{ filteredRooms.length }} of {{ rooms.length }} rooms
        </p>
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
            <tr
              v-for="room in filteredRooms"
              :key="`${room.buildingCode}-${room.roomNumber}`"
            >
              <td>{{ room.displayName }}</td>
              <td>{{ room.capacity }}</td>
              <td>{{ room.roomType }}</td>
              <td>
                <span :class="getStatusClass(room.available)">{{
                  getStatusText(room.available)
                }}</span>
              </td>
              <td>{{ formatBoolean(room.equipment.projector) }}</td>
              <td>{{ formatBoolean(room.equipment.smartboard) }}</td>
              <td>{{ formatBoolean(room.equipment.whiteboard) }}</td>
              <td>{{ formatBoolean(room.equipment.piano) }}</td>
              <td>{{ formatBoolean(room.equipment.labStations) }}</td>
              <td>{{ formatBoolean(room.equipment.computers) }}</td>
              <td>{{ formatBoolean(room.equipment.outlets) }}</td>
              <td class="row-actions">
                <button
                  type="button"
                  class="action-btn action-btn--edit"
                  @click="openEditRoomModal(room)"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="action-btn action-btn--delete"
                  @click="deleteRoom(room)"
                >
                  Delete
                </button>
              </td>
            </tr>
            <tr v-if="filteredRooms.length === 0">
              <td colspan="12">No rooms found.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="statusMessage" class="action-message">{{ statusMessage }}</p>
    </div>
  </div>
  <button class="add-room-fab" @click="openAddRoomModal" title="Add New Room">
    +
  </button>
  <div
    v-if="showAddRoomModal"
    class="modal-overlay"
    @click.self="closeAddRoomModal"
  >
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
          <span v-if="buildingCodeError" class="error-text">{{
            buildingCodeError
          }}</span>
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
          <span v-if="roomTypeValidationError" class="error-text">{{
            roomTypeValidationError
          }}</span>
        </div>
        <div class="form-group checkbox-group">
          <label>Equipment</label>
          <div class="equipment-grid">
            <label class="checkbox-label">
              <input
                v-model="newRoomForm.equipment.projector"
                type="checkbox"
              />
              Projector
            </label>
            <label class="checkbox-label">
              <input
                v-model="newRoomForm.equipment.smartboard"
                type="checkbox"
              />
              Smartboard
            </label>
            <label class="checkbox-label">
              <input
                v-model="newRoomForm.equipment.whiteboard"
                type="checkbox"
              />
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
              <input
                v-model="newRoomForm.equipment.computers"
                type="checkbox"
              />
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
          <button
            type="button"
            class="btn-secondary"
            @click="closeAddRoomModal"
          >
            Cancel
          </button>
          <button type="submit" class="btn-primary">
            {{ isEditMode ? 'Save Changes' : 'Create Room' }}
          </button>
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
import { useRoomCRUD } from '~/composables/useRoomCRUD'
import { useRoomFilters } from '~/composables/useRoomFilters'
import { useRoomForm } from '~/composables/useRoomForm'

definePageMeta({
  pageTitle: 'Room Viewer',
})

// Composables
const { rooms, pending, error, loadRooms, retryLoad, deleteRoom, deleteMessage } =
  useRoomCRUD()
const {
  filters,
  appliedFilters,
  filteredRooms,
  roomTypeOptions,
  applyFilters,
  resetFilters,
} = useRoomFilters(rooms)
const {
  showAddRoomModal,
  isEditMode,
  buildingCodeError,
  roomTypeValidationError,
  actionMessage,
  newRoomForm,
  openAddRoomModal,
  openEditRoomModal,
  closeAddRoomModal,
  submitNewRoom,
  validateRoomTypeForLabStations,
} = useRoomForm(loadRooms)

const statusMessage = computed(() => deleteMessage.value || actionMessage.value)

// Navigation
const { redirectToLogin, redirectToAdmin } = useDebugNavigation()

// Lifecycle
onMounted(loadRooms)

// Utilities
const formatBoolean = (value: boolean) => (value ? 'Yes' : 'No')

const getStatusText = (available: boolean) =>
  available ? 'Available' : 'Unavailable'

const getStatusClass = (available: boolean) => {
  return available
    ? 'status-badge status-badge--available'
    : 'status-badge status-badge--unavailable'
}
</script>

<style src="~/assets/css/room-viewer.css"></style>

<style scoped>
:deep(.app-content) {
  width: 100%;
  margin: 0;
  padding: 0;
}
</style>
