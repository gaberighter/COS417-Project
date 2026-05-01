<template>
  <div class="schedule-admin-page">
    <div class="schedule-admin-layout">
      <Card class="schedule-admin-hero">
        <template #content>
          <div class="schedule-admin-hero__content">
            <div class="schedule-admin-hero__copy">
              <h2 class="schedule-admin-hero__title">Create a New Schedule</h2>
            </div>

            <div class="schedule-admin-hero__controls">
              <div class="schedule-field">
                <label class="schedule-label" for="schedule-run-term"
                  >Term</label
                >
                <AutoComplete
                  id="schedule-run-term"
                  v-model="term"
                  :suggestions="termSuggestions"
                  dropdown
                  completeOnFocus
                  :minLength="0"
                  appendTo="body"
                  inputClass="schedule-autocomplete-input"
                  panelClass="schedule-autocomplete-panel"
                  placeholder="e.g. Fall-2026"
                  class="w-full"
                  @complete="searchTermSuggestions"
                />
              </div>

              <div class="schedule-admin-hero__buttons">
                <Button
                  label="Load Term"
                  severity="secondary"
                  outlined
                  :loading="termContextPending"
                  @click="loadTermContext"
                />
                <Button
                  label="Create Schedule"
                  :disabled="!canRunSchedule"
                  :loading="runPending"
                  @click="runSchedule"
                />
              </div>
            </div>
          </div>
        </template>
      </Card>

      <Message
        v-if="statusMessage"
        :severity="statusSeverity"
        :closable="false"
        class="schedule-message"
      >
        {{ statusMessage }}
      </Message>

      <div class="schedule-admin-columns">
        <Card class="schedule-admin-column-card">
          <template #header>
            <div class="schedule-card-header">
              <div>
                <h2 class="schedule-card-header__title">Current Schedule</h2>
              </div>
              <div class="schedule-card-header__actions">
                <Tag
                  v-if="runResult"
                  :value="`Recommended: ${runResult.recommendedStatus}`"
                  :severity="
                    runResult.recommendedStatus === 'approved'
                      ? 'success'
                      : 'warn'
                  "
                  rounded
                />
                <Tag
                  v-if="savedSchedule"
                  :value="`Saved Run ${savedSchedule.runNumber}: ${savedSchedule.status}`"
                  :severity="savedScheduleTagSeverity"
                  rounded
                />
              </div>
            </div>
          </template>

          <template #content>
            <div class="schedule-action-bar">
              <Button
                v-if="runResult"
                :label="savedSchedule ? 'Save Another Version' : 'Save Version'"
                :disabled="!runResult || savePending"
                :loading="savePending"
                @click="saveRunVersion"
              />
              <Button
                v-if="runResult || savedSchedule"
                label="Open in Editor"
                severity="secondary"
                outlined
                :loading="openEditorPending"
                :disabled="openEditorPending"
                @click="openRunInEditor"
              />
              <Button
                v-if="canApproveSavedSchedule"
                label="Approve Schedule"
                severity="success"
                outlined
                :loading="approvalPending"
                @click="approveSavedSchedule"
              />
              <Button
                v-if="canReopenSavedSchedule"
                label="Reopen"
                severity="warn"
                outlined
                :loading="approvalPending"
                @click="reopenSavedSchedule"
              />
              <Button
                v-if="canExportSavedSchedule"
                label="Export CSV"
                severity="contrast"
                outlined
                :loading="exportPending"
                @click="exportSavedSchedule('csv')"
              />
              <Button
                v-if="canExportSavedSchedule"
                label="Export Excel"
                severity="contrast"
                :loading="exportPending"
                @click="exportSavedSchedule('xlsx')"
              />
            </div>

            <div v-if="!runResult" class="schedule-empty-state">
              <p>
                Run the scheduler to review assignments, warnings, and
                conflicts.
              </p>
            </div>

            <div v-else class="schedule-result-stack">
              <div class="schedule-result-overview">
                <div class="schedule-result-overview__card">
                  <span class="schedule-result-overview__label"
                    >Assignments</span
                  >
                  <strong>{{ runResult.assignments.length }}</strong>
                </div>
                <div class="schedule-result-overview__card">
                  <span class="schedule-result-overview__label">Conflicts</span>
                  <strong>{{ runResult.conflicts.length }}</strong>
                </div>
                <div class="schedule-result-overview__card">
                  <span class="schedule-result-overview__label"
                    >Near-Hard Flags</span
                  >
                  <strong>{{ runResult.nearHardFlags.length }}</strong>
                </div>
                <div class="schedule-result-overview__card">
                  <span class="schedule-result-overview__label">Warnings</span>
                  <strong>{{ runResult.warnings.length }}</strong>
                </div>
              </div>

              <Message
                :severity="generatedScheduleMessageSeverity"
                :closable="false"
                class="schedule-inline-message"
              >
                {{ generatedScheduleMessage }}
              </Message>

              <DataTable
                :value="enrichedRunRows"
                stripedRows
                showGridlines
                class="schedule-table schedule-table--main"
              >
                <Column field="department" header="Dept" sortable>
                  <template #body="{ data }">
                    <ScheduleCellPreview
                      :value="data.department"
                      title="Department"
                    />
                  </template>
                </Column>
                <Column field="courseNumber" header="Course" sortable>
                  <template #body="{ data }">
                    <ScheduleCellPreview
                      :value="data.courseNumber"
                      title="Course"
                    />
                  </template>
                </Column>
                <Column field="section" header="Section" sortable>
                  <template #body="{ data }">
                    <ScheduleCellPreview
                      :value="data.section || 'N/A'"
                      title="Section"
                    />
                  </template>
                </Column>
                <Column field="courseTitle" header="Title" sortable>
                  <template #body="{ data }">
                    <ScheduleCellPreview
                      :value="data.courseTitle"
                      title="Course Title"
                    />
                  </template>
                </Column>
                <Column field="instructorName" header="Instructor" sortable>
                  <template #body="{ data }">
                    <ScheduleCellPreview
                      :value="data.instructorName"
                      title="Instructor"
                    />
                  </template>
                </Column>
                <Column field="timeLabel" header="Time" sortable>
                  <template #body="{ data }">
                    <ScheduleCellPreview :value="data.timeLabel" title="Time" />
                  </template>
                </Column>
                <Column field="building" header="Building" sortable>
                  <template #body="{ data }">
                    <ScheduleCellPreview
                      :value="data.building"
                      title="Building"
                    />
                  </template>
                </Column>
                <Column field="roomLabel" header="Room" sortable>
                  <template #body="{ data }">
                    <ScheduleCellPreview :value="data.roomLabel" title="Room" />
                  </template>
                </Column>
                <Column field="enrollment" header="Enroll" sortable>
                  <template #body="{ data }">
                    <ScheduleCellPreview
                      :value="data.enrollment ?? 'N/A'"
                      title="Enrollment"
                    />
                  </template>
                </Column>
              </DataTable>

              <div v-if="runResult.warnings.length" class="schedule-subsection">
                <h3>Warnings</h3>
                <Message
                  v-for="warning in runResult.warnings"
                  :key="warning"
                  severity="warn"
                  :closable="false"
                  class="schedule-inline-message"
                >
                  {{ warning }}
                </Message>
              </div>

              <div class="schedule-subsection">
                <h3>Conflicts</h3>
                <DataTable
                  :value="conflictRows"
                  stripedRows
                  showGridlines
                  class="schedule-table schedule-table--issues"
                >
                  <template #empty>
                    <div class="schedule-table-empty">
                      No conflicts returned.
                    </div>
                  </template>
                  <Column field="courseLabel" header="Course" sortable>
                    <template #body="{ data }">
                      <ScheduleCellPreview
                        :value="data.courseLabel"
                        title="Course"
                      />
                    </template>
                  </Column>
                  <Column field="instructor" header="Instructor" sortable>
                    <template #body="{ data }">
                      <ScheduleCellPreview
                        :value="data.instructor"
                        title="Instructor"
                      />
                    </template>
                  </Column>
                  <Column field="room" header="Room" sortable>
                    <template #body="{ data }">
                      <ScheduleCellPreview :value="data.room" title="Room" />
                    </template>
                  </Column>
                  <Column field="time" header="Time" sortable>
                    <template #body="{ data }">
                      <ScheduleCellPreview :value="data.time" title="Time" />
                    </template>
                  </Column>
                  <Column field="issueType" header="Issue Type" sortable>
                    <template #body="{ data }">
                      <ScheduleCellPreview
                        :value="data.issueType"
                        title="Issue Type"
                      />
                    </template>
                  </Column>
                  <Column field="reason" header="Reason">
                    <template #body="{ data }">
                      <ScheduleCellPreview
                        :value="data.reason"
                        title="Reason"
                      />
                    </template>
                  </Column>
                </DataTable>
              </div>

              <div class="schedule-subsection">
                <h3>Near-Hard Flags</h3>
                <DataTable
                  :value="nearHardFlagRows"
                  stripedRows
                  showGridlines
                  class="schedule-table schedule-table--issues"
                >
                  <template #empty>
                    <div class="schedule-table-empty">
                      No near-hard flags returned.
                    </div>
                  </template>
                  <Column field="courseLabel" header="Course" sortable>
                    <template #body="{ data }">
                      <ScheduleCellPreview
                        :value="data.courseLabel"
                        title="Course"
                      />
                    </template>
                  </Column>
                  <Column field="instructor" header="Instructor" sortable>
                    <template #body="{ data }">
                      <ScheduleCellPreview
                        :value="data.instructor"
                        title="Instructor"
                      />
                    </template>
                  </Column>
                  <Column field="room" header="Room" sortable>
                    <template #body="{ data }">
                      <ScheduleCellPreview :value="data.room" title="Room" />
                    </template>
                  </Column>
                  <Column field="time" header="Time" sortable>
                    <template #body="{ data }">
                      <ScheduleCellPreview :value="data.time" title="Time" />
                    </template>
                  </Column>
                  <Column field="issueType" header="Issue Type" sortable>
                    <template #body="{ data }">
                      <ScheduleCellPreview
                        :value="data.issueType"
                        title="Issue Type"
                      />
                    </template>
                  </Column>
                  <Column field="reason" header="Reason">
                    <template #body="{ data }">
                      <ScheduleCellPreview
                        :value="data.reason"
                        title="Reason"
                      />
                    </template>
                  </Column>
                </DataTable>
              </div>

              <div class="schedule-subsection">
                <h3>Trace Output</h3>
                <p class="schedule-trace-note">
                  Placement trace for this run. Expand a course to see which
                  fallback tier won and how the scheduler narrowed the choice.
                </p>
                <DataTable
                  :value="runTraceRows"
                  stripedRows
                  showGridlines
                  class="schedule-table schedule-table--trace"
                >
                  <template #empty>
                    <div class="schedule-table-empty">
                      No placement traces were returned for this run.
                    </div>
                  </template>
                  <Column field="courseLabel" header="Course" sortable>
                    <template #body="{ data }">
                      <ScheduleCellPreview
                        :value="data.courseLabel"
                        title="Course"
                      />
                    </template>
                  </Column>
                  <Column field="professorName" header="Professor" sortable>
                    <template #body="{ data }">
                      <ScheduleCellPreview
                        :value="data.professorName"
                        title="Professor"
                      />
                    </template>
                  </Column>
                  <Column field="outcomeLabel" header="Outcome" sortable>
                    <template #body="{ data }">
                      <ScheduleCellPreview
                        :value="data.outcomeLabel"
                        title="Outcome"
                      />
                    </template>
                  </Column>
                  <Column field="selectedTier" header="Selected Tier">
                    <template #body="{ data }">
                      <ScheduleCellPreview
                        :value="data.selectedTier"
                        title="Selected Tier"
                      />
                    </template>
                  </Column>
                  <Column field="chosenPlacement" header="Placement">
                    <template #body="{ data }">
                      <ScheduleCellPreview
                        :value="data.chosenPlacement"
                        title="Placement"
                      />
                    </template>
                  </Column>
                  <Column field="decisionSummary" header="Decision Summary">
                    <template #body="{ data }">
                      <ScheduleCellPreview
                        :value="data.decisionSummary"
                        title="Decision Summary"
                      />
                    </template>
                  </Column>
                </DataTable>

                <div v-if="runTraceRows.length" class="schedule-trace-details">
                  <details
                    v-for="trace in runTraceRows"
                    :key="`${trace.courseId}-${trace.stageLabel}`"
                    class="schedule-detail-block"
                  >
                    <summary>
                      {{ trace.courseLabel }} - {{ trace.outcomeLabel }}
                    </summary>
                    <div class="schedule-detail-block__content">
                      <p>
                        <strong>Selected tier:</strong> {{ trace.selectedTier }}
                      </p>
                      <p>
                        <strong>Chosen placement:</strong>
                        {{ trace.chosenPlacement }}
                      </p>
                      <p>
                        <strong>Candidate pool:</strong>
                        {{ trace.candidateSummary }}
                      </p>
                      <p>
                        <strong>Candidate preview:</strong>
                        {{ trace.candidatePreview }}
                      </p>
                      <p>
                        <strong>Reason summary:</strong>
                        {{ trace.reasonsLabel }}
                      </p>
                      <div v-if="trace.decisionLog.length">
                        <strong>Decision log</strong>
                        <ul>
                          <li
                            v-for="entry in trace.decisionLog"
                            :key="`${trace.courseId}-${entry}`"
                          >
                            {{ entry }}
                          </li>
                        </ul>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <Card class="schedule-admin-column-card">
          <template #header>
            <div class="schedule-card-header">
              <div>
                <h2 class="schedule-card-header__title">
                  Current Save Snapshot
                </h2>
              </div>
              <div class="schedule-card-header__actions">
                <button
                  type="button"
                  class="schedule-history-trigger"
                  aria-label="Open saved schedule history"
                  @click="toggleHistoryPopover"
                >
                  <i class="pi pi-history" aria-hidden="true" />
                </button>
                <Popover ref="historyPopover">
                  <div class="schedule-history-popover">
                    <div class="schedule-history-popover__header">
                      <strong>{{ historyPopoverTitle }}</strong>
                      <small>{{ historyPopoverSubtitle }}</small>
                    </div>

                    <div
                      v-if="historyPending"
                      class="schedule-history-popover__empty"
                    >
                      Loading saved runs...
                    </div>

                    <div
                      v-else-if="historyLoadError"
                      class="schedule-history-popover__empty schedule-history-popover__empty--error"
                    >
                      {{ historyLoadError }}
                    </div>

                    <div
                      v-else-if="historyPopoverItems.length === 0"
                      class="schedule-history-popover__empty"
                    >
                      {{ historyEmptyMessage }}
                    </div>

                    <div v-else class="schedule-history-popover__list">
                      <button
                        v-for="history in historyPopoverItems"
                        :key="history._id"
                        type="button"
                        class="schedule-history-popover__item"
                        @click="openHistoryItem(history)"
                      >
                        <div class="schedule-history-popover__item-top">
                          <strong
                            >{{ history.term }} - Run
                            {{ history.runNumber }}</strong
                          >
                          <Tag
                            :value="history.status"
                            :severity="scheduleStatusSeverity(history.status)"
                            rounded
                          />
                        </div>
                        <small>
                          Updated
                          {{
                            formatDateTime(
                              history.updatedAt || history.createdAt,
                            )
                          }}
                        </small>
                      </button>
                    </div>

                    <Button
                      label="Open Full History"
                      severity="secondary"
                      text
                      class="schedule-history-popover__footer-action"
                      @click="openFullHistory"
                    />
                  </div>
                </Popover>
              </div>
            </div>
          </template>

          <template #content>
            <div v-if="!savedSchedule" class="schedule-empty-state">
              <p>No saved version is loaded for this term yet.</p>
            </div>

            <div v-else class="schedule-saved-meta">
              <div class="schedule-saved-meta__grid">
                <div class="schedule-saved-meta__item">
                  <span class="schedule-saved-meta__label">Run: </span>
                  <strong>{{ savedSchedule.runNumber }}</strong>
                </div>
                <div class="schedule-saved-meta__item">
                  <span class="schedule-saved-meta__label">Status: </span>
                  <strong>{{ savedSchedule.status }}</strong>
                </div>
                <div class="schedule-saved-meta__item">
                  <span class="schedule-saved-meta__label">Created: </span>
                  <strong>{{ formatDateTime(savedSchedule.createdAt) }}</strong>
                </div>
                <div class="schedule-saved-meta__item">
                  <span class="schedule-saved-meta__label">Approved: </span>
                  <strong>
                    {{
                      savedSchedule.approvedAt
                        ? formatDateTime(savedSchedule.approvedAt)
                        : 'Not approved'
                    }}
                  </strong>
                </div>
              </div>

              <Message
                v-if="
                  savedSchedule.status === 'approved' ||
                  savedSchedule.status === 'exported'
                "
                severity="info"
                :closable="false"
                class="schedule-inline-message"
              >
                This saved version is locked, which keeps the process safe for
                export. Reopen it only if you need to make another review pass.
              </Message>
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
  buildTraceTableRows,
} from '~~/app/utils/schedule'
import {
  downloadScheduleExport,
  type ScheduleExportFormat,
} from '~~/app/utils/scheduleExport'
import { useScheduleReferenceData } from '~~/app/composables/useScheduleReferenceData'
import type {
  SavedScheduleDetails,
  SavedScheduleSummary,
  ScheduleRunResponse,
  ScheduleStatus,
  ScheduleTermIndexEntry,
} from '~~/types/schedule'

