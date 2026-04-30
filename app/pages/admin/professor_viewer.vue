<template>
  <div class="room-viewer">
    <div class="room-search">
      <h2>Filter Professors</h2>
      <div class="filter-grid">
        <label>
          Covenant ID
          <input
            v-model="filters.covenantId"
            type="text"
            placeholder="e.g. jsmith"
          />
        </label>
        <label>
          Display Name
          <input
            v-model="filters.displayName"
            type="text"
            placeholder="e.g. Jane Smith"
          />
        </label>
        <label>
          Department
          <input
            v-model="filters.departmentCode"
            type="text"
            placeholder="e.g. COS"
          />
        </label>
        <label>
          Office Building
          <input
            v-model="filters.officeBuilding"
            type="text"
            placeholder="e.g. Friend Center"
          />
        </label>
        <label>
          Office Room
          <input
            v-model="filters.officeRoom"
            type="text"
            placeholder="e.g. 123"
          />
        </label>
        <label>
          Active
          <select v-model="filters.active">
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
          Showing {{ filteredProfessors.length }} of
          {{ professors.length }} professors
        </p>
      </div>
    </div>
    <div class="room-content">
      <p v-if="pending">Loading professors...</p>
      <div v-else-if="error" class="error-state">
        <p>Unable to load professor catalog.</p>
        <button @click="retryLoad">Retry</button>
      </div>
      <div v-else class="table-container">
        <table>
          <thead>
            <tr>
              <th>Covenant ID</th>
              <th>Name</th>
              <th>Department</th>
              <th>Office Building</th>
              <th>Office Room</th>
              <th>Seniority</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="professor in filteredProfessors" :key="professor._id">
              <td>{{ professor.covenantId }}</td>
              <td>{{ professor.displayName }}</td>
              <td>{{ professor.departmentCode }}</td>
              <td>{{ formatNullable(professor.officeBuilding) }}</td>
              <td>{{ formatNullable(professor.officeRoom) }}</td>
              <td>{{ formatNullable(professor.seniorityYear) }}</td>
              <td>
                <span :class="getStatusClass(professor.active)">
                  {{ getStatusText(professor.active) }}
                </span>
              </td>
              <td class="row-actions">
                <button
                  type="button"
                  class="action-btn action-btn--edit"
                  @click="openEditProfessorModal(professor)"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="action-btn action-btn--delete"
                  @click="deleteProfessor(professor)"
                >
                  Delete
                </button>
              </td>
            </tr>
            <tr v-if="filteredProfessors.length === 0">
              <td colspan="8">No professors found.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="statusMessage" class="action-message">{{ statusMessage }}</p>
    </div>
  </div>
  <button
    class="add-room-fab"
    @click="openAddProfessorModal"
    title="Add New Professor"
  >
    +
  </button>
  <div
    v-if="showProfessorModal"
    class="modal-overlay"
    @click.self="closeProfessorModal"
  >
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ isEditMode ? 'Edit Professor' : 'Add New Professor' }}</h2>
        <button class="close-btn" @click="closeProfessorModal">✕</button>
      </div>
      <form @submit.prevent="submitProfessor" class="room-form">
        <div class="form-group">
          <label for="covenantId">Covenant ID *</label>
          <input
            id="covenantId"
            v-model="professorForm.covenantId"
            type="text"
            placeholder="e.g. jsmith"
            :disabled="isEditMode"
            required
          />
        </div>
        <div class="form-group">
          <label for="displayName">Display Name *</label>
          <input
            id="displayName"
            v-model="professorForm.displayName"
            type="text"
            placeholder="e.g. Jane Smith"
            required
          />
        </div>
        <div class="form-group">
          <label for="departmentCode">Department Code *</label>
          <input
            id="departmentCode"
            v-model="professorForm.departmentCode"
            type="text"
            placeholder="e.g. COS"
            maxlength="4"
            required
          />
        </div>
        <div class="form-group">
          <label for="officeBuilding">Office Building</label>
          <input
            id="officeBuilding"
            v-model="professorForm.officeBuilding"
            type="text"
            placeholder="e.g. Friend Center"
          />
        </div>
        <div class="form-group">
          <label for="officeRoom">Office Room</label>
          <input
            id="officeRoom"
            v-model="professorForm.officeRoom"
            type="text"
            placeholder="e.g. 123"
          />
        </div>
        <div class="form-group">
          <label for="seniorityYear">Seniority Year</label>
          <input
            id="seniorityYear"
            v-model.number="professorForm.seniorityYear"
            type="number"
            min="0"
            placeholder="Optional"
          />
        </div>
        <div class="form-group checkbox-group">
          <label class="checkbox-label">
            <input v-model="professorForm.active" type="checkbox" />
            Active
          </label>
        </div>
        <div class="form-actions">
          <button
            type="button"
            class="btn-secondary"
            @click="closeProfessorModal"
          >
            Cancel
          </button>
          <button type="submit" class="btn-primary">
            {{ isEditMode ? 'Save Changes' : 'Create Professor' }}
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
definePageMeta({
  pageTitle: 'Professor Viewer',
})

