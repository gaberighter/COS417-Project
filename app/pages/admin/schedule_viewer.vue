<template>
  <div class="schedule-history-page">
    <div class="schedule-history-page-header">
      <h1 class="schedule-history-page-header__title">Schedule Viewer</h1>
      <Button
        label="Create New Schedule"
        severity="secondary"
        outlined
        @click="navigateTo('/admin/schedule_run')"
      />
    </div>

    <Message
      v-if="statusMessage"
      :severity="statusSeverity"
      :closable="false"
      class="schedule-history-message"
    >
      {{ statusMessage }}
    </Message>

    <div class="schedule-history-layout">
      <Card class="schedule-history-sidebar">
        <template #header>
          <div class="schedule-history-card-header">
            <div>
              <h2 class="schedule-history-card-header__title">
                Saved Schedule Versions
              </h2>
            </div>
          </div>
        </template>

        <template #content>
          <div v-if="schedulePending" class="schedule-history-empty">
            <ProgressSpinner
              strokeWidth="4"
              fill="transparent"
              animationDuration=".9s"
              aria-label="Loading schedules"
            />
            <span>Loading saved schedule history...</span>
          </div>

          <div
            v-else-if="scheduleItems.length === 0"
            class="schedule-history-empty"
          >
            <span>No saved schedules yet.</span>
          </div>

          <div v-else class="schedule-term-list">
            <details
              v-for="termKey in termKeys"
              :key="termKey"
              class="schedule-term-group"
              :open="termKey === selectedTerm || termKey === termKeys[0]"
            >
              <summary>{{ termKey }}</summary>
              <div
                v-if="(schedulesByTerm[termKey] ?? []).length === 0"
                class="schedule-term-group__empty"
              >
                No saved runs yet for this term.
              </div>
              <div v-else class="schedule-term-group__items">
                <button
                  v-for="schedule in schedulesByTerm[termKey]"
                  :key="schedule._id"
                  type="button"
                  class="schedule-run-button"
                  :class="{
                    'schedule-run-button--active':
                      schedule._id === selectedScheduleId,
                  }"
                  @click="selectSchedule(schedule)"
                >
                  <strong>Run {{ schedule.runNumber }}</strong>
                  <span>{{ schedule.status }}</span>
                  <small v-if="(schedule.assignmentCount ?? 0) === 0">
                    No assignments saved in this run
                  </small>
                  <small>
                    {{
                      formatDateTime(schedule.updatedAt || schedule.createdAt)
                    }}
                  </small>
                </button>
              </div>
            </details>
          </div>
        </template>
      </Card>

      <div class="schedule-history-main">
        <Card class="schedule-history-main-card">
          <template #header>
            <div class="schedule-history-card-header">
              <div>
                <h2 class="schedule-history-card-header__title">
                  {{ selectedScheduleTitle }}
                </h2>
              </div>
              <div class="schedule-history-card-header__actions">
                <Tag
                  v-if="!selectedSchedule"
                  value="No run selected"
                  severity="secondary"
                  rounded
                />
                <Tag
                  v-if="selectedSchedule"
                  :value="selectedSchedule.status"
                  :severity="selectedStatusSeverity"
                  rounded
                />
                <Tag
                  v-if="selectedSchedule?.approvedAt"
                  value="Approved"
                  severity="success"
                  rounded
                />
                <Tag
                  v-if="selectedSchedule?.status === 'exported'"
                  value="Exported"
                  severity="contrast"
                  rounded
                />
              </div>
            </div>
          </template>

          <template #content>
            <div v-if="selectedSchedulePending" class="schedule-history-empty">
              <ProgressSpinner
                strokeWidth="4"
                fill="transparent"
                animationDuration=".9s"
                aria-label="Loading selected schedule"
              />
              <span>Loading schedule details...</span>
            </div>

            <div v-else-if="!selectedSchedule" class="schedule-history-empty">
              <span>Select a saved run to view its schedule.</span>
            </div>

            <div v-else class="schedule-history-stack">
              <div class="schedule-meta-grid">
                <div class="schedule-meta-card">
                  <span class="schedule-meta-card__label">Created</span>
                  <strong>{{
                    formatDateTime(selectedSchedule.createdAt)
                  }}</strong>
                </div>
                <div class="schedule-meta-card">
                  <span class="schedule-meta-card__label">Updated</span>
                  <strong>{{
                    formatDateTime(selectedSchedule.updatedAt)
                  }}</strong>
                </div>
                <div class="schedule-meta-card">
                  <span class="schedule-meta-card__label">Approved</span>
                  <strong>
                    {{
                      selectedSchedule.approvedAt
                        ? formatDateTime(selectedSchedule.approvedAt)
                        : 'Not approved'
                    }}
                  </strong>
                </div>
                <div class="schedule-meta-card">
                  <span class="schedule-meta-card__label">Conflicts</span>
                  <strong>{{ selectedSchedule.conflicts.length }}</strong>
                </div>
                <div class="schedule-meta-card">
                  <span class="schedule-meta-card__label">Warnings</span>
                  <strong>{{ selectedSchedule.warnings.length }}</strong>
                </div>
                <div class="schedule-meta-card">
                  <span class="schedule-meta-card__label">Near-Hard Flags</span>
                  <strong>{{ selectedSchedule.nearHardFlags.length }}</strong>
                </div>
                <div class="schedule-meta-card">
                  <span class="schedule-meta-card__label">Recommended</span>
                  <strong>{{ selectedRecommendedStatus }}</strong>
                </div>
                <div class="schedule-meta-card">
                  <span class="schedule-meta-card__label">Trace Entries</span>
                  <strong>{{ selectedSchedule.traces.length }}</strong>
                </div>
              </div>

              <Message
                v-if="isSelectedScheduleLocked"
                severity="info"
                :closable="false"
              >
                This run is locked because it is approved or exported. Reopen it
                to enable overrides.
              </Message>

              <div class="schedule-history-actions">
                <Button
                  v-if="canApproveSelectedSchedule"
                  label="Approve"
                  severity="success"
                  outlined
                  :loading="statusPending"
                  @click="approveSelectedSchedule"
                />
                <Button
                  v-if="canReopenSelectedSchedule"
                  label="Reopen"
                  severity="warn"
                  outlined
                  :loading="statusPending"
                  @click="reopenSelectedSchedule"
                />
                <Button
                  v-if="canExportSelectedSchedule"
                  label="Export CSV"
                  severity="contrast"
                  outlined
                  :loading="exportPending"
                  @click="exportSelectedSchedule('csv')"
                />
                <Button
                  v-if="canExportSelectedSchedule"
                  label="Export Excel"
                  severity="contrast"
                  :loading="exportPending"
                  @click="exportSelectedSchedule('xlsx')"
                />
              </div>

              <div class="schedule-filter-grid">
                <label>
                  Global Search
                  <InputText
                    v-model="filters.search"
                    placeholder="Course, title, room, instructor..."
                    fluid
                  />
                </label>
                <div class="schedule-filter-grid__actions">
                  <Button
                    label="Clear Search"
                    severity="secondary"
                    outlined
                    :disabled="!filters.search"
                    @click="filters.search = ''"
                  />
                  <span class="schedule-filter-grid__count">
                    Showing {{ filteredRows.length }} of
                    {{ enrichedRows.length }} row(s)
                  </span>
                </div>
              </div>

              <details class="schedule-detail-block">
                <summary>Show optional filters</summary>
                <div class="schedule-detail-block__content">
                  <div
                    class="schedule-filter-grid schedule-filter-grid--advanced"
                  >
                    <label>
                      Department
                      <select
                        v-model="filters.department"
                        class="schedule-native-select"
                      >
                        <option value="">All</option>
                        <option
                          v-for="department in departmentOptions"
                          :key="department"
                          :value="department"
                        >
                          {{ department }}
                        </option>
                      </select>
                    </label>
                    <label>
                      Instructor
                      <select
                        v-model="filters.instructor"
                        class="schedule-native-select"
                      >
                        <option value="">All</option>
                        <option
                          v-for="instructor in instructorOptions"
                          :key="instructor"
                          :value="instructor"
                        >
                          {{ instructor }}
                        </option>
                      </select>
                    </label>
                    <label>
                      Building
                      <select
                        v-model="filters.building"
                        class="schedule-native-select"
                      >
                        <option value="">All</option>
                        <option
                          v-for="building in buildingOptions"
                          :key="building"
                          :value="building"
                        >
                          {{ building }}
                        </option>
                      </select>
                    </label>
                    <label>
                      Room
                      <select
                        v-model="filters.room"
                        class="schedule-native-select"
                      >
                        <option value="">All</option>
                        <option
                          v-for="room in roomOptions"
                          :key="room"
                          :value="room"
                        >
                          {{ room }}
                        </option>
                      </select>
                    </label>
                  </div>
                  <div class="schedule-detail-block__actions">
                    <Button
                      label="Reset All Filters"
                      severity="secondary"
                      outlined
                      :disabled="!hasActiveFilters"
                      @click="resetFilters"
                    />
                  </div>
                </div>
              </details>

              <DataTable
                :value="filteredRows"
                stripedRows
                scrollable
                showGridlines
                tableStyle="min-width: 88rem"
                class="schedule-table"
              >
                <template #empty>
                  <div class="schedule-table-empty">
                    No schedule rows match the current filters.
                  </div>
                </template>
                <Column field="department" header="Dept" sortable />
                <Column field="courseNumber" header="Course" sortable />
                <Column field="section" header="Section" sortable>
                  <template #body="{ data }">
                    {{ data.section || 'N/A' }}
                  </template>
                </Column>
                <Column field="courseTitle" header="Title" sortable />
                <Column field="instructorName" header="Instructor" sortable>
                  <template #body="{ data }">
                    <span v-if="!isEditingRow(data.courseId)">{{
                      data.instructorName
                    }}</span>
                    <InputText
                      v-else
                      v-model="editDraft.professorId"
                      fluid
                      placeholder="professor id"
                    />
                  </template>
                </Column>
                <Column field="timeLabel" header="Time" sortable>
                  <template #body="{ data }">
                    <div v-if="!isEditingRow(data.courseId)">
                      {{ data.timeLabel }}
                    </div>
                    <div v-else class="schedule-edit-time">
                      <select
                        v-model="editDraft.days"
                        class="schedule-native-select"
                      >
                        <option
                          v-for="pattern in dayPatternOptions"
                          :key="pattern"
                          :value="pattern"
                        >
                          {{ pattern }}
                        </option>
                      </select>
                      <InputText
                        v-model="editDraft.startTime"
                        fluid
                        placeholder="09:00"
                      />
                      <InputText
                        v-model="editDraft.endTime"
                        fluid
                        placeholder="10:15"
                      />
                    </div>
                  </template>
                </Column>
                <Column field="building" header="Building" sortable />
                <Column field="roomLabel" header="Room" sortable>
                  <template #body="{ data }">
                    <span v-if="!isEditingRow(data.courseId)">{{
                      data.roomLabel
                    }}</span>
                    <InputText
                      v-else
                      v-model="editDraft.roomId"
                      fluid
                      placeholder="room id"
                    />
                  </template>
                </Column>
                <Column field="enrollment" header="Enroll" sortable>
                  <template #body="{ data }">
                    {{ data.enrollment ?? 'N/A' }}
                  </template>
                </Column>
                <Column field="overrideBy" header="Override By" sortable>
                  <template #body="{ data }">
                    {{ data.overrideBy || 'N/A' }}
                  </template>
                </Column>
                <Column header="Actions">
                  <template #body="{ data }">
                    <div class="schedule-row-actions">
                      <template v-if="!isEditingRow(data.courseId)">
                        <Button
                          label="Edit"
                          size="small"
                          severity="secondary"
                          outlined
                          :disabled="
                            isSelectedScheduleLocked || rowActionPending
                          "
                          @click="startEdit(data.courseId)"
                        />
                      </template>
                      <template v-else>
                        <Button
                          label="Save"
                          size="small"
                          :loading="rowActionPending"
                          @click="saveEdit"
                        />
                        <Button
                          label="Cancel"
                          size="small"
                          severity="secondary"
                          outlined
                          :disabled="rowActionPending"
                          @click="cancelEdit"
                        />
                      </template>
                    </div>
                  </template>
                </Column>
              </DataTable>

              <div
                v-if="selectedSchedule.warnings.length"
                class="schedule-subsection"
              >
                <h3>Warnings</h3>
                <Message
                  v-for="warning in selectedSchedule.warnings"
                  :key="warning"
                  severity="warn"
                  :closable="false"
                >
                  {{ warning }}
                </Message>
              </div>

              <div class="schedule-subsection">
                <h3>Conflicts</h3>
                <DataTable
                  :value="selectedConflictRows"
                  stripedRows
                  scrollable
                  showGridlines
                  tableStyle="min-width: 65rem"
                >
                  <template #empty>
                    <div class="schedule-table-empty">
                      No conflicts saved for this run.
                    </div>
                  </template>
                  <Column field="courseId" header="Course" sortable />
                  <Column field="instructor" header="Instructor" sortable />
                  <Column field="room" header="Room" sortable />
                  <Column field="time" header="Time" sortable />
                  <Column field="issueType" header="Issue Type" sortable />
                  <Column field="reason" header="Reason" />
                </DataTable>
              </div>

              <div class="schedule-subsection">
                <h3>Near-Hard Flags</h3>
                <DataTable
                  :value="selectedNearHardFlagRows"
                  stripedRows
                  scrollable
                  showGridlines
                  tableStyle="min-width: 65rem"
                >
                  <template #empty>
                    <div class="schedule-table-empty">
                      No near-hard flags were saved for this run.
                    </div>
                  </template>
                  <Column field="courseId" header="Course" sortable />
                  <Column field="instructor" header="Instructor" sortable />
                  <Column field="room" header="Room" sortable />
                  <Column field="time" header="Time" sortable />
                  <Column field="issueType" header="Issue Type" sortable />
                  <Column field="reason" header="Reason" />
                </DataTable>
              </div>

              <div class="schedule-subsection">
                <h3>Trace Output</h3>
                <DataTable
                  :value="selectedTraceRows"
                  stripedRows
                  scrollable
                  showGridlines
                  tableStyle="min-width: 95rem"
                >
                  <template #empty>
                    <div class="schedule-table-empty">
                      No placement traces were saved for this run.
                    </div>
                  </template>
                  <Column field="courseId" header="Course" sortable />
                  <Column
                    field="catalogCourseId"
                    header="Catalog Course"
                    sortable
                  />
                  <Column field="professorId" header="Professor Id" sortable />
                  <Column field="status" header="Status" sortable />
                  <Column field="stageLabel" header="Stage" sortable />
                  <Column field="candidateCount" header="Candidates" sortable />
                  <Column field="chosenPlacement" header="Chosen Placement" />
                  <Column
                    field="candidateRoomsLabel"
                    header="Candidate Rooms"
                  />
                  <Column
                    field="candidateSlotsLabel"
                    header="Candidate Slots"
                  />
                  <Column field="reasonsLabel" header="Reasons" />
                </DataTable>
              </div>
            </div>
          </template>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  buildEnrichedScheduleRows,
  buildIssueTableRows,
} from '~~/app/utils/schedule'
import {
  downloadScheduleExport,
  type ScheduleExportFormat,
} from '~~/app/utils/scheduleExport'
import { useScheduleReferenceData } from '~~/app/composables/useScheduleReferenceData'
import type {
  EnrichedScheduleRow,
  SavedScheduleDetails,
  SavedScheduleSummary,
  ScheduleAssignment,
  ScheduleStatus,
  ScheduleTermIndexEntry,
} from '~~/types/schedule'

