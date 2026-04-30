<template>
  <div class="schedule-viewer">
    <h1>Schedule Viewer</h1>
    <div class="schedule-list">
      <div v-if="scheduleError">Unable to load schedules.</div>
      <div v-else-if="schedulePending">Loading schedules...</div>
      <div v-else-if="scheduleItems.length === 0">No schedules available.</div>
      <div v-else class="term-dropdowns">
        <details
          v-for="term in termKeys"
          :key="term"
          class="term-dropdown"
          :open="term === termKeys[0]"
        >
          <summary>{{ term }}</summary>
          <div class="schedule-buttons">
            <button
              v-for="schedule in schedulesByTerm[term]"
              :key="schedule._id"
              @click="selectSchedule(schedule)"
            >
              {{ formatScheduleLabel(schedule) }}
            </button>
          </div>
        </details>
      </div>
    </div>
    <div class="schedule-content">
      <div v-if="!selectedScheduleId">Select a schedule to view details.</div>
      <div v-else-if="selectedSchedulePending">Loading schedule details...</div>
      <div v-else-if="selectedScheduleError">
        Unable to load schedule details.
      </div>
      <div v-else-if="selectedScheduleDetails" class="schedule-details">
        <div class="schedule-meta">
          <p><strong>Term:</strong> {{ selectedScheduleDetails.term }}</p>
          <p><strong>Run:</strong> {{ selectedScheduleDetails.runNumber }}</p>
          <p><strong>Status:</strong> {{ selectedScheduleDetails.status }}</p>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Professor</th>
                <th>Room</th>
                <th>Days</th>
                <th>Start</th>
                <th>End</th>
                <th>Override By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(assignment, index) in selectedAssignments"
                :key="`${assignment.courseId}-${assignment.roomId}-${index}`"
              >
                <td>{{ assignment.courseId }}</td>
                <td>
                  <span v-if="!isEditing(assignment)">
                    {{ formatProfessorName(assignment.professorId) }}
                  </span>
                  <input
                    v-else
                    v-model="editingDraft.professorId"
                    class="schedule-table-input"
                    type="text"
                    placeholder="firstname.lastname"
                  />
                </td>
                <td>
                  <span v-if="!isEditing(assignment)">
                    {{ assignment.roomId }}
                  </span>
                  <input
                    v-else
                    v-model="editingDraft.roomId"
                    class="schedule-table-input"
                    type="text"
                  />
                </td>
                <td>
                  <span v-if="!isEditing(assignment)">
                    {{ assignment.days }}
                  </span>
                  <select
                    v-else
                    v-model="editingDraft.days"
                    class="schedule-table-input"
                  >
                    <option
                      v-for="pattern in dayPatternOptions"
                      :key="pattern"
                      :value="pattern"
                    >
                      {{ pattern }}
                    </option>
                  </select>
                </td>
                <td>
                  <span v-if="!isEditing(assignment)">
                    {{ assignment.startTime }}
                  </span>
                  <input
                    v-else
                    v-model="editingDraft.startTime"
                    class="schedule-table-input"
                    type="text"
                    placeholder="09:00"
                  />
                </td>
                <td>
                  <span v-if="!isEditing(assignment)">
                    {{ assignment.endTime }}
                  </span>
                  <input
                    v-else
                    v-model="editingDraft.endTime"
                    class="schedule-table-input"
                    type="text"
                    placeholder="10:15"
                  />
                </td>
                <td>{{ formatOptionalValue(assignment.overrideBy) }}</td>
                <td class="row-actions">
                  <button
                    v-if="!isEditing(assignment)"
                    type="button"
                    class="action-btn action-btn--edit"
                    :disabled="editPending || editingCourseId !== null"
                    @click="startEdit(assignment)"
                  >
                    Edit
                  </button>
                  <button
                    v-if="!isEditing(assignment)"
                    type="button"
                    class="action-btn action-btn--delete"
                    :disabled="editPending || editingCourseId !== null"
                    @click="deleteAssignment(assignment)"
                  >
                    Delete
                  </button>
                  <template v-else>
                    <button
                      type="button"
                      class="action-btn action-btn--save"
                      :disabled="editPending"
                      @click="saveEdit"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      class="action-btn action-btn--cancel"
                      :disabled="editPending"
                      @click="cancelEdit"
                    >
                      Cancel
                    </button>
                  </template>
                </td>
              </tr>
              <tr v-if="selectedAssignments.length === 0">
                <td colspan="8">No classes in this schedule.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="actionMessage" class="action-message">{{ actionMessage }}</p>
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
  pageTitle: 'Schedule Viewer',
})

const { redirectToLogin, redirectToAdmin } = useDebugNavigation()

type ScheduleSummary = {
  _id: string
  term: string
  runNumber: number
  status: string
  createdAt?: string
}

type ScheduleDetails = ScheduleSummary & {
  createdBy: string
  assignments: {
    courseId: string
    professorId: string
    roomId: string
    days: string
    startTime: string
    endTime: string
    overrideBy?: string | null
  }[]
  conflicts: {
    courseId: string
    reason: string
    resolvedBy?: string | null
    resolvedAt?: string | null
  }[]
  updatedAt?: string
}