definePageMeta({
  pageTitle: 'Create a New Schedule',
})

type Severity = 'success' | 'info' | 'warn' | 'error' | 'secondary' | 'contrast'

type ScheduleSaveResponse = {
  ok: true
  count: number
  schedules: SavedScheduleDetails[]
}

type ScheduleTermRunsResponse = {
  ok: true
  term: string
  count: number
  schedules: SavedScheduleDetails[]
}

const term = ref('')
const selectedTerm = ref('')
const termSuggestions = ref<string[]>([])
const availableTerms = ref<string[]>([])
const termEntries = ref<ScheduleTermIndexEntry[]>([])
const runResult = ref<ScheduleRunResponse | null>(null)
const savedSchedule = ref<SavedScheduleDetails | null>(null)
const termContextPending = ref(false)
const runPending = ref(false)
const savePending = ref(false)
const approvalPending = ref(false)
const exportPending = ref(false)
const historyPending = ref(false)
const openEditorPending = ref(false)
const statusMessage = ref('')
const statusSeverity = ref<Severity>('info')
const historyLoadError = ref('')
const historyItems = ref<SavedScheduleSummary[]>([])
const historyPopover = ref<{
  toggle: (event: Event) => void
  hide?: () => void
} | null>(null)
const runResultIsSaved = ref(false)