definePageMeta({
  pageTitle: 'Schedule Viewer',
})

type Severity = 'success' | 'info' | 'warn' | 'error' | 'secondary' | 'contrast'

type ScheduleRunResponse = {
  ok: true
  term: string
  count: number
  schedules: SavedScheduleDetails[]
}

const scheduleItems = ref<SavedScheduleSummary[]>([])
const termEntries = ref<ScheduleTermIndexEntry[]>([])
const schedulePending = ref(false)
const selectedSchedulePending = ref(false)
const selectedScheduleId = ref<string | null>(null)
const selectedTerm = ref('')
const selectedSchedule = ref<SavedScheduleDetails | null>(null)
const statusMessage = ref('')
const statusSeverity = ref<Severity>('info')
const rowActionPending = ref(false)
const statusPending = ref(false)
const exportPending = ref(false)
const editingCourseId = ref<string | null>(null)
const scheduleDetailsCache = new Map<string, SavedScheduleDetails>()
const route = useRoute()

const filters = reactive({
  search: '',
  department: '',
  instructor: '',
  building: '',
  room: '',
})

const editDraft = reactive<ScheduleAssignment>({
  courseId: '',
  professorId: '',
  roomId: '',
  days: 'MWF',
  startTime: '',
  endTime: '',
  overrideBy: null,
})

