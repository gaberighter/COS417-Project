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
                showGridlines
                class="schedule-table schedule-table--main"
              >
                <template #empty>
                  <div class="schedule-table-empty">
                    No schedule rows match the current filters.
                  </div>
                </template>
                <Column
                  field="department"
                  header="Dept"
                  sortable
                  :style="{ width: '6.5rem' }"
                >
                  <template #body="{ data }">
                    <ScheduleCellPreview
                      :value="
                        isEditingRow(data.courseId)
                          ? editedCourseDepartment
                          : data.department
                      "
                      title="Department"
                      :max-lines="1"
                    />
                  </template>
                </Column>
                <Column
                  field="courseNumber"
                  header="Course"
                  sortable
                  :style="{ width: '9rem' }"
                >
                  <template #body="{ data }">
                    <ScheduleCellPreview
                      v-if="!isEditingRow(data.courseId)"
                      :value="data.courseNumber"
                      title="Course"
                      :max-lines="1"
                    />
                    <select
                      v-else
                      v-model="editCourseCatalogId"
                      class="schedule-native-select"
                    >
                      <option value="" disabled>Select course</option>
                      <option
                        v-for="option in editableCourseOptions"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </template>
                </Column>
                <Column
                  field="section"
                  header="Section"
                  sortable
                  :style="{ width: '6rem' }"
                >
                  <template #body="{ data }">
                    <ScheduleCellPreview
                      v-if="!isEditingRow(data.courseId)"
                      :value="data.section || 'N/A'"
                      title="Section"
                      :max-lines="1"
                    />
                    <InputText
                      v-else
                      v-model="editCourseSection"
                      fluid
                      placeholder="section"
                    />
                  </template>
                </Column>
                <Column
                  field="courseTitle"
                  header="Title"
                  sortable
                  :style="{ width: '16rem' }"
                >
                  <template #body="{ data }">
                    <ScheduleCellPreview
                      :value="
                        isEditingRow(data.courseId)
                          ? editedCourseTitle
                          : data.courseTitle
                      "
                      title="Course Title"
                      :max-lines="1"
                    />
                  </template>
                </Column>
                <Column
                  field="instructorName"
                  header="Instructor"
                  sortable
                  :style="{ width: '14rem' }"
                >
                  <template #body="{ data }">
                    <ScheduleCellPreview
                      v-if="!isEditingRow(data.courseId)"
                      :value="data.instructorName"
                      title="Instructor"
                      :max-lines="1"
                    />
                    <select
                      v-else
                      v-model="editDraft.professorId"
                      class="schedule-native-select"
                    >
                      <option value="" disabled>Select instructor</option>
                      <option
                        v-for="option in editableInstructorOptions"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </template>
                </Column>
                <Column
                  field="timeLabel"
                  header="Time"
                  sortable
                  :style="{ width: '11rem' }"
                >
                  <template #body="{ data }">
                    <ScheduleCellPreview
                      v-if="!isEditingRow(data.courseId)"
                      :value="data.timeLabel"
                      title="Time"
                      :max-lines="1"
                    />
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
                <Column
                  field="building"
                  header="Building"
                  sortable
                  :style="{ width: '8rem' }"
                >
                  <template #body="{ data }">
                    <ScheduleCellPreview
                      :value="
                        isEditingRow(data.courseId)
                          ? editedRoomBuilding
                          : data.building
                      "
                      title="Building"
                      :max-lines="1"
                    />
                  </template>
                </Column>
                <Column
                  field="roomLabel"
                  header="Room"
                  sortable
                  :style="{ width: '10rem' }"
                >
                  <template #body="{ data }">
                    <ScheduleCellPreview
                      v-if="!isEditingRow(data.courseId)"
                      :value="data.roomLabel"
                      title="Room"
                      :max-lines="1"
                    />
                    <select
                      v-else
                      v-model="editDraft.roomId"
                      class="schedule-native-select"
                    >
                      <option value="" disabled>Select room</option>
                      <option
                        v-for="option in editableRoomOptions"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </template>
                </Column>
                <Column
                  field="enrollment"
                  header="Enroll"
                  sortable
                  :style="{ width: '7rem' }"
                >
                  <template #body="{ data }">
                    <ScheduleCellPreview
                      v-if="!isEditingRow(data.courseId)"
                      :value="data.enrollment ?? 'N/A'"
                      title="Enrollment"
                      :max-lines="1"
                    />
                    <input
                      v-else
                      v-model="editEnrollmentValue"
                      type="number"
                      min="0"
                      class="schedule-native-input"
                      placeholder="enrollment"
                    />
                  </template>
                </Column>
                <Column
                  field="overrideBy"
                  header="Override By"
                  sortable
                  :style="{ width: '11rem' }"
                >
                  <template #body="{ data }">
                    <ScheduleCellPreview
                      :value="data.overrideBy || 'N/A'"
                      title="Override By"
                      :max-lines="1"
                    />
                  </template>
                </Column>
                <Column header="Actions" :style="{ width: '9rem' }">
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
                  showGridlines
                  class="schedule-table schedule-table--issues"
                >
                  <template #empty>
                    <div class="schedule-table-empty">
                      No conflicts saved for this run.
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
                  :value="selectedNearHardFlagRows"
                  stripedRows
                  showGridlines
                  class="schedule-table schedule-table--issues"
                >
                  <template #empty>
                    <div class="schedule-table-empty">
                      No near-hard flags were saved for this run.
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
                  Condensed placement trace for review. Open the saved export if
                  you need the full raw trace payload.
                </p>
                <DataTable
                  :value="selectedTraceRows"
                  stripedRows
                  showGridlines
                  class="schedule-table schedule-table--trace"
                >
                  <template #empty>
                    <div class="schedule-table-empty">
                      No placement traces were saved for this run.
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
                  <Column field="candidateSummary" header="Candidates">
                    <template #body="{ data }">
                      <ScheduleCellPreview
                        :value="data.candidateSummary"
                        title="Candidates"
                      />
                    </template>
                  </Column>
                  <Column field="candidatePreview" header="Preview">
                    <template #body="{ data }">
                      <ScheduleCellPreview
                        :value="data.candidatePreview"
                        title="Candidate Preview"
                      />
                    </template>
                  </Column>
                  <Column field="notesSummary" header="Notes">
                    <template #body="{ data }">
                      <ScheduleCellPreview
                        :value="data.notesSummary"
                        title="Notes"
                      />
                    </template>
                  </Column>
                </DataTable>

                <div
                  v-if="selectedTraceRows.length"
                  class="schedule-trace-details"
                >
                  <details
                    v-for="trace in selectedTraceRows"
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  buildScheduledCourseId,
  buildEnrichedScheduleRows,
  buildIssueTableRows,
  buildTraceTableRows,
  normalizeCourseReference,
} from '~~/app/utils/schedule'
import {
  downloadScheduleExport,
  type ScheduleExportFormat,
} from '~~/app/utils/scheduleExport'
import { useScheduleReferenceData } from '~~/app/composables/useScheduleReferenceData'
import type {
  ProfessorRecord,
  RoomRecord,
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

type EditSelectOption = {
  value: string
  label: string
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
  enrollmentOverride: null,
  overrideBy: null,
})