const { lookups, loadForTerm } = useScheduleReferenceData()

function scheduleStatusSeverity(status?: ScheduleStatus | null): Severity {
  switch (status) {
    case 'approved':
      return 'success'
    case 'exported':
      return 'contrast'
    case 'under_review':
      return 'warn'
    default:
      return 'secondary'
  }
}

const savedScheduleTagSeverity = computed<Severity>(() => {
  return scheduleStatusSeverity(savedSchedule.value?.status)
})

const canRunSchedule = computed(() => {
  return !!selectedTerm.value && !runPending.value && !termContextPending.value
})

const canApproveSavedSchedule = computed(() => {
  if (!savedSchedule.value) return false
  return ['draft', 'under_review'].includes(savedSchedule.value.status)
})

const canReopenSavedSchedule = computed(() => {
  if (!savedSchedule.value) return false
  return ['approved', 'exported'].includes(savedSchedule.value.status)
})

const canExportSavedSchedule = computed(() => {
  if (!savedSchedule.value) return false
  return ['approved', 'exported'].includes(savedSchedule.value.status)
})

const enrichedRunRows = computed(() =>
  buildEnrichedScheduleRows(runResult.value?.assignments ?? [], lookups.value),
)

const conflictRows = computed(() =>
  buildIssueTableRows(
    runResult.value?.conflicts ?? [],
    enrichedRunRows.value,
    lookups.value,
  ),
)