type ScheduleRunResponse = {
  schedules: ScheduleDetails[]
}

type Assignment = ScheduleDetails['assignments'][number]

const {
  data: schedules,
  pending: schedulePending,
  error: scheduleError,
} = useFetch<ScheduleSummary[]>('/api/schedule')

const scheduleItems = computed(() => schedules.value ?? [])
const schedulesByTerm = computed(() => {
  return scheduleItems.value.reduce<Record<string, ScheduleSummary[]>>(
    (acc, schedule) => {
      const termSchedules = acc[schedule.term] ?? (acc[schedule.term] = [])
      termSchedules.push(schedule)
      return acc
    },
    Object.create(null) as Record<string, ScheduleSummary[]>,
  )
})
const termKeys = computed(() =>
  Object.keys(schedulesByTerm.value).sort((a, b) => b.localeCompare(a)),
)
const selectedScheduleId = ref<string | null>(null)
const selectedScheduleDetails = ref<ScheduleDetails | null>(null)
const selectedSchedulePending = ref(false)
const selectedScheduleError = ref<unknown>(null)
const scheduleDetailsCache = new Map<string, ScheduleDetails>()
let latestScheduleRequest = 0

const editingCourseId = ref<string | null>(null)
const editPending = ref(false)
const actionMessage = ref('')
const editingDraft = reactive<Assignment>({
  courseId: '',
  professorId: '',
  roomId: '',
  days: 'MWF',
  startTime: '',
  endTime: '',
  overrideBy: null,
})

const dayPatternOptions: Assignment['days'][] = [
  'MWF',
  'TR',
  'MW',
  'MTWF',
  'MWRF',
  'W',
  'T',
  'R',
]

const selectedAssignments = computed(
  () => selectedScheduleDetails.value?.assignments ?? [],
)

async function selectSchedule(schedule: ScheduleSummary) {
  const requestId = ++latestScheduleRequest
  selectedScheduleId.value = schedule._id
  selectedScheduleError.value = null

  const cachedSchedule = scheduleDetailsCache.get(schedule._id)
  if (cachedSchedule) {
    selectedScheduleDetails.value = cachedSchedule
    selectedSchedulePending.value = false
    return
  }

  selectedScheduleDetails.value = null
  selectedSchedulePending.value = true

  try {
    const response = await $fetch<ScheduleRunResponse>(
      `/api/schedule/${encodeURIComponent(schedule.term)}/all`,
    )
    const details =
      response.schedules.find((item) => item._id === schedule._id) ??
      response.schedules.find(
        (item) => item.runNumber === schedule.runNumber,
      ) ??
      null

    if (requestId !== latestScheduleRequest) return
    selectedScheduleDetails.value = details
    if (details) scheduleDetailsCache.set(schedule._id, details)
  } catch (error) {
    if (requestId !== latestScheduleRequest) return
    selectedScheduleError.value = error
  } finally {
    if (requestId === latestScheduleRequest) {
      selectedSchedulePending.value = false
    }
  }
}

function formatScheduleLabel(schedule: ScheduleSummary) {
  return `${schedule.term} - Run ${schedule.runNumber} (${schedule.status})`
}

function formatOptionalValue(value?: string | null) {
  return value && value.trim().length > 0 ? value : 'N/A'
}