const dayPatternOptions: ScheduleAssignment['days'][] = [
  'MWF',
  'TR',
  'MW',
  'MTWF',
  'MWRF',
  'M',
  'W',
  'T',
  'R',
]

const { lookups, loadForTerm } = useScheduleReferenceData()

const schedulesByTerm = computed(() => {
  return termEntries.value.reduce<Record<string, SavedScheduleSummary[]>>(
    (accumulator, entry) => {
      accumulator[entry.term] = entry.runs
      return accumulator
    },
    {},
  )
})

const termKeys = computed(() => termEntries.value.map((entry) => entry.term))

const enrichedRows = computed(() =>
  buildEnrichedScheduleRows(
    selectedSchedule.value?.assignments ?? [],
    lookups.value,
  ),
)

const filteredRows = computed(() => {
  const query = filters.search.trim().toLowerCase()

  return enrichedRows.value.filter((row) => {
    if (filters.department && row.department !== filters.department)
      return false
    if (filters.instructor && row.instructorName !== filters.instructor)
      return false
    if (filters.building && row.building !== filters.building) return false
    if (filters.room && row.roomLabel !== filters.room) return false

    if (!query) return true

    return [
      row.courseId,
      row.courseTitle,
      row.instructorName,
      row.roomLabel,
      row.building,
      row.timeLabel,
    ]
      .join(' ')
      .toLowerCase()
      .includes(query)
  })
})