const nearHardFlagRows = computed(() =>
  buildIssueTableRows(
    runResult.value?.nearHardFlags ?? [],
    enrichedRunRows.value,
    lookups.value,
  ),
)

const runTraceRows = computed(() =>
  buildTraceTableRows(runResult.value?.traces ?? [], lookups.value),
)

const generatedScheduleMessageSeverity = computed<Severity>(() => {
  if (!runResult.value) return 'info'
  if (runResult.value.conflicts.length > 0) return 'error'
  if (runResult.value.nearHardFlags.length > 0) return 'warn'
  return 'success'
})

const generatedScheduleMessage = computed(() => {
  if (!runResult.value) {
    return ''
  }
  if (runResult.value.conflicts.length > 0) {
    return 'This run includes hard conflicts. Save it only if you want to review or revise it further.'
  }
  if (runResult.value.nearHardFlags.length > 0) {
    return 'This run completed, but it includes near-hard flags that should be reviewed before approval.'
  }

  return 'This run is clean enough to save and move toward approval.'
})

const historyScopeTerm = computed(() => {
  return (
    selectedTerm.value || term.value.trim() || savedSchedule.value?.term || ''
  )
})

const historyPopoverItems = computed(() => {
  if (!historyScopeTerm.value) {
    return historyItems.value.slice(0, 6)
  }

  const matchingItems = historyItems.value.filter(
    (history) => history.term === historyScopeTerm.value,
  )

  return (matchingItems.length ? matchingItems : historyItems.value).slice(0, 6)
})