function formatProfessorName(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 'Unknown'
  const parts = trimmed.split(/[.\s_]+/).filter(Boolean)
  const formatted = parts.map((part) =>
    part.length > 1
      ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`
      : part.toUpperCase(),
  )
  return formatted.join(' ')
}

function isEditing(assignment: Assignment) {
  return editingCourseId.value === assignment.courseId
}

function startEdit(assignment: Assignment) {
  editingCourseId.value = assignment.courseId
  actionMessage.value = ''
  Object.assign(editingDraft, assignment)
}

function cancelEdit() {
  editingCourseId.value = null
}

function validateAssignmentDraft() {
  const requiredFields: Array<[string, string]> = [
    ['courseId', editingCourseId.value ?? ''],
    ['professor', editingDraft.professorId],
    ['room', editingDraft.roomId],
    ['days', editingDraft.days],
    ['start time', editingDraft.startTime],
    ['end time', editingDraft.endTime],
  ]

  const missing = requiredFields.find(([, value]) => !value?.trim())
  if (missing) {
    return `Please enter a ${missing[0]} before saving.`
  }

  if (!dayPatternOptions.includes(editingDraft.days)) {
    return 'Please select a valid day pattern.'
  }

  return ''
}

async function saveEdit() {
  if (!selectedScheduleDetails.value || !editingCourseId.value) return
  editPending.value = true
  actionMessage.value = ''
  const schedule = selectedScheduleDetails.value
  const validationMessage = validateAssignmentDraft()
  if (validationMessage) {
    actionMessage.value = validationMessage
    editPending.value = false
    return
  }
  const updatedAssignments = schedule.assignments.map((assignment) =>
    assignment.courseId === editingCourseId.value
      ? {
          ...assignment,
          ...editingDraft,
          courseId: editingCourseId.value,
        }
      : assignment,
  )

  try {
    const updatedSchedule = await $fetch<ScheduleDetails>(
      `/api/schedule/${encodeURIComponent(schedule.term)}`,
      {
        method: 'PATCH',
        body: {
          runNumber: schedule.runNumber,
          assignments: updatedAssignments,
        },
      },
    )

    selectedScheduleDetails.value = updatedSchedule
    scheduleDetailsCache.set(updatedSchedule._id, updatedSchedule)
    actionMessage.value = 'Assignment updated.'
    editingCourseId.value = null
  } catch (error) {
    actionMessage.value = 'Unable to update assignment.'
    selectedScheduleError.value = error
  } finally {
    editPending.value = false
  }
}

async function deleteAssignment(assignment: Assignment) {
  if (!selectedScheduleDetails.value) return
  const shouldDelete = window.confirm(
    `Delete assignment for ${assignment.courseId}?`,
  )
  if (!shouldDelete) return

  editPending.value = true
  actionMessage.value = ''
  const schedule = selectedScheduleDetails.value
  const updatedAssignments = schedule.assignments.filter(
    (item) => item.courseId !== assignment.courseId,
  )

  try {
    const updatedSchedule = await $fetch<ScheduleDetails>(
      `/api/schedule/${encodeURIComponent(schedule.term)}`,
      {
        method: 'PATCH',
        body: {
          runNumber: schedule.runNumber,
          assignments: updatedAssignments,
        },
      },
    )

    selectedScheduleDetails.value = updatedSchedule
    scheduleDetailsCache.set(updatedSchedule._id, updatedSchedule)
    actionMessage.value = 'Assignment deleted.'
  } catch (error) {
    actionMessage.value = 'Unable to delete assignment.'
    selectedScheduleError.value = error
  } finally {
    editPending.value = false
  }
}
</script>

<style>
.schedule-viewer {
  max-width: 1000px;
  margin: 0 auto;
  padding: 16px;
  min-height: calc(100vh - 4rem);
  display: flex;
  flex-direction: column;
}

.schedule-list {
  margin-top: 1rem;
}

.schedule-content {
  flex: 1;
  min-height: 0;
}

.term-dropdowns {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  margin: 1rem 0 1.5rem;
}

.term-dropdown {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 0.4rem 0.8rem;
  min-width: min(220px, 100%);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.15);
}

.term-dropdown > summary {
  list-style: none;
  cursor: pointer;
  font-weight: 600;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.term-dropdown > summary::after {
  content: '▾';
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  transition: transform 0.2s ease;
}

.term-dropdown > summary::-webkit-details-marker {
  display: none;
}

.term-dropdown[open] {
  background-color: var(--color-surface-elevated);
}

.term-dropdown[open] > summary::after {
  transform: rotate(-180deg);
}

.schedule-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.6rem;
}

.schedule-buttons button {
  text-align: left;
  border-radius: 10px;
  padding: 0.65rem 0.85rem;
  font-weight: 600;
  box-shadow: 0 8px 16px rgba(0, 51, 153, 0.12);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease;
}

.schedule-buttons button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 20px rgba(0, 51, 153, 0.16);
}

.schedule-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
  min-height: 0;
}

.schedule-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  color: var(--color-text-secondary);
}

.schedule-meta p {
  margin: 0;
}

.table-container {
  overflow-x: auto;
  overflow-y: auto;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  max-height: min(60vh, 520px);
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
  z-index: 1;
}

.row-actions {
  white-space: nowrap;
}

.action-btn {
  padding: 0.35rem 0.65rem;
  font-size: 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--color-action-secondary-border);
  background: var(--color-action-secondary-bg);
  color: var(--color-action-secondary-text);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn + .action-btn {
  margin-left: 0.4rem;
}

.action-btn:hover {
  background: var(--color-action-secondary-bg-hover);
  transform: translateY(-1px);
}

.action-btn--delete {
  border-color: rgba(239, 68, 68, 0.4);
  color: #ef4444;
}

.action-btn--delete:hover {
  background: rgba(239, 68, 68, 0.12);
}

.action-btn--save {
  border-color: rgba(34, 197, 94, 0.4);
  color: #22c55e;
}

.action-btn--save:hover {
  background: rgba(34, 197, 94, 0.12);
}

.action-btn--cancel {
  border-color: rgba(148, 163, 184, 0.6);
  color: var(--color-text-secondary);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.schedule-table-input {
  width: 100%;
  background-color: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  border-radius: 6px;
  padding: 0.35rem 0.45rem;
  font-size: 0.9rem;
}

.schedule-table-input:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.action-message {
  margin: 0.6rem 0 0;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

@media (max-width: 640px) {
  .term-dropdown {
    width: 100%;
  }

  .schedule-meta {
    flex-direction: column;
    gap: 0.35rem;
  }
}
</style>
