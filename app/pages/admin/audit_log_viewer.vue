<template>
  <div class="room-viewer">
    <div class="room-search">
      <h2>Filter Audit Logs</h2>
      <div class="filter-grid">
        <label>
          Action
          <input
            v-model="filters.action"
            type="text"
            placeholder="e.g. ROOM_DELETE"
          />
        </label>
        <label>
          Covenant ID
          <input
            v-model="filters.covenantId"
            type="text"
            placeholder="e.g. jsmith"
          />
        </label>
        <label>
          Collection
          <input
            v-model="filters.collectionName"
            type="text"
            placeholder="e.g. rooms"
          />
        </label>
        <label>
          Document ID
          <input
            v-model="filters.documentId"
            type="text"
            placeholder="Optional"
          />
        </label>
        <label>
          Detail
          <input
            v-model="filters.detail"
            type="text"
            placeholder="Search detail text"
          />
        </label>
        <label>
          IP Address
          <input
            v-model="filters.ipAddress"
            type="text"
            placeholder="Optional"
          />
        </label>
      </div>
      <div class="filter-actions">
        <button @click="applyFilters">Apply Filters</button>
        <button @click="resetFilters">Clear Filters</button>
        <p class="filter-results">
          Showing {{ filteredLogs.length }} of {{ auditLogs.length }} logs
        </p>
      </div>
    </div>
    <div class="room-content">
      <p v-if="pending">Loading audit logs...</p>
      <div v-else-if="error" class="error-state">
        <p>Unable to load audit logs.</p>
        <button @click="retryLoad">Retry</button>
      </div>
      <div v-else class="table-container">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Covenant ID</th>
              <th>Collection</th>
              <th>Document ID</th>
              <th>Detail</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in filteredLogs" :key="log._id">
              <td>{{ formatTimestamp(log.timestamp) }}</td>
              <td>{{ log.action }}</td>
              <td>{{ formatNullable(log.covenantId) }}</td>
              <td>{{ formatNullable(log.collectionName) }}</td>
              <td>{{ formatNullable(log.documentId) }}</td>
              <td>{{ log.detail }}</td>
              <td>{{ formatNullable(log.ipAddress) }}</td>
            </tr>
            <tr v-if="filteredLogs.length === 0">
              <td colspan="7">No audit logs found.</td>
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
  pageTitle: 'Audit Log Viewer',
})

interface AuditLogEntry {
  _id: string
  userId?: string | null
  covenantId?: string | null
  action: string
  collectionName?: string | null
  documentId?: string | null
  detail: string
  ipAddress?: string | null
  timestamp: string
}

interface AuditLogFilters {
  action: string
  covenantId: string
  collectionName: string
  documentId: string
  detail: string
  ipAddress: string
}

const auditLogs = ref<AuditLogEntry[]>([])
const pending = ref(false)
const error = ref<Error | null>(null)

const createDefaultFilters = (): AuditLogFilters => ({
  action: '',
  covenantId: '',
  collectionName: '',
  documentId: '',
  detail: '',
  ipAddress: '',
})

const filters = reactive<AuditLogFilters>(createDefaultFilters())
const appliedFilters = reactive<AuditLogFilters>(createDefaultFilters())

const includesInsensitive = (value: string, query: string) =>
  value.toLowerCase().includes(query.trim().toLowerCase())

const loadAuditLogs = async () => {
  pending.value = true
  error.value = null

  try {
    const fetchedLogs = await $fetch<AuditLogEntry[]>('/api/audit-logs', {
      headers: { 'x-dev-role': 'Admin' },
    })
    auditLogs.value = fetchedLogs
  } catch (loadError) {
    error.value = loadError as Error
  } finally {
    pending.value = false
  }
}

const retryLoad = () => loadAuditLogs()

const filteredLogs = computed(() => {
  return auditLogs.value.filter((log) => {
    if (appliedFilters.action && !includesInsensitive(log.action, appliedFilters.action)) {
      return false
    }

    if (
      appliedFilters.covenantId &&
      !includesInsensitive(log.covenantId ?? '', appliedFilters.covenantId)
    ) {
      return false
    }

    if (
      appliedFilters.collectionName &&
      !includesInsensitive(log.collectionName ?? '', appliedFilters.collectionName)
    ) {
      return false
    }

    if (
      appliedFilters.documentId &&
      !includesInsensitive(log.documentId ?? '', appliedFilters.documentId)
    ) {
      return false
    }

    if (appliedFilters.detail && !includesInsensitive(log.detail, appliedFilters.detail)) {
      return false
    }

    if (
      appliedFilters.ipAddress &&
      !includesInsensitive(log.ipAddress ?? '', appliedFilters.ipAddress)
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

const formatNullable = (value: string | null | undefined) => {
  if (!value) {
    return 'N/A'
  }

  return value
}

const formatTimestamp = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown'
  }

  return parsed.toLocaleString()
}

const { redirectToLogin, redirectToAdmin } = useDebugNavigation()

onMounted(loadAuditLogs)
</script>

<style src="~/assets/css/room-viewer.css"></style>

<style scoped>
:deep(.app-content) {
  width: 100%;
  margin: 0;
  padding: 0;
}
</style>