const historyPopoverTitle = computed(() => {
  if (
    historyScopeTerm.value &&
    historyPopoverItems.value.some(
      (history) => history.term === historyScopeTerm.value,
    )
  ) {
    return `${historyScopeTerm.value} History`
  }

  return 'Recent Saved Runs'
})

const historyPopoverSubtitle = computed(() => {
  if (
    historyScopeTerm.value &&
    historyPopoverItems.value.some(
      (history) => history.term === historyScopeTerm.value,
    )
  ) {
    return "Quick access to this term's saved schedule runs."
  }

  return 'Showing the most recent saved runs across terms.'
})

const historyEmptyMessage = computed(() => {
  if (historyScopeTerm.value) {
    return `No saved runs for ${historyScopeTerm.value} yet.`
  }

  return 'No saved runs yet.'
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

function searchTermSuggestions(event: { query?: string }) {
  const query = event.query?.trim().toLowerCase() ?? ''
  termSuggestions.value = query
    ? availableTerms.value.filter((candidate) =>
        candidate.toLowerCase().includes(query),
      )
    : availableTerms.value
}

async function loadAvailableTerms() {
  termEntries.value = await $fetch<ScheduleTermIndexEntry[]>(
    '/api/schedule/terms',
  )
  historyItems.value = termEntries.value.flatMap((entry) => entry.runs)
  availableTerms.value = termEntries.value.map((entry) => entry.term)
  if (!term.value && availableTerms.value[0]) {
    term.value = availableTerms.value[0]
  }
}

async function loadLatestSavedSchedule(termValue: string) {
  const termEntry = termEntries.value.find((entry) => entry.term === termValue)
  if (!termEntry || termEntry.runs.length === 0) {
    savedSchedule.value = null
    return
  }

  try {
    const response = await $fetch<ScheduleTermRunsResponse>(
      `/api/schedule/${encodeURIComponent(termValue)}/all`,
    )
    const latestRunId = termEntry.runs[0]?._id
    savedSchedule.value =
      response.schedules.find(
        (schedule: SavedScheduleDetails) => schedule._id === latestRunId,
      ) ??
      response.schedules[0] ??
      null
  } catch {
    savedSchedule.value = null
  }
}

async function loadHistorySummaries() {
  historyPending.value = true
  historyLoadError.value = ''

  try {
    historyItems.value = await $fetch<SavedScheduleSummary[]>('/api/schedule')
  } catch (error) {
    historyLoadError.value = extractErrorMessage(error)
  } finally {
    historyPending.value = false
  }
}

function toggleHistoryPopover(event: Event) {
  historyPopover.value?.toggle(event)
  void loadHistorySummaries()
}

function openFullHistory() {
  historyPopover.value?.hide?.()
  navigateTo('/admin/schedule_viewer')
}

function openHistoryItem(history: SavedScheduleSummary) {
  historyPopover.value?.hide?.()
  navigateTo({
    path: '/admin/schedule_viewer',
    query: {
      term: history.term,
      run: String(history.runNumber),
    },
  })
}

async function openRunInEditor() {
  let scheduleToOpen = savedSchedule.value

  if (runResult.value && !runResultIsSaved.value) {
    openEditorPending.value = true
    setStatus(
      `Saving ${selectedTerm.value} before opening the editor...`,
      'info',
    )
    scheduleToOpen = await saveRunVersion()
    openEditorPending.value = false
  }

  if (!scheduleToOpen) return

  await navigateTo({
    path: '/admin/schedule_viewer',
    query: {
      term: scheduleToOpen.term,
      run: String(scheduleToOpen.runNumber),
    },
  })
}

async function loadTermContext() {
  const nextTerm = term.value.trim()
  if (!nextTerm) {
    setStatus('Enter or select a term before loading.', 'warn')
    return
  }

  termContextPending.value = true
  try {
    selectedTerm.value = nextTerm
    runResult.value = null
    runResultIsSaved.value = false
    await Promise.all([
      loadForTerm(nextTerm),
      loadLatestSavedSchedule(nextTerm),
    ])
    setStatus(`Loaded schedule context for ${nextTerm}.`, 'success')
  } catch (error) {
    setStatus(extractErrorMessage(error), 'error')
  } finally {
    termContextPending.value = false
  }
}

async function runSchedule() {
  if (!selectedTerm.value) return

  runPending.value = true
  setStatus(`Running the scheduler for ${selectedTerm.value}...`, 'info')

  try {
    runResult.value = await $fetch<ScheduleRunResponse>('/api/schedule/run', {
      method: 'POST',
      body: { term: selectedTerm.value },
    })
    runResultIsSaved.value = false
    setStatus(
      `Generated ${runResult.value.assignments.length} assignment(s) for ${selectedTerm.value}. Save the result if you want to keep it.`,
      'success',
    )
  } catch (error) {
    setStatus(extractErrorMessage(error), 'error')
  } finally {
    runPending.value = false
  }
}

async function saveRunVersion() {
  if (!runResult.value || !selectedTerm.value) return null

  savePending.value = true
  try {
    const saveStatus: ScheduleStatus =
      runResult.value.conflicts.length > 0 ||
      runResult.value.nearHardFlags.length > 0 ||
      runResult.value.assignments.length === 0
        ? 'under_review'
        : 'draft'

    const response = await $fetch<ScheduleSaveResponse>('/api/schedule', {
      method: 'POST',
      body: {
        term: selectedTerm.value,
        status: saveStatus,
        assignments: runResult.value.assignments,
        conflicts: runResult.value.conflicts,
        warnings: runResult.value.warnings,
        nearHardFlags: runResult.value.nearHardFlags,
        traces: runResult.value.traces,
      },
    })

    savedSchedule.value = response.schedules[0] ?? null
    runResultIsSaved.value = true
    await loadAvailableTerms()
    void loadHistorySummaries()
    setStatus(
      savedSchedule.value
        ? `Saved ${selectedTerm.value} as run ${savedSchedule.value.runNumber}.`
        : `Saved a new version for ${selectedTerm.value}.`,
      'success',
    )
    return savedSchedule.value
  } catch (error) {
    runResultIsSaved.value = false
    setStatus(extractErrorMessage(error), 'error')
    return null
  } finally {
    savePending.value = false
  }
}

async function approveSavedSchedule() {
  if (!savedSchedule.value) return

  approvalPending.value = true
  try {
    savedSchedule.value = await $fetch<SavedScheduleDetails>(
      `/api/schedule/${encodeURIComponent(savedSchedule.value.term)}`,
      {
        method: 'PATCH',
        body: {
          runNumber: savedSchedule.value.runNumber,
          status: 'approved',
        },
      },
    )
    await loadAvailableTerms()
    void loadHistorySummaries()
    setStatus(
      `Approved ${savedSchedule.value.term} run ${savedSchedule.value.runNumber}.`,
      'success',
    )
  } catch (error) {
    setStatus(extractErrorMessage(error), 'error')
  } finally {
    approvalPending.value = false
  }
}

async function reopenSavedSchedule() {
  if (!savedSchedule.value) return

  approvalPending.value = true
  try {
    savedSchedule.value = await $fetch<SavedScheduleDetails>(
      `/api/schedule/${encodeURIComponent(savedSchedule.value.term)}`,
      {
        method: 'PATCH',
        body: {
          runNumber: savedSchedule.value.runNumber,
          status: 'under_review',
        },
      },
    )
    await loadAvailableTerms()
    void loadHistorySummaries()
    setStatus(
      `Reopened ${savedSchedule.value.term} run ${savedSchedule.value.runNumber} for review.`,
      'success',
    )
  } catch (error) {
    setStatus(extractErrorMessage(error), 'error')
  } finally {
    approvalPending.value = false
  }
}

async function exportSavedSchedule(format: ScheduleExportFormat) {
  if (!savedSchedule.value) return

  exportPending.value = true
  try {
    await downloadScheduleExport(
      savedSchedule.value.term,
      savedSchedule.value.runNumber,
      format,
    )

    savedSchedule.value = {
      ...savedSchedule.value,
      status: 'exported',
    }
    await loadAvailableTerms()
    void loadHistorySummaries()
    setStatus(
      `Exported ${savedSchedule.value.term} run ${savedSchedule.value.runNumber} as ${format.toUpperCase()}.`,
      'success',
    )
  } catch (error) {
    setStatus(extractErrorMessage(error), 'error')
  } finally {
    exportPending.value = false
  }
}

onMounted(async () => {
  try {
    await loadAvailableTerms()
    if (term.value) {
      await loadTermContext()
    }
  } catch (error) {
    setStatus(extractErrorMessage(error), 'error')
  }
})
</script>

<style scoped>
.schedule-admin-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 0.75rem 0 2rem;
}

.schedule-admin-layout {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.schedule-admin-hero :deep(.p-card-body) {
  padding: 1.25rem;
}

.schedule-admin-column-card :deep(.p-card-header) {
  padding: 1.1rem 1.25rem 0;
}

.schedule-admin-column-card :deep(.p-card-body) {
  padding: 1rem 1.25rem 1.25rem;
}

.schedule-admin-hero {
  border: 1px solid rgba(148, 163, 184, 0.25);
  box-shadow: 0 22px 38px rgba(15, 23, 42, 0.08);
}

.schedule-admin-column-card {
  min-width: 0;
}

.schedule-admin-hero__content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
}

.schedule-admin-hero__copy {
  max-width: 40rem;
}

.schedule-admin-hero__title {
  margin: 0 0 0.5rem;
  font-size: 1.45rem;
}

.schedule-admin-hero__text {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.schedule-admin-hero__controls {
  display: flex;
  align-items: flex-end;
  gap: 0.85rem;
  min-width: min(20rem, 100%);
}

.schedule-admin-hero__buttons {
  display: flex;
  gap: 0.75rem;
  flex-wrap: nowrap;
  align-items: center;
}

.schedule-field {
  display: grid;
  gap: 0.45rem;
  min-width: 14rem;
  flex: 1 1 16rem;
}

.schedule-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.schedule-admin-hero__buttons :deep(.p-button) {
  flex: 1 1 0;
  white-space: nowrap;
  padding: 0.5rem 1.1rem;
}

.schedule-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.schedule-card-header__title {
  margin: 0;
  font-size: 1.1rem;
}

.schedule-card-header__subtitle {
  margin: 0.35rem 0 0;
  color: var(--color-text-muted);
}

.schedule-card-header__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.schedule-history-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  padding: 0;
  border: 1px solid rgba(148, 163, 184, 0.45);
  border-radius: 999px;
  background: #fff;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease;
}

.schedule-history-trigger:hover {
  border-color: rgba(59, 130, 246, 0.45);
  background: #f8fafc;
  color: #2563eb;
}

.schedule-history-trigger:focus-visible {
  outline: 2px solid rgba(59, 130, 246, 0.35);
  outline-offset: 2px;
}

.schedule-history-trigger .pi {
  font-size: 1rem;
}

.schedule-history-popover {
  display: grid;
  gap: 0.85rem;
  width: min(26rem, 80vw);
}

.schedule-history-popover__header {
  display: grid;
  gap: 0.2rem;
}

.schedule-history-popover__header small,
.schedule-history-popover__item small,
.schedule-history-popover__empty {
  color: var(--color-text-muted);
}

.schedule-history-popover__list {
  display: grid;
  gap: 0.6rem;
}

.schedule-history-popover__item {
  display: grid;
  gap: 0.4rem;
  width: 100%;
  padding: 0.85rem 0.95rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 14px;
  background: #fff;
  text-align: left;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    transform 0.2s ease;
}

.schedule-history-popover__item:hover {
  border-color: rgba(59, 130, 246, 0.35);
  background: #f8fafc;
  transform: translateY(-1px);
}

.schedule-history-popover__item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.schedule-history-popover__empty {
  padding: 0.5rem 0;
}

.schedule-history-popover__empty--error {
  color: #b91c1c;
}

.schedule-history-popover__footer-action {
  justify-self: flex-start;
  padding-left: 0;
}

.schedule-message {
  margin: 0;
}

.schedule-loading-state,
.schedule-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  min-height: 12rem;
  text-align: center;
  color: var(--color-text-secondary);
}