type BooleanFilter = 'any' | 'true' | 'false'

interface Professor {
  _id: string
  covenantId: string
  displayName: string
  departmentCode: string
  officeBuilding?: string | null
  officeRoom?: string | null
  seniorityYear?: number | null
  active: boolean
}

interface ProfessorFilters {
  covenantId: string
  displayName: string
  departmentCode: string
  officeBuilding: string
  officeRoom: string
  active: BooleanFilter
}

interface ProfessorForm {
  covenantId: string
  displayName: string
  departmentCode: string
  officeBuilding: string
  officeRoom: string
  seniorityYear: number | null
  active: boolean
}

const professors = ref<Professor[]>([])
const pending = ref(false)
const error = ref<Error | null>(null)
const deleteMessage = ref('')
const actionMessage = ref('')
const showProfessorModal = ref(false)
const isEditMode = ref(false)

const createDefaultFilters = (): ProfessorFilters => ({
  covenantId: '',
  displayName: '',
  departmentCode: '',
  officeBuilding: '',
  officeRoom: '',
  active: 'any',
})

const createEmptyProfessorForm = (): ProfessorForm => ({
  covenantId: '',
  displayName: '',
  departmentCode: '',
  officeBuilding: '',
  officeRoom: '',
  seniorityYear: null,
  active: true,
})

const filters = reactive<ProfessorFilters>(createDefaultFilters())
const appliedFilters = reactive<ProfessorFilters>(createDefaultFilters())
const professorForm = reactive<ProfessorForm>(createEmptyProfessorForm())

const includesInsensitive = (value: string, query: string) =>
  value.toLowerCase().includes(query.trim().toLowerCase())

const matchesBooleanFilter = (value: boolean, filter: BooleanFilter) => {
  if (filter === 'any') {
    return true
  }

  return filter === 'true' ? value : !value
}

const loadProfessors = async () => {
  pending.value = true
  error.value = null

  try {
    const fetchedProfessors = await $fetch<Professor[]>('/api/professors', {
      query: { includeInactive: 'true' },
      headers: { 'x-dev-role': 'Admin' },
    })
    professors.value = fetchedProfessors
  } catch (loadError) {
    error.value = loadError as Error
  } finally {
    pending.value = false
  }
}

const retryLoad = () => loadProfessors()