const selectedConflictRows = computed(() =>
  buildIssueTableRows(
    selectedSchedule.value?.conflicts ?? [],
    enrichedRows.value,
  ),
)

const selectedNearHardFlagRows = computed(() =>
  buildIssueTableRows(
    selectedSchedule.value?.nearHardFlags ?? [],
    enrichedRows.value,
  ),
)

const selectedRecommendedStatus = computed<ScheduleStatus>(() => {
  if (
    (selectedSchedule.value?.conflicts.length ?? 0) > 0 ||
    (selectedSchedule.value?.nearHardFlags.length ?? 0) > 0
  ) {
    return 'under_review'
  }

  return 'approved'
})

const selectedTraceRows = computed(() =>
  (selectedSchedule.value?.traces ?? []).map((trace) => ({
    courseId: trace.courseId,
    catalogCourseId: trace.catalogCourseId,
    professorId: trace.professorId,
    status: trace.status,
    stageLabel: trace.stage
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase()),
    candidateCount: trace.candidateCount,
    chosenPlacement: trace.chosen
      ? `${trace.chosen.days} ${trace.chosen.startTime}-${trace.chosen.endTime} @ ${trace.chosen.roomId}`
      : 'None',
    candidateRoomsLabel: trace.candidateRooms.join(', ') || 'None',
    candidateSlotsLabel:
      trace.candidateSlots
        .map((slot) => `${slot.days} ${slot.startTime}-${slot.endTime}`)
        .join(', ') || 'None',
    reasonsLabel: trace.reasons.join('; ') || 'None',
  })),
)