const editCourseCatalogId = ref('')
const editCourseSection = ref('')
const editEnrollmentValue = ref('')

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

const { lookups, courses, professors, rooms, loadForTerm } =
  useScheduleReferenceData()

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
    lookups.value,
  ),
)

const selectedNearHardFlagRows = computed(() =>
  buildIssueTableRows(
    selectedSchedule.value?.nearHardFlags ?? [],
    enrichedRows.value,
    lookups.value,
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
  buildTraceTableRows(selectedSchedule.value?.traces ?? [], lookups.value),
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

function formatEditableCourseLabel(course: {
  deptCode: string
  courseNumber: string
  title: string
}) {
  return `${course.deptCode} ${course.courseNumber} - ${course.title}`
}

function formatEditableInstructorLabel(professor: ProfessorRecord) {
  const name = professor.displayName?.trim() ?? ''
  const covenantId = professor.covenantId?.trim() ?? ''
  return name && covenantId ? `${name} (${covenantId})` : name || covenantId
}

function formatEditableRoomLabel(room: RoomRecord) {
  return (
    room.abbreviation?.trim() ||
    room.displayName?.trim() ||
    `${room.buildingName} ${room.roomNumber}`.trim()
  )
}

function includeCurrentOption(
  options: EditSelectOption[],
  currentValue: string,
  label: string,
) {
  if (
    !currentValue ||
    options.some((option) => option.value === currentValue)
  ) {
    return options
  }

  return [{ value: currentValue, label }, ...options]
}

const editableCourseOptions = computed<EditSelectOption[]>(() => {
  const options = courses.value
    .map((course) => ({
      value: course._id,
      label: formatEditableCourseLabel(course),
    }))
    .sort((left, right) => left.label.localeCompare(right.label))

  const currentValue = editCourseCatalogId.value.trim()
  const currentCourse = lookups.value.coursesById.get(currentValue)
  const currentLabel = currentCourse
    ? formatEditableCourseLabel(currentCourse)
    : currentValue

  return includeCurrentOption(options, currentValue, currentLabel)
})

const editableInstructorOptions = computed<EditSelectOption[]>(() => {
  const options = professors.value
    .map((professor) => ({
      value: professor._id,
      label: formatEditableInstructorLabel(professor),
    }))
    .sort((left, right) => left.label.localeCompare(right.label))

  const currentValue = editDraft.professorId.trim()
  const currentLabel =
    lookups.value.professorsById.get(currentValue)?.displayName ?? currentValue

  return includeCurrentOption(options, currentValue, currentLabel)
})

const editedCourseRecord = computed(() => {
  const currentValue = editCourseCatalogId.value.trim()
  if (!currentValue) return null

  return (
    courses.value.find((course) => course._id === currentValue) ??
    lookups.value.coursesById.get(currentValue) ??
    null
  )
})

const editedCourseDepartment = computed(() => {
  if (editedCourseRecord.value) {
    return editedCourseRecord.value.deptCode
  }

  return normalizeCourseReference(editDraft.courseId).catalogCourseId.split(
    /\s+/,
  )[0]
})

const editedCourseTitle = computed(() => {
  if (editedCourseRecord.value) {
    return editedCourseRecord.value.title
  }

  return normalizeCourseReference(editDraft.courseId).catalogCourseId
})

const editedRoomRecord = computed(() => {
  const currentValue = editDraft.roomId.trim()
  if (!currentValue) return null

  return rooms.value.find((room) => room._id === currentValue) ?? null
})

const editedRoomBuilding = computed(() => {
  if (editedRoomRecord.value) {
    return (
      editedRoomRecord.value.abbreviation?.split(/\s+/)[0] ||
      editedRoomRecord.value.buildingName
    )
  }

  const fallbackRoom = lookups.value.roomsById.get(editDraft.roomId.trim())
  return fallbackRoom?.abbreviation?.split(/\s+/)[0] ?? editDraft.roomId
})

const editableRoomOptions = computed<EditSelectOption[]>(() => {
  const options = rooms.value
    .map((room) => ({
      value: room._id,
      label: formatEditableRoomLabel(room),
    }))
    .sort((left, right) => left.label.localeCompare(right.label))

  const currentValue = editDraft.roomId.trim()
  const currentLabel =
    lookups.value.roomsById.get(currentValue)?.abbreviation ?? currentValue

  return includeCurrentOption(options, currentValue, currentLabel)
})

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

  return matchingSchedules[0] ?? null
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
  const normalizedCourse = normalizeCourseReference(assignment.courseId)
  editCourseCatalogId.value = normalizedCourse.catalogCourseId
  editCourseSection.value = normalizedCourse.section ?? ''
  editEnrollmentValue.value =
    assignment.enrollmentOverride !== null &&
    assignment.enrollmentOverride !== undefined
      ? String(assignment.enrollmentOverride)
      : ''
}

function cancelEdit() {
  editingCourseId.value = null
  editCourseCatalogId.value = ''
  editCourseSection.value = ''
  editEnrollmentValue.value = ''
}

function validateEditDraft() {
  if (!editCourseCatalogId.value.trim()) {
    return 'Please provide a course before saving.'
  }

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

  const enrollmentText = editEnrollmentValue.value.trim()
  if (
    enrollmentText &&
    (!/^\d+$/.test(enrollmentText) || Number(enrollmentText) < 0)
  ) {
    return 'Please provide a non-negative enrollment value.'
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
    const nextCourseId = buildScheduledCourseId(
      editCourseCatalogId.value,
      editCourseSection.value || null,
    )
    const enrollmentOverride = editEnrollmentValue.value.trim()
      ? Number(editEnrollmentValue.value.trim())
      : null

    await $fetch(
      `/api/schedule/${encodeURIComponent(selectedSchedule.value.term)}/assignment`,
      {
        method: 'PATCH',
        body: {
          runNumber: selectedSchedule.value.runNumber,
          originalCourseId: editingCourseId.value,
          assignment: {
            courseId: nextCourseId,
            professorId: editDraft.professorId,
            roomId: editDraft.roomId,
            days: editDraft.days,
            startTime: editDraft.startTime,
            endTime: editDraft.endTime,
            enrollmentOverride,
          },
        },
      },
    )

    await refreshSelectedSchedule()
    editingCourseId.value = null
    editCourseCatalogId.value = ''
    editCourseSection.value = ''
    editEnrollmentValue.value = ''
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
    findScheduleFromQuery() ?? scheduleItems.value[0] ?? null
  if (!initialSchedule) {
    selectedTerm.value =
      normalizeQueryValue(route.query.term).trim() || termKeys.value[0] || ''
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
  min-width: 0;
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
  min-width: 0;
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
  flex-wrap: wrap;
  gap: 0.75rem;
  grid-column: 1 / -1;
  min-width: 0;
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
  min-width: 0;
}

.schedule-filter-grid label {
  display: grid;
  gap: 0.45rem;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.schedule-native-select,
.schedule-native-input {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.7rem 0.85rem;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.42);
  background: #fff;
  color: var(--color-text-primary);
  box-sizing: border-box;
}

.schedule-native-select:focus-visible,
.schedule-native-input:focus-visible {
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

.schedule-subsection h3 {
  margin: 0;
}

.schedule-trace-note {
  margin: -0.35rem 0 0;
  color: var(--color-text-muted);
  font-size: 0.82rem;
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