const filteredProfessors = computed(() => {
  return professors.value.filter((professor) => {
    if (
      appliedFilters.covenantId &&
      !includesInsensitive(professor.covenantId, appliedFilters.covenantId)
    ) {
      return false
    }

    if (
      appliedFilters.displayName &&
      !includesInsensitive(professor.displayName, appliedFilters.displayName)
    ) {
      return false
    }

    if (
      appliedFilters.departmentCode &&
      !includesInsensitive(
        professor.departmentCode,
        appliedFilters.departmentCode,
      )
    ) {
      return false
    }

    if (
      appliedFilters.officeBuilding &&
      !includesInsensitive(
        professor.officeBuilding ?? '',
        appliedFilters.officeBuilding,
      )
    ) {
      return false
    }

    if (
      appliedFilters.officeRoom &&
      !includesInsensitive(
        professor.officeRoom ?? '',
        appliedFilters.officeRoom,
      )
    ) {
      return false
    }

    if (!matchesBooleanFilter(professor.active, appliedFilters.active)) {
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

const openAddProfessorModal = () => {
  isEditMode.value = false
  Object.assign(professorForm, createEmptyProfessorForm())
  actionMessage.value = ''
  showProfessorModal.value = true
}

const openEditProfessorModal = (professor: Professor) => {
  isEditMode.value = true
  actionMessage.value = ''
  Object.assign(professorForm, {
    covenantId: professor.covenantId,
    displayName: professor.displayName,
    departmentCode: professor.departmentCode,
    officeBuilding: professor.officeBuilding ?? '',
    officeRoom: professor.officeRoom ?? '',
    seniorityYear: professor.seniorityYear ?? null,
    active: professor.active,
  })
  showProfessorModal.value = true
}

const closeProfessorModal = () => {
  showProfessorModal.value = false
  isEditMode.value = false
  Object.assign(professorForm, createEmptyProfessorForm())
}

const normalizeOptionalString = (value: string) => {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const normalizeOptionalNumber = (value: number | null) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const submitProfessor = async () => {
  try {
    await $fetch('/api/professors', {
      method: 'POST',
      body: {
        covenantId: professorForm.covenantId.trim().toLowerCase(),
        displayName: professorForm.displayName.trim(),
        departmentCode: professorForm.departmentCode.trim().toUpperCase(),
        officeBuilding: normalizeOptionalString(professorForm.officeBuilding),
        officeRoom: normalizeOptionalString(professorForm.officeRoom),
        seniorityYear: normalizeOptionalNumber(professorForm.seniorityYear),
        active: professorForm.active,
      },
      headers: { 'x-dev-role': 'Admin' },
    })
    actionMessage.value = isEditMode.value
      ? 'Professor updated.'
      : 'Professor created.'
    await loadProfessors()
    closeProfessorModal()
  } catch (saveError) {
    console.error('Failed to save professor:', saveError)
    actionMessage.value =
      saveError instanceof Error && saveError.message
        ? `Failed to save professor: ${saveError.message}`
        : 'Failed to save professor.'
  }
}

const deleteProfessor = async (professor: Professor) => {
  deleteMessage.value = ''

  const shouldDelete = window.confirm(
    `Delete professor ${professor.displayName} (${professor.covenantId})?`,
  )
  if (!shouldDelete) {
    return
  }

  try {
    await $fetch(`/api/professors/${encodeURIComponent(professor._id)}`, {
      method: 'DELETE',
      headers: { 'x-dev-role': 'Admin' },
    })
    deleteMessage.value = 'Professor deleted.'
    await loadProfessors()
  } catch (deleteError) {
    console.error('Failed to delete professor:', deleteError)
    deleteMessage.value = 'Failed to delete professor. Please try again.'
  }
}

const statusMessage = computed(() => deleteMessage.value || actionMessage.value)

const formatNullable = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return String(value)
}

const getStatusText = (active: boolean) => (active ? 'Active' : 'Inactive')

const getStatusClass = (active: boolean) => {
  return active
    ? 'status-badge status-badge--available'
    : 'status-badge status-badge--unavailable'
}

const { redirectToLogin, redirectToAdmin } = useDebugNavigation()

onMounted(loadProfessors)
</script>

<style src="~/assets/css/room-viewer.css"></style>

<style scoped>
:deep(.app-content) {
  width: 100%;
  margin: 0;
  padding: 0;
}
</style>