const selectedScheduleTitle = computed(() => {
  if (!selectedSchedule.value) return 'Saved Schedule Viewer'
  return `${selectedSchedule.value.term} - Run ${selectedSchedule.value.runNumber}`
})

const selectedStatusSeverity = computed<Severity>(() => {
  switch (selectedSchedule.value?.status) {
    case 'approved':
      return 'success'
    case 'exported':
      return 'contrast'
    case 'under_review':
      return 'warn'
    default:
      return 'secondary'
  }
})

const isSelectedScheduleLocked = computed(() =>
  ['approved', 'exported'].includes(selectedSchedule.value?.status ?? ''),
)

const canApproveSelectedSchedule = computed(() => {
  if (!selectedSchedule.value) return false
  return ['draft', 'under_review'].includes(selectedSchedule.value.status)
})

const canReopenSelectedSchedule = computed(() => {
  if (!selectedSchedule.value) return false
  return ['approved', 'exported'].includes(selectedSchedule.value.status)
})

const canExportSelectedSchedule = computed(() => {
  if (!selectedSchedule.value) return false
  return ['approved', 'exported'].includes(selectedSchedule.value.status)
})

const departmentOptions = computed(() =>
  [...new Set(enrichedRows.value.map((row) => row.department))].sort(),
)

const instructorOptions = computed(() =>
  [...new Set(enrichedRows.value.map((row) => row.instructorName))].sort(),
)