.schedule-empty-state__icon {
  font-size: 2rem;
}

.schedule-saved-meta__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.85rem;
}

.schedule-saved-meta__item {
  display: flex;
  align-items: baseline;
  gap: 0.2rem;
  flex-wrap: wrap;
}

.schedule-stat {
  display: grid;
  gap: 0.35rem;
  padding: 0.9rem 1rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 16px;
  background: linear-gradient(180deg, #fff, #f8fafc);
}

.schedule-stat__label,
.schedule-saved-meta__label {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.schedule-result-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.85rem;
  margin-top: 1rem;
}

.schedule-result-overview__card {
  display: grid;
  gap: 0.35rem;
  padding: 0.95rem 1rem;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background:
    radial-gradient(
      circle at top right,
      rgba(59, 130, 246, 0.08),
      transparent 50%
    ),
    #fff;
}

.schedule-result-overview__card strong {
  font-size: 1.35rem;
}

.schedule-result-overview__label {
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.schedule-admin-columns {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr);
  gap: 1.25rem;
}

.schedule-action-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.schedule-result-stack,
.schedule-subsection,
.schedule-saved-meta {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.schedule-subsection h3 {
  margin: 0;
}

.schedule-trace-note {
  margin: 0;
  color: var(--color-text-secondary);
}

.schedule-trace-details {
  display: grid;
  gap: 0.75rem;
}

.schedule-detail-block {
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 16px;
  background: #fff;
  padding: 0.85rem 1rem;
}

.schedule-detail-block__content {
  display: grid;
  gap: 0.6rem;
  padding-top: 0.85rem;
}

.schedule-detail-block__content p {
  margin: 0;
}

.schedule-detail-block__content ul {
  margin: 0.45rem 0 0;
  padding-left: 1.1rem;
}

.schedule-inline-message {
  margin: 0;
}

@media (max-width: 1080px) {
  .schedule-admin-columns {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .schedule-admin-hero__content,
  .schedule-card-header {
    flex-direction: column;
  }

  .schedule-admin-hero__controls {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    min-width: 0;
  }

  .schedule-field,
  .schedule-admin-hero__buttons {
    width: 100%;
  }

  .schedule-admin-hero__buttons :deep(.p-button) {
    flex: 1 1 0;
  }
}

@media (max-width: 640px) {
  .schedule-admin-page {
    padding-top: 0;
  }

  .schedule-action-bar {
    flex-direction: column;
  }
}
</style>