const buildingOptions = computed(() =>
  [...new Set(enrichedRows.value.map((row) => row.building))].sort(),
)

const roomOptions = computed(() =>
  [...new Set(enrichedRows.value.map((row) => row.roomLabel))].sort(),
)

const hasActiveFilters = computed(() => {
  return Boolean(
    filters.search ||
    filters.department ||
    filters.instructor ||
    filters.building ||
    filters.room,
  )
})

function setStatus(message: string, severity: Severity = 'info') {
  statusMessage.value = message
  statusSeverity.value = severity
}

function extractErrorMessage(error: unknown): string {
  const candidate = error as {
    data?: { statusMessage?: string }
    statusMessage?: string
    message?: string
  }

  return (
    candidate?.data?.statusMessage ??
    candidate?.statusMessage ??
    candidate?.message ??
    'The request could not be completed.'
  )
}

function formatDateTime(value?: string | null) {
  if (!value) return 'N/A'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

function normalizeQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    const firstValue = value[0]
    return typeof firstValue === 'string' ? firstValue : ''
  }

  return typeof value === 'string' ? value : ''
}

function findScheduleFromQuery() {
  const termQuery = normalizeQueryValue(route.query.term).trim()
  const runQueryRaw = normalizeQueryValue(route.query.run).trim()
  const runQuery = Number(runQueryRaw)
  const hasRunQuery = runQueryRaw.length > 0 && Number.isInteger(runQuery)

  if (!termQuery) return null

  const matchingSchedules = scheduleItems.value.filter(
    (schedule) => schedule.term === termQuery,
  )

  if (hasRunQuery) {
    return (
      matchingSchedules.find((schedule) => schedule.runNumber === runQuery) ??
      null
    )
  }

  return (
    matchingSchedules.find((schedule) => (schedule.assignmentCount ?? 0) > 0) ??
    matchingSchedules[0] ??
    null
  )
}

function resetFilters() {
  filters.search = ''
  filters.department = ''
  filters.instructor = ''
  filters.building = ''
  filters.room = ''
}

async function loadSchedules() {
  schedulePending.value = true
  try {
    termEntries.value = await $fetch<ScheduleTermIndexEntry[]>(
      '/api/schedule/terms',
    )
    scheduleItems.value = termEntries.value.flatMap((entry) => entry.runs)
  } catch (error) {
    setStatus(extractErrorMessage(error), 'error')
  } finally {
    schedulePending.value = false
  }
}

async function loadScheduleDetailsForTerm(term: string) {
  const response = await $fetch<ScheduleRunResponse>(
    `/api/schedule/${encodeURIComponent(term)}/all`,
  )

  for (const schedule of response.schedules) {
    scheduleDetailsCache.set(schedule._id, schedule)
  }
}

async function refreshSelectedSchedule() {
  if (!selectedSchedule.value) return

  await loadScheduleDetailsForTerm(selectedSchedule.value.term)
  selectedSchedule.value =
    scheduleDetailsCache.get(selectedSchedule.value._id) ??
    selectedSchedule.value
  await loadSchedules()
}

async function selectSchedule(schedule: SavedScheduleSummary) {
  selectedSchedulePending.value = true
  selectedScheduleId.value = schedule._id
  selectedTerm.value = schedule.term

  try {
    if (!scheduleDetailsCache.has(schedule._id)) {
      await loadScheduleDetailsForTerm(schedule.term)
    }

    selectedSchedule.value = scheduleDetailsCache.get(schedule._id) ?? null
    resetFilters()
    editingCourseId.value = null
    await loadForTerm(schedule.term)
  } catch (error) {
    setStatus(extractErrorMessage(error), 'error')
  } finally {
    selectedSchedulePending.value = false
  }
}

function isEditingRow(courseId: string) {
  return editingCourseId.value === courseId
}

function startEdit(courseId: string) {
  if (!selectedSchedule.value) return

  const assignment = selectedSchedule.value.assignments.find(
    (candidate) => candidate.courseId === courseId,
  )
  if (!assignment) return

  editingCourseId.value = courseId
  Object.assign(editDraft, assignment)
}

function cancelEdit() {
  editingCourseId.value = null
}

function validateEditDraft() {
  const requiredFields: Array<[string, string]> = [
    ['professor', editDraft.professorId],
    ['room', editDraft.roomId],
    ['days', editDraft.days],
    ['start time', editDraft.startTime],
    ['end time', editDraft.endTime],
  ]

  const missing = requiredFields.find(([, value]) => !value?.trim())
  if (missing) {
    return `Please provide a ${missing[0]} before saving.`
  }

  return ''
}

async function saveEdit() {
  if (!selectedSchedule.value || !editingCourseId.value) return

  const validationMessage = validateEditDraft()
  if (validationMessage) {
    setStatus(validationMessage, 'warn')
    return
  }

  rowActionPending.value = true
  try {
    await $fetch(
      `/api/schedule/${encodeURIComponent(selectedSchedule.value.term)}/assignment`,
      {
        method: 'PATCH',
        body: {
          runNumber: selectedSchedule.value.runNumber,
          originalCourseId: editingCourseId.value,
          assignment: {
            courseId: editingCourseId.value,
            professorId: editDraft.professorId,
            roomId: editDraft.roomId,
            days: editDraft.days,
            startTime: editDraft.startTime,
            endTime: editDraft.endTime,
          },
        },
      },
    )

    await refreshSelectedSchedule()
    editingCourseId.value = null
    setStatus(
      `Updated ${selectedSchedule.value.term} run ${selectedSchedule.value.runNumber}.`,
      'success',
    )
  } catch (error) {
    setStatus(extractErrorMessage(error), 'error')
  } finally {
    rowActionPending.value = false
  }
}

async function updateSelectedStatus(nextStatus: ScheduleStatus) {
  if (!selectedSchedule.value) return

  statusPending.value = true
  try {
    selectedSchedule.value = await $fetch<SavedScheduleDetails>(
      `/api/schedule/${encodeURIComponent(selectedSchedule.value.term)}`,
      {
        method: 'PATCH',
        body: {
          runNumber: selectedSchedule.value.runNumber,
          status: nextStatus,
        },
      },
    )

    scheduleDetailsCache.set(selectedSchedule.value._id, selectedSchedule.value)
    await loadSchedules()
    setStatus(
      `${selectedSchedule.value.term} run ${selectedSchedule.value.runNumber} is now ${selectedSchedule.value.status}.`,
      'success',
    )
  } catch (error) {
    setStatus(extractErrorMessage(error), 'error')
  } finally {
    statusPending.value = false
  }
}

async function approveSelectedSchedule() {
  await updateSelectedStatus('approved')
}

async function reopenSelectedSchedule() {
  await updateSelectedStatus('under_review')
}

async function exportSelectedSchedule(format: ScheduleExportFormat) {
  if (!selectedSchedule.value) return

  exportPending.value = true
  try {
    await downloadScheduleExport(
      selectedSchedule.value.term,
      selectedSchedule.value.runNumber,
      format,
    )

    selectedSchedule.value = {
      ...selectedSchedule.value,
      status: 'exported',
    }
    scheduleDetailsCache.set(selectedSchedule.value._id, selectedSchedule.value)
    await loadSchedules()
    setStatus(
      `Exported ${selectedSchedule.value.term} run ${selectedSchedule.value.runNumber} as ${format.toUpperCase()}.`,
      'success',
    )
  } catch (error) {
    setStatus(extractErrorMessage(error), 'error')
  } finally {
    exportPending.value = false
  }
}

onMounted(async () => {
  await loadSchedules()
  const initialSchedule =
    findScheduleFromQuery() ??
    scheduleItems.value.find((schedule) => (schedule.assignmentCount ?? 0) > 0) ??
    scheduleItems.value[0] ??
    null
  if (!initialSchedule) {
    selectedTerm.value = normalizeQueryValue(route.query.term).trim() || termKeys.value[0] || ''
  }
  if (initialSchedule) {
    await selectSchedule(initialSchedule)
  }
})
</script>

<style scoped>
.schedule-history-page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 0.75rem 0 2rem;
}

.schedule-history-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.schedule-history-page-header__title {
  margin: 0;
  font-size: clamp(1.4rem, 2vw, 1.9rem);
}

.schedule-history-layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 1.25rem;
  align-items: stretch;
}

.schedule-history-sidebar,
.schedule-history-main,
.schedule-history-main-card {
  height: 100%;
}

.schedule-history-sidebar :deep(.p-card),
.schedule-history-main-card :deep(.p-card) {
  height: 100%;
}

.schedule-history-sidebar :deep(.p-card-header),
.schedule-history-main-card :deep(.p-card-header) {
  padding: 1.15rem 1.35rem 0;
}

.schedule-history-sidebar :deep(.p-card-body),
.schedule-history-main-card :deep(.p-card-body) {
  padding: 1.05rem 1.35rem 1.35rem;
}

.schedule-history-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.schedule-history-card-header__title {
  margin: 0;
  font-size: 1.1rem;
}

.schedule-history-card-header__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.schedule-history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  min-height: 12rem;
  text-align: center;
  color: var(--color-text-secondary);
}

.schedule-term-list {
  display: grid;
  gap: 0.8rem;
}

.schedule-term-group {
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 16px;
  background: #fff;
  overflow: hidden;
}

.schedule-term-group > summary {
  cursor: pointer;
  padding: 0.95rem 1rem;
  font-weight: 700;
  list-style: none;
  color: var(--color-text-primary);
}

.schedule-term-group > summary::-webkit-details-marker {
  display: none;
}

.schedule-term-group__items {
  display: grid;
  gap: 0.65rem;
  padding: 0 1rem 1rem;
}

.schedule-term-group__empty {
  padding: 0 1rem 1rem;
  color: var(--color-text-muted);
}

.schedule-run-button {
  display: grid;
  gap: 0.25rem;
  padding: 0.8rem 0.9rem;
  text-align: left;
  border-radius: 14px;
  border: 1px solid rgba(59, 130, 246, 0.16);
  background: #f8fafc;
  color: var(--color-text-primary);
}

.schedule-run-button strong {
  font-size: 0.96rem;
}

.schedule-run-button span,
.schedule-run-button small {
  color: var(--color-text-secondary);
}

.schedule-run-button--active {
  border-color: rgba(29, 78, 216, 0.45);
  background: rgba(219, 234, 254, 0.72);
  box-shadow: 0 12px 24px rgba(59, 130, 246, 0.16);
}

.schedule-history-stack,
.schedule-subsection {
  display: grid;
  gap: 1rem;
}

.schedule-meta-grid,
.schedule-filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.85rem;
}

.schedule-filter-grid--advanced {
  margin-top: 0.25rem;
}

.schedule-filter-grid__actions {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem;
  grid-column: 1 / -1;
}

.schedule-filter-grid__count {
  color: var(--color-text-secondary);
  font-size: 0.92rem;
}

.schedule-meta-card {
  display: grid;
  gap: 0.35rem;
  padding: 0.9rem 1rem;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: linear-gradient(180deg, #fff, #f8fafc);
}

.schedule-meta-card__label {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.schedule-history-actions,
.schedule-row-actions,
.schedule-edit-time {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.schedule-filter-grid label {
  display: grid;
  gap: 0.45rem;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.schedule-native-select {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.7rem 0.85rem;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.42);
  background: #fff;
  color: var(--color-text-primary);
}

.schedule-native-select:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 1px;
}

.schedule-detail-block {
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.9);
  overflow: hidden;
}

.schedule-detail-block > summary {
  cursor: pointer;
  padding: 0.9rem 1rem;
  font-weight: 600;
  list-style: none;
  color: var(--color-text-primary);
}

.schedule-detail-block > summary::-webkit-details-marker {
  display: none;
}

.schedule-detail-block__content {
  padding: 0 1rem 1rem;
}

.schedule-detail-block__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.9rem;
}

.schedule-table-empty {
  padding: 1rem;
  text-align: center;
  color: var(--color-text-muted);
}

.schedule-subsection h3 {
  margin: 0;
}

@media (max-width: 1120px) {
  .schedule-history-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 860px) {
  .schedule-history-page-header,
  .schedule-history-card-header {
    flex-direction: column;
  }
}

@media (max-width: 640px) {
  .schedule-history-actions,
  .schedule-row-actions,
  .schedule-filter-grid__actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
