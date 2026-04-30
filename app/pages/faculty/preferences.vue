<template>
  <div class="pref-page">
    <!-- ───────────────────────── PAGE HEADER ───────────────────────── -->
    <div class="pref-topbar">
      <div class="pref-topbar__brand">
        <span class="pref-topbar__label">Faculty Preference Intake</span>
      </div>
      <Tag
        :value="submissionStatusTagValue"
        :severity="submissionStatusSeverity"
        class="pref-topbar__status"
        rounded
      />
    </div>

    <div class="pref-layout">
      <!-- ─────────────────────── HERO CARD ─────────────────────── -->
      <Card class="pref-hero-card">
        <template #content>
          <div class="pref-hero-inner">
            <div class="pref-hero-copy">
              <h1 class="pref-hero-copy__title">
                Faculty Preferences Submission Dashboard
              </h1>
            </div>

            <div class="pref-hero-controls">
              <!-- Term -->
              <div class="pref-field">
                <label class="pref-label" for="pref-term">Current Term</label>
                <AutoComplete
                  id="pref-term"
                  v-model="term"
                  :suggestions="termSuggestions"
                  dropdown
                  completeOnFocus
                  :minLength="0"
                  :disabled="loadPending || savePending"
                  appendTo="body"
                  inputClass="pref-autocomplete-input"
                  panelClass="pref-autocomplete-panel"
                  placeholder="e.g. Fall-2026"
                  class="w-full"
                  @complete="searchTermSuggestions"
                  @blur="handleTermChange"
                />
              </div>

              <!-- Action buttons -->
              <div class="pref-actions">
                <Button
                  label="Add Row"
                  severity="secondary"
                  outlined
                  :disabled="loadPending || savePending"
                  @click="addRow"
                />
                <Button
                  label="Clear"
                  severity="secondary"
                  outlined
                  :disabled="loadPending || savePending"
                  @click="resetTable"
                />
                <Button
                  label="Upload CSV"
                  severity="secondary"
                  outlined
                  :disabled="loadPending || savePending"
                  @click="triggerCsvUpload"
                />
                <Button
                  :label="saveNotSubmittedLabel"
                  severity="secondary"
                  :disabled="referencePending || loadPending || savePending"
                  :loading="savePending"
                  @click="savePreferences('not_submitted')"
                />
                <Button
                  :label="submitLabel"
                  severity="primary"
                  :disabled="referencePending || loadPending || savePending"
                  :loading="savePending"
                  @click="savePreferences('submitted')"
                />
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- ────────────────── FORMAT GUIDE STRIP ────────────────── -->
      <!-- ──────────────── SYSTEM MESSAGES ──────────────── -->
      <Message
        v-if="referenceWarnings.length > 0"
        severity="warn"
        :closable="false"
        class="pref-message"
      >
        <template #icon><i class="pi pi-exclamation-triangle" /></template>
        {{ referenceWarnings.join(' ') }}
      </Message>

      <Message
        v-if="statusMessage"
        :severity="statusMessageSeverity"
        :closable="false"
        class="pref-message"
      >
        {{ statusMessage }}
      </Message>

      <!-- ──────────────────── DATA TABLE CARD ──────────────────── -->
      <Card class="pref-table-card">
        <template #header>
          <div class="pref-table-header">
            <div class="pref-table-header__info">
              <h2 class="pref-table-header__title">
                {{ term || 'Current Term' }}
              </h2>
            </div>
          </div>
        </template>

        <template #content>
          <DataTable
            class="pref-datatable"
            :value="rows"
            dataKey="localId"
            scrollable
            showGridlines
            stripedRows
            tableStyle="min-width: 70rem"
            :rowClass="preferenceRowClass"
          >
            <template #empty>
              <div class="pref-empty">
                <i class="pi pi-inbox pref-empty__icon" />
                <p class="pref-empty__text">No preference rows yet.</p>
                <Button
                  label="Add Your First Row"
                  severity="primary"
                  @click="addRow"
                />
              </div>
            </template>

            <!-- Subject -->
            <Column header="Subject" style="width: 7rem">
              <template #body="{ data }">
                <AutoComplete
                  v-model="data.subject"
                  :suggestions="subjectSuggestions"
                  dropdown
                  completeOnFocus
                  :minLength="0"
                  appendTo="body"
                  fluid
                  inputClass="pref-cell-input"
                  panelClass="pref-autocomplete-panel"
                  :placeholder="
                    data.localId === rows[0]?.localId ? 'COR 100' : ''
                  "
                  @complete="searchSubjectSuggestions"
                  @update:modelValue="clearRowError(data)"
                  @blur="handleSubjectChange(data)"
                />
              </template>
            </Column>

            <!-- CRN -->
            <Column header="CRN" style="width: 7rem">
              <template #body="{ data }">
                <AutoComplete
                  v-model="data.crn"
                  :suggestions="crnSuggestions"
                  dropdown
                  completeOnFocus
                  :minLength="0"
                  appendTo="body"
                  fluid
                  inputClass="pref-cell-input"
                  panelClass="pref-autocomplete-panel"
                  :placeholder="
                    data.localId === rows[0]?.localId ? '00000' : ''
                  "
                  @complete="searchCrnSuggestions"
                  @update:modelValue="clearRowError(data)"
                  @blur="handleCrnChange(data)"
                />
              </template>
            </Column>

            <!-- Section -->
            <Column header="Section" style="width: 5rem">
              <template #body="{ data }">
                <AutoComplete
                  v-model="data.section"
                  :suggestions="sectionSuggestions"
                  dropdown
                  completeOnFocus
                  :minLength="0"
                  appendTo="body"
                  fluid
                  inputClass="pref-cell-input"
                  panelClass="pref-autocomplete-panel"
                  :placeholder="data.localId === rows[0]?.localId ? '001' : ''"
                  @complete="searchSectionSuggestions"
                  @update:modelValue="clearRowError(data)"
                  @blur="handleSectionChange(data)"
                />
              </template>
            </Column>

            <!-- Course Name -->
            <Column header="Course Name" style="width: 15rem">
              <template #body="{ data }">
                <AutoComplete
                  v-model="data.courseName"
                  :suggestions="courseNameSuggestions[data.localId] ?? []"
                  dropdown
                  completeOnFocus
                  :minLength="0"
                  appendTo="body"
                  fluid
                  inputClass="pref-cell-input"
                  panelClass="pref-autocomplete-panel"
                  :placeholder="
                    data.localId === rows[0]?.localId ? 'Cornerstone' : ''
                  "
                  @complete="searchCourseNameSuggestions(data, $event)"
                  @update:modelValue="clearRowError(data)"
                  @blur="handleCourseNameChange(data)"
                />
              </template>
            </Column>

            <!-- Credits -->
            <Column header="Credits" style="width: 5rem">
              <template #body="{ data }">
                <AutoComplete
                  v-model="data.creditHours"
                  :suggestions="creditHourSuggestions"
                  dropdown
                  completeOnFocus
                  :minLength="0"
                  appendTo="body"
                  fluid
                  inputClass="pref-cell-input"
                  panelClass="pref-autocomplete-panel"
                  :placeholder="data.localId === rows[0]?.localId ? '3' : ''"
                  @complete="searchCreditHourSuggestions"
                  @update:modelValue="clearRowError(data)"
                  @blur="handleCreditHoursChange(data)"
                />
              </template>
            </Column>

            <!-- Max Enroll -->
            <Column header="Max Enroll" style="width: 4rem">
              <template #body="{ data }">
                <AutoComplete
                  v-model="data.maxEnrollment"
                  :suggestions="enrollmentSuggestions"
                  dropdown
                  completeOnFocus
                  :minLength="0"
                  appendTo="body"
                  fluid
                  inputClass="pref-cell-input"
                  panelClass="pref-autocomplete-panel"
                  :placeholder="data.localId === rows[0]?.localId ? '35' : ''"
                  @complete="searchEnrollmentSuggestions"
                  @update:modelValue="clearRowError(data)"
                  @blur="handleMaxEnrollmentChange(data)"
                />
              </template>
            </Column>

            <!-- Days -->
            <Column header="Days" style="width: 5rem">
              <template #body="{ data }">
                <AutoComplete
                  v-model="data.days"
                  :suggestions="daySuggestions"
                  dropdown
                  completeOnFocus
                  :minLength="0"
                  appendTo="body"
                  fluid
                  inputClass="pref-cell-input"
                  panelClass="pref-autocomplete-panel"
                  :placeholder="data.localId === rows[0]?.localId ? 'TR' : ''"
                  @complete="searchDaySuggestions"
                  @update:modelValue="clearRowError(data)"
                  @blur="handleDaysChange(data)"
                />
              </template>
            </Column>

            <!-- Time -->
            <Column header="Time" style="width: 5rem">
              <template #body="{ data }">
                <AutoComplete
                  v-model="data.time"
                  :suggestions="timeSuggestions"
                  dropdown
                  completeOnFocus
                  :minLength="0"
                  appendTo="body"
                  fluid
                  inputClass="pref-cell-input"
                  panelClass="pref-autocomplete-panel"
                  :placeholder="
                    data.localId === rows[0]?.localId ? '12:00' : ''
                  "
                  @complete="searchTimeSuggestions"
                  @update:modelValue="clearRowError(data)"
                  @blur="handleTimeChange(data)"
                />
              </template>
            </Column>

            <!-- Instructor -->
            <Column header="Instructor" style="width: 11rem">
              <template #body="{ data }">
                <AutoComplete
                  v-model="data.instructor"
                  :suggestions="instructorSuggestions"
                  dropdown
                  completeOnFocus
                  :minLength="0"
                  appendTo="body"
                  fluid
                  inputClass="pref-cell-input"
                  panelClass="pref-autocomplete-panel"
                  :placeholder="
                    data.localId === rows[0]?.localId
                      ? 'Firstname Lastname'
                      : ''
                  "
                  @complete="searchInstructorSuggestions"
                  @update:modelValue="clearRowError(data)"
                  @blur="handleInstructorChange(data)"
                />
              </template>
            </Column>

            <!-- Building -->
            <Column header="Building" style="width: 5rem">
              <template #body="{ data }">
                <AutoComplete
                  v-model="data.buildingPreference"
                  :suggestions="buildingSuggestions"
                  dropdown
                  completeOnFocus
                  :minLength="0"
                  appendTo="body"
                  fluid
                  inputClass="pref-cell-input"
                  panelClass="pref-autocomplete-panel"
                  :placeholder="data.localId === rows[0]?.localId ? 'MH' : ''"
                  @complete="searchBuildingSuggestions"
                  @update:modelValue="clearRowError(data)"
                  @blur="handleBuildingChange(data)"
                />
              </template>
            </Column>

            <!-- Room -->
            <Column header="Room" style="width: 6rem">
              <template #body="{ data }">
                <AutoComplete
                  v-model="data.roomPreference"
                  :suggestions="roomSuggestions[data.localId] ?? []"
                  dropdown
                  completeOnFocus
                  :minLength="0"
                  appendTo="body"
                  fluid
                  inputClass="pref-cell-input"
                  panelClass="pref-autocomplete-panel"
                  :placeholder="
                    data.localId === rows[0]?.localId ? 'MH 270' : ''
                  "
                  @complete="searchRoomSuggestions(data, $event)"
                  @update:modelValue="clearRowError(data)"
                  @blur="handleRoomChange(data)"
                />
              </template>
            </Column>

            <!-- Fee -->
            <Column header="Fee" style="width: 5rem">
              <template #body="{ data }">
                <AutoComplete
                  v-model="data.courseFee"
                  :suggestions="courseFeeSuggestions"
                  dropdown
                  completeOnFocus
                  :minLength="0"
                  appendTo="body"
                  fluid
                  inputClass="pref-cell-input"
                  panelClass="pref-autocomplete-panel"
                  :placeholder="
                    data.localId === rows[0]?.localId ? '00.00' : ''
                  "
                  @complete="searchCourseFeeSuggestions"
                  @update:modelValue="clearRowError(data)"
                  @blur="handleCourseFeeChange(data)"
                />
              </template>
            </Column>

            <!-- Row Actions -->
            <Column header="Actions" style="width: 12rem">
              <template #body="{ data }">
                <div class="pref-row-actions">
                  <div class="pref-row-actions__buttons">
                    <Button
                      label="Duplicate"
                      severity="secondary"
                      outlined
                      size="small"
                      @click="duplicateRow(data)"
                    />
                    <Button
                      label="Delete"
                      severity="danger"
                      outlined
                      size="small"
                      @click="removeRow(data.localId)"
                    />
                  </div>
                  <small v-if="data.error" class="pref-row-error">
                    <i class="pi pi-exclamation-circle" /> {{ data.error }}
                  </small>
                  <small v-else class="pref-row-hint">
                    Search or type a valid value.
                  </small>
                </div>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>
    </div>

    <input
      ref="csvFileInput"
      type="file"
      accept=".csv,text/csv"
      style="display: none"
      @change="handleCsvUpload"
    />
  </div>
</template>

<script setup lang="ts">
import type { Ref } from 'vue'

definePageMeta({
  pageTitle: 'Faculty Preferences',
})

type PreferenceStatus = 'not_submitted' | 'submitted'

type CourseRecord = {
  _id: string
  deptCode: string
  courseNumber: string
  title: string
  creditHours: number
  typicalEnrollment?: number | null
  typicalProfessor?: string | null
  typicalDays?: string | null
  typicalTime?: string | null
}

type ProfessorRecord = {
  _id: string
  covenantId: string
  displayName: string
}

type RoomRecord = {
  _id: string
  abbreviation: string
  buildingName: string
  roomNumber: string
  displayName?: string | null
}

type ExistingPreferenceCourse = {
  courseId: string
  section?: string | null
  crn?: string | null
  title: string
  expectedEnrollment: number
  maxCapacity?: number | null
  creditHours: number
  preferredDays?: string[]
  preferredTimes?: string[]
  instructor?: string | null
  preferredBuilding?: string | null
  preferredRoomId?: string | null
  courseFee?: number | null
}

type FacultyPreferenceSubmission = {
  professorId: string
  covenantId: string
  displayName: string
  departmentCode: string
  term: string
  department: string
  submittedBy: string
  submittedAt?: string | null
  status: PreferenceStatus
  courses: ExistingPreferenceCourse[]
}

type BuildingOption = {
  code: string
  label: string
}

type RoomOption = RoomRecord & {
  buildingCode: string
  label: string
}

type PreferenceRow = {
  localId: number
  courseId: string | null
  subject: string
  crn: string
  section: string
  courseName: string
  creditHours: string
  maxEnrollment: string
  days: string
  time: string
  instructor: string
  buildingPreference: string
  roomPreference: string
  courseFee: string
  error: string
}

type PreferencePayloadCourse = {
  courseId: string
  section: string
  crn: string | null
  title: string
  expectedEnrollment: number
  maxCapacity: number
  creditHours: number
  preferredDays: string[]
  preferredTimes: string[]
  avoidTimes: string[]
  requiredEquipment: string[]
  instructor: string
  preferredBuilding: string | null
  preferredRoomId: string | null
  courseFee: number | null
  backToBackWith: null
  coreqWith: string[]
}

type FetchLikeError = Error & {
  data?: {
    statusCode?: number
    statusMessage?: string
  }
}

type AutoCompleteCompleteEvent = {
  query: string
}

const TERM_PATTERN = /^[A-Za-z0-9_-]{1,32}$/
const CRN_PATTERN = /^\d{4,10}$/
const SECTION_PATTERN = /^[A-Za-z0-9-]{1,8}$/
const NUMBER_PATTERN = /^\d+(?:\.\d+)?$/
const WHOLE_NUMBER_PATTERN = /^\d+$/
const TIME_PATTERN = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
const INSTRUCTOR_PATTERN = /^[A-Za-z][A-Za-z0-9 .,'-]{1,79}$/
const BUILDING_PATTERN = /^[A-Za-z]{2,8}$/
const ROOM_PATTERN = /^[A-Za-z0-9-]{2,12}\s+[A-Za-z0-9-]{1,12}$/

const defaultSectionSuggestions = ['001', '002', '003', '004', 'A1', 'B1']
const defaultCourseFeeSuggestions = [
  '0.00',
  '25.00',
  '50.00',
  '75.00',
  '100.00',
]
const dayPatternOptions = [
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

const courseCatalog = ref<CourseRecord[]>([])
const professors = ref<ProfessorRecord[]>([])
const rooms = ref<RoomRecord[]>([])
const rows = ref<PreferenceRow[]>([])
const term = ref('')
const statusMessage = ref('')
const statusTone = ref<'info' | 'success' | 'error' | 'warning'>('info')
const referenceWarnings = ref<string[]>([])
const referencePending = ref(true)
const loadPending = ref(false)
const savePending = ref(false)
const submissionExists = ref(false)
const submissionStatus = ref<FacultyPreferenceSubmission['status'] | null>(null)
const submissionDepartment = ref<string | null>(null)
const loadedTerm = ref('')
const loadedSnapshot = ref('[]')

const termSuggestions = ref<string[]>([])
const subjectSuggestions = ref<string[]>([])
const crnSuggestions = ref<string[]>([])
const sectionSuggestions = ref<string[]>([])
const creditHourSuggestions = ref<string[]>([])
const enrollmentSuggestions = ref<string[]>([])
const daySuggestions = ref<string[]>([])
const timeSuggestions = ref<string[]>([])
const instructorSuggestions = ref<string[]>([])
const buildingSuggestions = ref<string[]>([])
const courseFeeSuggestions = ref<string[]>([])
const courseNameSuggestions = ref<Record<number, string[]>>({})
const roomSuggestions = ref<Record<number, string[]>>({})

let nextRowId = 1
let latestLoadRequest = 0

const termOptions = computed(() => {
  const current = currentSuggestedTerm()
  const [seasonText, yearText] = current.split('-')
  const year = Number(yearText)
  const seasons = ['Spring', 'Summer', 'Fall']
  const seasonIndex = Math.max(0, seasons.indexOf(seasonText ?? 'Fall'))
  const suggestions = new Set<string>([current])
  for (let offset = 0; offset < 4; offset += 1) {
    const season = seasons[(seasonIndex + offset) % seasons.length]
    const seasonYear =
      year + Math.floor((seasonIndex + offset) / seasons.length)
    suggestions.add(`${season}-${seasonYear}`)
  }
  return [...suggestions]
})

const subjectOptions = computed(() =>
  uniqueSortedStrings(courseCatalog.value.map((c) => subjectLabel(c))),
)
const creditHourOptions = computed(() =>
  uniqueSortedStrings(
    courseCatalog.value.map((c) => String(c.creditHours)),
    true,
  ),
)
const enrollmentOptions = computed(() =>
  uniqueSortedStrings(
    courseCatalog.value
      .map((c) => c.typicalEnrollment)
      .filter((v): v is number => v != null)
      .map((v) => String(v)),
    true,
  ),
)
const timeOptions = computed(() =>
  uniqueSortedStrings(
    courseCatalog.value
      .map((c) => c.typicalTime)
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .map((v) => normalizeTimeValue(v)),
  ),
)
const instructorOptions = computed(() => {
  const names = professors.value
    .map((p) => p.displayName?.trim())
    .filter((v): v is string => Boolean(v))
  const catalog = courseCatalog.value
    .map((c) => c.typicalProfessor?.trim())
    .filter((v): v is string => Boolean(v))
  return uniqueSortedStrings([...names, ...catalog])
})
const roomOptions = computed<RoomOption[]>(() =>
  rooms.value.map((r) => ({
    ...r,
    buildingCode: deriveBuildingCode(r),
    label: roomLabel(r),
  })),
)
const buildingOptions = computed<BuildingOption[]>(() => {
  const lookup = new Map<string, BuildingOption>()
  for (const r of roomOptions.value) {
    if (!lookup.has(r.buildingCode)) {
      lookup.set(r.buildingCode, {
        code: r.buildingCode,
        label: r.buildingName
          ? `${r.buildingCode} | ${r.buildingName}`
          : r.buildingCode,
      })
    }
  }
  return [...lookup.values()].sort((a, b) => a.code.localeCompare(b.code))
})
const buildingLabels = computed(() => buildingOptions.value.map((o) => o.label))
const sectionOptionValues = computed(() =>
  uniqueSortedStrings([
    ...defaultSectionSuggestions,
    ...rows.value
      .map((r) => r.section.trim().toUpperCase())
      .filter((v) => v.length > 0),
  ]),
)
const crnOptionValues = computed(() =>
  uniqueSortedStrings(
    rows.value.map((r) => r.crn.trim()).filter((v) => CRN_PATTERN.test(v)),
    true,
  ),
)
const courseFeeOptionValues = computed(() =>
  uniqueSortedStrings(
    [
      ...defaultCourseFeeSuggestions,
      ...rows.value.map((r) => r.courseFee.trim()).filter((v) => v.length > 0),
    ],
    true,
  ),
)
const courseBySubject = computed(() => {
  const m = new Map<string, CourseRecord>()
  for (const c of courseCatalog.value)
    m.set(normalizeLookupValue(subjectLabel(c)), c)
  return m
})
const coursesByTitle = computed(() => {
  const m = new Map<string, CourseRecord[]>()
  for (const c of courseCatalog.value) {
    const k = normalizeLookupValue(c.title)
    const list = m.get(k) ?? []
    list.push(c)
    m.set(k, list)
  }
  return m
})
const instructorLookup = computed(() => {
  const m = new Map<string, string>()
  for (const p of professors.value) {
    m.set(normalizeLookupValue(p.displayName), p.displayName)
    m.set(normalizeLookupValue(p.covenantId), p.displayName)
    m.set(normalizeLookupValue(p._id), p.displayName)
  }
  for (const i of instructorOptions.value) {
    if (!m.has(normalizeLookupValue(i))) m.set(normalizeLookupValue(i), i)
  }
  return m
})
const roomLookup = computed(() => {
  const m = new Map<string, RoomOption>()
  for (const r of roomOptions.value) {
    m.set(normalizeLookupValue(r._id), r)
    m.set(normalizeLookupValue(r.abbreviation), r)
    m.set(normalizeLookupValue(r.label), r)
  }
  return m
})
const buildingLookup = computed(() => {
  const m = new Map<string, BuildingOption>()
  for (const b of buildingOptions.value) {
    m.set(normalizeLookupValue(b.code), b)
    m.set(normalizeLookupValue(b.label), b)
  }
  return m
})
const rowSnapshot = computed(() => serializeRows(rows.value))
const hasUnsavedChanges = computed(
  () =>
    term.value.trim() !== loadedTerm.value ||
    rowSnapshot.value !== loadedSnapshot.value,
)
const filledRowCount = computed(
  () => rows.value.filter((r) => rowHasAnyContent(r)).length,
)
const submissionModeLabel = computed(() =>
  submissionExists.value ? 'Editing Saved' : 'New Submission',
)
const submissionStatusTagValue = computed(() => {
  if (!submissionStatus.value) return 'Not Yet Saved'
  return submissionStatus.value === 'submitted' ? 'Submitted' : 'Not Submitted'
})
const submissionStatusSeverity = computed<
  'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'contrast'
>(() => {
  if (!submissionStatus.value) return 'secondary'
  return submissionStatus.value === 'submitted' ? 'success' : 'info'
})
const statusMessageSeverity = computed<'success' | 'info' | 'warn' | 'error'>(
  () => {
    if (statusTone.value === 'warning') return 'warn'
    return statusTone.value
  },
)
const saveNotSubmittedLabel = computed(() =>
  savePending.value ? 'Saving…' : 'Save Draft',
)
const submitLabel = computed(() => (savePending.value ? 'Saving…' : 'Submit'))

function currentSuggestedTerm(): string {
  const now = new Date()
  const m = now.getMonth() + 1
  const y = now.getFullYear()
  if (m <= 5) return `Spring-${y}`
  if (m <= 7) return `Summer-${y}`
  return `Fall-${y}`
}

function createEmptyRow(overrides: Partial<PreferenceRow> = {}): PreferenceRow {
  return {
    localId: nextRowId++,
    courseId: null,
    subject: '',
    crn: '',
    section: '',
    courseName: '',
    creditHours: '',
    maxEnrollment: '',
    days: '',
    time: '',
    instructor: '',
    buildingPreference: '',
    roomPreference: '',
    courseFee: '',
    error: '',
    ...overrides,
  }
}

function uniqueSortedStrings(values: string[], numeric = false): string[] {
  const filtered = [...new Set(values.filter((v) => v.trim().length > 0))]
  return filtered.sort((a, b) => {
    if (numeric) {
      const d = Number(a) - Number(b)
      if (Number.isFinite(d) && d !== 0) return d
    }
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  })
}

function normalizeLookupValue(v: string): string {
  return v.trim().replace(/\s+/g, ' ').toUpperCase()
}

function normalizeTimeValue(v: string): string {
  const t = v.trim()
  if (!TIME_PATTERN.test(t)) return t
  const [h, m] = t.split(':')
  return `${String(Number(h)).padStart(2, '0')}:${m}`
}

function subjectLabel(c: CourseRecord): string {
  return `${c.deptCode} ${c.courseNumber}`.trim()
}

function normalizeSubjectInput(v: string): string {
  const t = v.trim()
  const [before] = t.split('|')
  return normalizeLookupValue(before ?? t)
}

function deriveBuildingCode(
  r: Pick<RoomRecord, 'abbreviation' | 'buildingName'>,
): string {
  const a = r.abbreviation?.trim()
  if (a) return (a.split(/\s+/)[0] ?? 'UNK').toUpperCase()
  return r.buildingName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t[0] ?? '')
    .join('')
    .toUpperCase()
}

function roomLabel(r: RoomRecord): string {
  const abbr =
    r.abbreviation?.trim() || `${deriveBuildingCode(r)} ${r.roomNumber}`.trim()
  const dn = r.displayName?.trim()
  if (!dn || normalizeLookupValue(dn) === normalizeLookupValue(abbr))
    return abbr
  return `${abbr} | ${dn}`
}

function resolveCourse(row: PreferenceRow): CourseRecord | null {
  const sk = normalizeSubjectInput(row.subject)
  const tk = normalizeLookupValue(row.courseName)
  const exact = courseBySubject.value.get(sk)
  if (exact) {
    if (tk.length > 0 && normalizeLookupValue(exact.title) !== tk) return null
    return exact
  }
  if (tk.length === 0) return null
  const matches = coursesByTitle.value.get(tk) ?? []
  if (matches.length === 1) return matches[0] ?? null
  return (
    matches.find((c) => normalizeLookupValue(subjectLabel(c)) === sk) ?? null
  )
}

function resolveInstructor(value: string): string | null {
  const t = value.trim()
  if (!t) return null
  const known = instructorLookup.value.get(normalizeLookupValue(t))
  if (known) return known
  if (!INSTRUCTOR_PATTERN.test(t)) return null
  return t
}

function resolveBuildingCode(value: string): string | null {
  const t = value.trim()
  if (!t) return null
  const known = buildingLookup.value.get(normalizeLookupValue(t))
  if (known) return known.code
  const [p] = t.split(/[|:-]/)
  const n = (p ?? t).trim().toUpperCase()
  return BUILDING_PATTERN.test(n) ? n : null
}

function resolveRoomOption(value: string): RoomOption | null {
  const t = value.trim()
  if (!t) return null
  const known = roomLookup.value.get(normalizeLookupValue(t))
  if (known) return known
  if (!ROOM_PATTERN.test(t)) return null
  const [bc, ...rp] = t.toUpperCase().split(/\s+/)
  return {
    _id: t.toUpperCase(),
    abbreviation: t.toUpperCase(),
    buildingName: '',
    roomNumber: rp.join(' '),
    displayName: null,
    buildingCode: bc ?? '',
    label: t.toUpperCase(),
  }
}

function courseNameOptionsForRow(row: PreferenceRow): string[] {
  const sk = normalizeSubjectInput(row.subject)
  const matches =
    sk.length === 0
      ? courseCatalog.value
      : courseCatalog.value.filter(
          (c) =>
            normalizeLookupValue(subjectLabel(c)).includes(sk) ||
            normalizeLookupValue(c.deptCode).includes(sk),
        )
  return uniqueSortedStrings(matches.map((c) => c.title))
}

function roomOptionsForRow(row: PreferenceRow): RoomOption[] {
  const bc = resolveBuildingCode(row.buildingPreference)
  if (!bc) return roomOptions.value
  return roomOptions.value.filter((r) => r.buildingCode === bc)
}

function roomLabelOptionsForRow(row: PreferenceRow): string[] {
  return roomOptionsForRow(row).map((r) => r.label)
}

function clearRowError(row: PreferenceRow) {
  if (row.error.length > 0) row.error = ''
}

function syncRowFromCourse(row: PreferenceRow, course: CourseRecord) {
  row.courseId = course._id
  row.subject = subjectLabel(course)
  row.courseName = course.title
  row.creditHours = String(course.creditHours)
  if (!row.maxEnrollment && course.typicalEnrollment != null)
    row.maxEnrollment = String(course.typicalEnrollment)
  if (!row.days && course.typicalDays) row.days = course.typicalDays
  if (!row.time && course.typicalTime)
    row.time = normalizeTimeValue(course.typicalTime)
  if (!row.instructor && course.typicalProfessor) {
    row.instructor =
      instructorLookup.value.get(
        normalizeLookupValue(course.typicalProfessor),
      ) ?? course.typicalProfessor
  }
}

function mapSavedCourseToRow(course: ExistingPreferenceCourse): PreferenceRow {
  const cc =
    courseCatalog.value.find(
      (c) =>
        c._id === course.courseId ||
        normalizeLookupValue(subjectLabel(c)) ===
          normalizeLookupValue(course.courseId),
    ) ?? null
  const room = course.preferredRoomId
    ? (roomLookup.value.get(normalizeLookupValue(course.preferredRoomId)) ??
      null)
    : null
  const bc = course.preferredBuilding ?? room?.buildingCode ?? ''
  const bl =
    bc.length > 0
      ? (buildingOptions.value.find((o) => o.code === bc)?.label ?? bc)
      : ''
  return createEmptyRow({
    courseId: cc?._id ?? course.courseId,
    subject: cc ? subjectLabel(cc) : course.courseId,
    crn: course.crn ?? '',
    section: course.section ?? '',
    courseName: cc?.title ?? course.title,
    creditHours: String(course.creditHours ?? cc?.creditHours ?? ''),
    maxEnrollment: String(
      course.maxCapacity ?? course.expectedEnrollment ?? '',
    ),
    days: course.preferredDays?.[0] ?? cc?.typicalDays ?? '',
    time: normalizeTimeValue(
      course.preferredTimes?.[0] ?? cc?.typicalTime ?? '',
    ),
    instructor:
      resolveInstructor(course.instructor ?? '') ??
      course.instructor ??
      cc?.typicalProfessor ??
      '',
    buildingPreference: bl,
    roomPreference: room?.label ?? course.preferredRoomId ?? '',
    courseFee:
      course.courseFee != null && Number.isFinite(course.courseFee)
        ? String(course.courseFee)
        : '',
  })
}

function serializeRows(sourceRows: PreferenceRow[]): string {
  return JSON.stringify(
    sourceRows
      .filter((r) => rowHasAnyContent(r))
      .map((r) => ({
        subject: r.subject.trim(),
        crn: r.crn.trim(),
        section: r.section.trim(),
        courseName: r.courseName.trim(),
        creditHours: r.creditHours.trim(),
        maxEnrollment: r.maxEnrollment.trim(),
        days: r.days.trim(),
        time: r.time.trim(),
        instructor: r.instructor.trim(),
        buildingPreference: r.buildingPreference.trim(),
        roomPreference: r.roomPreference.trim(),
        courseFee: r.courseFee.trim(),
      })),
  )
}

function rowHasAnyContent(row: PreferenceRow): boolean {
  return [
    row.subject,
    row.crn,
    row.section,
    row.courseName,
    row.creditHours,
    row.maxEnrollment,
    row.days,
    row.time,
    row.instructor,
    row.buildingPreference,
    row.roomPreference,
    row.courseFee,
  ].some((v) => v.trim().length > 0)
}

function extractErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'data' in error &&
    typeof (error as FetchLikeError).data?.statusMessage === 'string'
  ) {
    return (
      (error as FetchLikeError).data?.statusMessage ??
      'Unable to save preferences.'
    )
  }
  if (error instanceof Error && error.message.trim().length > 0)
    return error.message
  return 'Unable to save preferences.'
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof (error as FetchLikeError)?.data?.statusCode === 'number' &&
    (error as FetchLikeError).data?.statusCode === 404
  )
}

function setLoadedState(
  normalizedTerm: string,
  submission: FacultyPreferenceSubmission | null,
) {
  term.value = normalizedTerm
  submissionExists.value = submission !== null
  submissionStatus.value = submission?.status ?? null
  submissionDepartment.value = submission?.department ?? null
  rows.value = submission?.courses?.length
    ? submission.courses.map((c) => mapSavedCourseToRow(c))
    : [createEmptyRow()]
  loadedTerm.value = normalizedTerm
  loadedSnapshot.value = serializeRows(rows.value)
}

async function loadSavedSubmission(
  requestedTerm: string,
  options: { silent?: boolean } = {},
) {
  const nt = requestedTerm.trim()
  if (!TERM_PATTERN.test(nt)) return
  const reqId = ++latestLoadRequest
  loadPending.value = true
  try {
    const res = await $fetch<
      FacultyPreferenceSubmission | FacultyPreferenceSubmission[] | null
    >(`/api/preferences/${encodeURIComponent(nt)}`)
    if (reqId !== latestLoadRequest) return
    const sub = Array.isArray(res) ? (res[0] ?? null) : res
    setLoadedState(nt, sub)
    if (sub && !options.silent) {
      statusMessage.value = `Loaded saved preferences for ${nt}.`
      statusTone.value = 'info'
    } else if (!sub && !options.silent) {
      statusMessage.value = `No saved preferences found for ${nt}.`
      statusTone.value = 'info'
    }
  } catch (error) {
    if (reqId !== latestLoadRequest) return
    if (isNotFoundError(error)) {
      setLoadedState(nt, null)
      if (!options.silent) {
        statusMessage.value = `No saved preferences found for ${nt}.`
        statusTone.value = 'info'
      }
      return
    }
    statusMessage.value = extractErrorMessage(error)
    statusTone.value = 'error'
  } finally {
    if (reqId === latestLoadRequest) loadPending.value = false
  }
}

function filterStringOptions(
  options: string[],
  query: string,
  limit = 14,
): string[] {
  const nq = normalizeLookupValue(query.trim())
  const filtered =
    nq.length === 0
      ? options
      : options.filter((o) => normalizeLookupValue(o).includes(nq))
  return filtered.slice(0, limit)
}

function updateSuggestions(
  target: Ref<string[]>,
  options: string[],
  event: AutoCompleteCompleteEvent,
  limit = 14,
) {
  target.value = filterStringOptions(options, event.query, limit)
}

function updateRowSuggestions(
  target: Ref<Record<number, string[]>>,
  row: PreferenceRow,
  options: string[],
  event: AutoCompleteCompleteEvent,
  limit = 14,
) {
  target.value = {
    ...target.value,
    [row.localId]: filterStringOptions(options, event.query, limit),
  }
}

function searchTermSuggestions(e: AutoCompleteCompleteEvent) {
  updateSuggestions(termSuggestions, termOptions.value, e, 6)
}
function searchSubjectSuggestions(e: AutoCompleteCompleteEvent) {
  updateSuggestions(subjectSuggestions, subjectOptions.value, e)
}
function searchCrnSuggestions(e: AutoCompleteCompleteEvent) {
  updateSuggestions(crnSuggestions, crnOptionValues.value, e)
}
function searchSectionSuggestions(e: AutoCompleteCompleteEvent) {
  updateSuggestions(sectionSuggestions, sectionOptionValues.value, e)
}
function searchCourseNameSuggestions(
  row: PreferenceRow,
  e: AutoCompleteCompleteEvent,
) {
  updateRowSuggestions(
    courseNameSuggestions,
    row,
    courseNameOptionsForRow(row),
    e,
  )
}
function searchCreditHourSuggestions(e: AutoCompleteCompleteEvent) {
  updateSuggestions(creditHourSuggestions, creditHourOptions.value, e)
}
function searchEnrollmentSuggestions(e: AutoCompleteCompleteEvent) {
  updateSuggestions(enrollmentSuggestions, enrollmentOptions.value, e)
}
function searchDaySuggestions(e: AutoCompleteCompleteEvent) {
  updateSuggestions(
    daySuggestions,
    dayPatternOptions,
    e,
    dayPatternOptions.length,
  )
}
function searchTimeSuggestions(e: AutoCompleteCompleteEvent) {
  updateSuggestions(timeSuggestions, timeOptions.value, e)
}
function searchInstructorSuggestions(e: AutoCompleteCompleteEvent) {
  updateSuggestions(instructorSuggestions, instructorOptions.value, e)
}
function searchBuildingSuggestions(e: AutoCompleteCompleteEvent) {
  updateSuggestions(buildingSuggestions, buildingLabels.value, e)
}
function searchRoomSuggestions(
  row: PreferenceRow,
  e: AutoCompleteCompleteEvent,
) {
  updateRowSuggestions(roomSuggestions, row, roomLabelOptionsForRow(row), e)
}
function searchCourseFeeSuggestions(e: AutoCompleteCompleteEvent) {
  updateSuggestions(courseFeeSuggestions, courseFeeOptionValues.value, e)
}

function handleSubjectChange(row: PreferenceRow) {
  row.subject = row.subject.trim().toUpperCase()
  const c = resolveCourse(row)
  if (c) syncRowFromCourse(row, c)
}
function handleCourseNameChange(row: PreferenceRow) {
  row.courseName = row.courseName.trim()
  const c = resolveCourse(row)
  if (c) syncRowFromCourse(row, c)
}
function handleCrnChange(row: PreferenceRow) {
  row.crn = row.crn.trim()
}
function handleSectionChange(row: PreferenceRow) {
  row.section = row.section.trim().toUpperCase()
}
function handleCreditHoursChange(row: PreferenceRow) {
  row.creditHours = row.creditHours.trim()
}
function handleMaxEnrollmentChange(row: PreferenceRow) {
  row.maxEnrollment = row.maxEnrollment.trim()
}
function handleDaysChange(row: PreferenceRow) {
  row.days = row.days.trim().toUpperCase()
}
function handleTimeChange(row: PreferenceRow) {
  row.time = normalizeTimeValue(row.time)
}
function handleInstructorChange(row: PreferenceRow) {
  const i = resolveInstructor(row.instructor)
  row.instructor = i ?? row.instructor.trim()
}
function handleBuildingChange(row: PreferenceRow) {
  const bc = resolveBuildingCode(row.buildingPreference)
  if (!bc) {
    row.buildingPreference = row.buildingPreference.trim()
    return
  }
  const b = buildingOptions.value.find((o) => o.code === bc) ?? null
  row.buildingPreference = b?.label ?? bc
}
function handleRoomChange(row: PreferenceRow) {
  const r = resolveRoomOption(row.roomPreference)
  if (!r) {
    row.roomPreference = row.roomPreference.trim().toUpperCase()
    return
  }
  row.roomPreference = r.label
  if (!row.buildingPreference) {
    row.buildingPreference =
      buildingOptions.value.find((o) => o.code === r.buildingCode)?.label ??
      r.buildingCode
  }
}
function handleCourseFeeChange(row: PreferenceRow) {
  const t = row.courseFee.trim()
  if (!t) {
    row.courseFee = ''
    return
  }
  row.courseFee = NUMBER_PATTERN.test(t) ? Number(t).toFixed(2) : t
}
async function handleTermChange() {
  const nt = term.value.trim()
  if (!TERM_PATTERN.test(nt) || nt === loadedTerm.value) {
    term.value = nt
    return
  }
  if (hasUnsavedChanges.value) {
    const ok = window.confirm(
      `Load saved preferences for ${nt}? Unsaved changes will be replaced.`,
    )
    if (!ok) {
      term.value = loadedTerm.value || currentSuggestedTerm()
      return
    }
  }
  await loadSavedSubmission(nt)
}

function addRow() {
  rows.value.push(createEmptyRow())
}
function duplicateRow(row: PreferenceRow) {
  rows.value.push(
    createEmptyRow({
      courseId: row.courseId,
      subject: row.subject,
      crn: row.crn,
      section: row.section,
      courseName: row.courseName,
      creditHours: row.creditHours,
      maxEnrollment: row.maxEnrollment,
      days: row.days,
      time: row.time,
      instructor: row.instructor,
      buildingPreference: row.buildingPreference,
      roomPreference: row.roomPreference,
      courseFee: row.courseFee,
    }),
  )
}
function removeRow(localId: number) {
  rows.value = rows.value.filter((r) => r.localId !== localId)
  if (rows.value.length === 0) rows.value = [createEmptyRow()]
}
function resetTable() {
  if (
    !window.confirm(
      'Clear the table? This does not delete anything from the database until you save.',
    )
  )
    return
  rows.value = [createEmptyRow()]
  statusMessage.value = 'Table cleared. Save to persist this change.'
  statusTone.value = 'info'
}

function validateRow(
  row: PreferenceRow,
  status: PreferenceStatus,
): PreferencePayloadCourse | null {
  row.error = ''
  if (!rowHasAnyContent(row)) return null
  const course = resolveCourse(row)
  if (!course) {
    row.error = 'Select a valid course subject and name from the catalog.'
    return null
  }
  const section = row.section.trim().toUpperCase()
  if (!SECTION_PATTERN.test(section)) {
    row.error = 'Section must use 1–8 letters, numbers, or dashes.'
    return null
  }
  const crn = row.crn.trim()
  if (status === 'submitted' && !CRN_PATTERN.test(crn)) {
    row.error = 'CRN is required for submission (4–10 digits).'
    return null
  }
  if (crn && !CRN_PATTERN.test(crn)) {
    row.error = 'CRN must contain 4–10 digits.'
    return null
  }
  const creditHoursText = row.creditHours.trim()
  const creditHours = Number(creditHoursText)
  if (!NUMBER_PATTERN.test(creditHoursText) || creditHours < 0) {
    row.error = 'Credits must be a non-negative number.'
    return null
  }
  const meText = row.maxEnrollment.trim()
  const me = Number(meText)
  if (!WHOLE_NUMBER_PATTERN.test(meText) || !Number.isFinite(me) || me < 0) {
    row.error = 'Max enrollment must be a non-negative whole number.'
    return null
  }
  const days = row.days.trim().toUpperCase()
  if (!dayPatternOptions.includes(days)) {
    row.error = 'Days must match a supported pattern such as MWF or TR.'
    return null
  }
  const nt = normalizeTimeValue(row.time)
  if (!TIME_PATTERN.test(nt)) {
    row.error = 'Time must be in HH:MM format.'
    return null
  }
  const instructor = resolveInstructor(row.instructor)
  if (!instructor) {
    row.error = 'Instructor must be a valid name matching the catalog.'
    return null
  }
  const pb = resolveBuildingCode(row.buildingPreference)
  if (row.buildingPreference.trim() && !pb) {
    row.error = 'Building must be a valid building code.'
    return null
  }
  const pr = resolveRoomOption(row.roomPreference)
  if (row.roomPreference.trim() && !pr) {
    row.error = 'Room must match the format BUILDING ROOM.'
    return null
  }
  if (pb && pr?.buildingCode && pr.buildingCode !== pb) {
    row.error = 'Room must belong to the selected building.'
    return null
  }
  const cfText = row.courseFee.trim()
  if (cfText && !NUMBER_PATTERN.test(cfText)) {
    row.error = 'Course fee must be a non-negative number.'
    return null
  }
  const cf = cfText ? Number(cfText) : null
  if (cf != null && cf < 0) {
    row.error = 'Course fee must be a non-negative number.'
    return null
  }
  row.courseId = course._id
  row.subject = subjectLabel(course)
  row.courseName = course.title
  row.section = section
  row.creditHours = String(creditHours)
  row.maxEnrollment = String(me)
  row.days = days
  row.time = nt
  row.instructor = instructor
  if (pb)
    row.buildingPreference =
      buildingOptions.value.find((o) => o.code === pb)?.label ?? pb
  if (pr) row.roomPreference = pr.label
  if (cf != null) row.courseFee = cf.toFixed(2)
  return {
    courseId: course._id,
    section,
    crn: crn || null,
    title: course.title,
    expectedEnrollment: me,
    maxCapacity: me,
    creditHours,
    preferredDays: [days],
    preferredTimes: [nt],
    avoidTimes: [],
    requiredEquipment: [],
    instructor,
    preferredBuilding: pb,
    preferredRoomId: pr?._id ?? null,
    courseFee: cf,
    backToBackWith: null,
    coreqWith: [],
  }
}

async function savePreferences(status: PreferenceStatus) {
  statusMessage.value = ''
  statusTone.value = 'info'
  const nt = term.value.trim()
  if (!TERM_PATTERN.test(nt)) {
    statusMessage.value =
      'Enter a valid term (letters, numbers, dashes, underscores).'
    statusTone.value = 'error'
    return
  }
  const courses = rows.value
    .map((r) => validateRow(r, status))
    .filter((c): c is PreferencePayloadCourse => c !== null)
  if (rows.value.some((r) => r.error.length > 0)) {
    statusMessage.value = 'Fix the highlighted row errors before saving.'
    statusTone.value = 'error'
    return
  }
  if (courses.length === 0) {
    statusMessage.value =
      'Add at least one completed preference row before saving.'
    statusTone.value = 'error'
    return
  }
  savePending.value = true
  try {
    const patch = submissionExists.value && loadedTerm.value === nt
    if (patch) {
      await $fetch(`/api/preferences/${encodeURIComponent(nt)}`, {
        method: 'PATCH',
        body: {
          department: submissionDepartment.value ?? undefined,
          status,
          courses,
        },
      })
    } else {
      await $fetch('/api/preferences', {
        method: 'POST',
        body: {
          term: nt,
          department: submissionDepartment.value ?? undefined,
          status,
          courses,
        },
      })
    }
    submissionExists.value = true
    submissionStatus.value = status
    loadedTerm.value = nt
    loadedSnapshot.value = serializeRows(rows.value)
    statusMessage.value =
      status === 'submitted'
        ? `Submitted ${courses.length} row(s) for ${nt}.`
        : `Saved ${courses.length} row(s) as draft for ${nt}.`
    statusTone.value = 'success'
  } catch (error) {
    statusMessage.value = extractErrorMessage(error)
    statusTone.value = 'error'
  } finally {
    savePending.value = false
  }
}

async function loadReferenceData() {
  referenceWarnings.value = []
  const [cr, pr, rr] = await Promise.allSettled([
    $fetch<CourseRecord[]>('/api/courses'),
    $fetch<ProfessorRecord[]>('/api/professors'),
    $fetch<RoomRecord[]>('/api/rooms'),
  ])
  if (cr.status === 'fulfilled') courseCatalog.value = cr.value ?? []
  else
    referenceWarnings.value.push(
      'Course catalog unavailable — catalog matching is disabled.',
    )
  if (pr.status === 'fulfilled') professors.value = pr.value ?? []
  else
    referenceWarnings.value.push(
      'Instructor list unavailable — manual entry still works.',
    )
  if (rr.status === 'fulfilled') rooms.value = rr.value ?? []
  else
    referenceWarnings.value.push(
      'Room list unavailable — manual room entry still works.',
    )
}

function preferenceRowClass(row: PreferenceRow): string {
  return row.error.length > 0 ? 'pref-row--invalid' : ''
}

async function loadPageData() {
  referencePending.value = true
  rows.value = [createEmptyRow()]
  term.value = currentSuggestedTerm()
  try {
    await loadReferenceData()
    await loadSavedSubmission(term.value, { silent: true })
    if (submissionExists.value) {
      statusMessage.value = `Loaded saved preferences for ${term.value}.`
      statusTone.value = 'info'
    } else if (courseCatalog.value.length === 0) {
      statusMessage.value =
        'Course catalog could not be loaded — preferences cannot be validated yet.'
      statusTone.value = 'error'
    }
  } finally {
    referencePending.value = false
  }
}

const csvFileInput = ref<HTMLInputElement | null>(null)

function triggerCsvUpload() {
  csvFileInput.value?.click()
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch ?? ''
    }
  }
  fields.push(current)
  return fields
}

// 'courseNumber' is a virtual field — combined with 'subject' to form "DEPT NUM"
type CsvFieldTarget = keyof PreferenceRow | 'courseNumber'

const CSV_COLUMN_MAP: Record<string, CsvFieldTarget> = {
  // subject / dept
  subject: 'subject',
  dept: 'subject',
  department: 'subject',
  course_code: 'subject',
  // course number (separate column, e.g. "course #" or "course number")
  course_number: 'courseNumber',
  course_num: 'courseNumber',
  coursenum: 'courseNumber',
  coursenumber: 'courseNumber',
  num: 'courseNumber',
  number: 'courseNumber',
  // crn
  crn: 'crn',
  course_reference_number: 'crn',
  // section
  section: 'section',
  sec: 'section',
  // course title / name
  course_title: 'courseName',
  coursetitle: 'courseName',
  course_name: 'courseName',
  coursename: 'courseName',
  title: 'courseName',
  // credit hours
  credit_hours: 'creditHours',
  credithours: 'creditHours',
  credits: 'creditHours',
  credit: 'creditHours',
  hours: 'creditHours',
  // max enrollment — "class max" in Covenant sheet
  class_max: 'maxEnrollment',
  classmax: 'maxEnrollment',
  max_enrollment: 'maxEnrollment',
  maxenrollment: 'maxEnrollment',
  max_enroll: 'maxEnrollment',
  max: 'maxEnrollment',
  enrollment: 'maxEnrollment',
  capacity: 'maxEnrollment',
  max_capacity: 'maxEnrollment',
  // days
  days: 'days',
  day_pattern: 'days',
  meeting_days: 'days',
  // time
  time: 'time',
  start_time: 'time',
  meeting_time: 'time',
  // instructor
  instructor: 'instructor',
  professor: 'instructor',
  faculty: 'instructor',
  // building
  building_preference: 'buildingPreference',
  buildingpreference: 'buildingPreference',
  building: 'buildingPreference',
  bldg: 'buildingPreference',
  // room
  room_preference: 'roomPreference',
  roompreference: 'roomPreference',
  room: 'roomPreference',
  // fee
  course_fee: 'courseFee',
  coursefee: 'courseFee',
  fee: 'courseFee',
}

const NON_EDITABLE_FIELDS = new Set<keyof PreferenceRow>([
  'localId',
  'courseId',
  'error',
])

function normalizeCsvHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/#/g, 'number') // "course #" → "course number"
    .replace(/[^a-z0-9]+/g, '_') // spaces/special chars → underscore
    .replace(/^_+|_+$/g, '') // trim leading/trailing underscores
}

function handleCsvUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''

  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    if (!text) return

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length < 2) {
      statusMessage.value =
        'CSV must have a header row and at least one data row.'
      statusTone.value = 'error'
      return
    }

    const headers = parseCsvLine(lines[0]!).map(normalizeCsvHeader)
    const fieldMap = headers.map((h) => CSV_COLUMN_MAP[h] ?? null)

    const newRows: PreferenceRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]!)
      if (values.every((v) => v.trim().length === 0)) continue
      const row = createEmptyRow()
      let courseNumber = ''
      for (let j = 0; j < headers.length; j++) {
        const target = fieldMap[j]
        if (!target) continue
        const val = (values[j] ?? '').trim()
        if (target === 'courseNumber') {
          courseNumber = val
        } else if (!NON_EDITABLE_FIELDS.has(target as keyof PreferenceRow)) {
          ;(row as unknown as Record<string, string>)[target] = val
        }
      }
      // Merge separate dept + course# columns into a single subject string
      if (courseNumber) {
        row.subject = row.subject
          ? `${row.subject} ${courseNumber}`.trim()
          : courseNumber
      }
      newRows.push(row)
    }

    if (newRows.length === 0) {
      statusMessage.value = 'No valid rows found in CSV.'
      statusTone.value = 'error'
      return
    }

    const hasContent = rows.value.some((r) => rowHasAnyContent(r))
    if (hasContent) {
      const ok = window.confirm(
        `Replace the current ${rows.value.length} row(s) with ${newRows.length} row(s) from CSV?`,
      )
      if (!ok) return
    }

    rows.value = newRows
    statusMessage.value = `Loaded ${newRows.length} row(s) from CSV.`
    statusTone.value = 'success'
  }
  reader.readAsText(file)
}

onMounted(loadPageData)
</script>

<style scoped>
/* ─── Page shell ─── */
.pref-page {
  min-height: 100vh;
  background: var(--p-surface-ground, #f8f9fb);
  font-family: 'Inter', system-ui, sans-serif;
}

/* ─── Top bar ─── */
.pref-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.75rem;
  background: var(--p-surface-0, #ffffff);
  border-bottom: 1px solid var(--p-surface-200, #e2e8f0);
  position: sticky;
  top: 0;
  z-index: 10;
}

.pref-topbar__brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.pref-topbar__label {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--p-text-muted-color, #64748b);
}

.pref-topbar__status {
  font-size: 0.75rem;
}

/* ─── Layout ─── */
.pref-layout {
  width: 100%;
  max-width: none;
  margin: 0 auto;
  padding: 1.15rem 0rem 2.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.95rem;
}

/* ─── Hero card ─── */
.pref-hero-card {
  border-radius: 12px;
  box-shadow:
    0 1px 2px 0 rgba(0, 0, 0, 0.06),
    0 8px 24px 0 rgba(15, 23, 42, 0.05);
  border: 1px solid var(--p-surface-200, #e2e8f0);
}

.pref-hero-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
}

.pref-hero-copy {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0.1rem 0.4rem 0.1rem 0.1rem;
}

.pref-hero-copy__title {
  margin: 0;
  font-size: clamp(1.5rem, 2vw, 2rem);
  font-weight: 800;
  color: var(--p-text-color, #0f172a);
  letter-spacing: -0.02em;
  line-height: 1.05;
}

.pref-hero-controls {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 0.9rem;
  width: 100%;
  max-width: 50rem;
  padding: 0.1rem;
}

.pref-field {
  display: grid;
  gap: 0.4rem;
  width: 15rem;
}

.pref-label {
  font-size: 0.73rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--p-text-muted-color, #64748b);
}

.pref-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

/* ─── Messages ─── */
.pref-message {
  border-radius: 10px;
}

/* ─── Table card ─── */
.pref-table-card {
  border-radius: 14px;
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.07),
    0 4px 16px 0 rgba(0, 0, 0, 0.05);
  border: 1px solid var(--p-surface-200, #e2e8f0);
  overflow: hidden;
}

.pref-table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.8rem;
  padding: 1.1rem 1.3rem 0.85rem;
  background: var(--p-surface-50, #f8fafc);
  border-bottom: 1px solid var(--p-surface-200, #e2e8f0);
}

.pref-table-header__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--p-text-color, #0f172a);
  letter-spacing: -0.01em;
}

/* ─── Empty state ─── */
.pref-empty {
  display: grid;
  place-items: center;
  gap: 0.75rem;
  padding: 3rem 1rem;
  text-align: center;
}

.pref-empty__icon {
  font-size: 2.5rem;
  color: var(--p-text-muted-color, #94a3b8);
}

.pref-empty__text {
  margin: 0;
  font-size: 0.95rem;
  color: var(--p-text-muted-color, #64748b);
}

/* ─── DataTable customizations ─── */
:deep(.pref-datatable) {
  border: none;
}

:deep(.pref-datatable .p-datatable-table-container) {
  border-radius: 0;
}

:deep(.pref-datatable .p-datatable-thead > tr > th) {
  background: var(--p-surface-100, #f1f5f9);
  color: var(--p-text-muted-color, #475569);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  padding: 0.7rem 0.6rem;
  border-color: var(--p-surface-200, #e2e8f0);
  white-space: nowrap;
}

:deep(.pref-datatable .p-datatable-tbody > tr > td) {
  padding: 0.38rem 0.4rem;
  vertical-align: top;
  border-color: var(--p-surface-100, #f1f5f9);
}

:deep(.pref-datatable .p-datatable-tbody > tr.pref-row--invalid > td) {
  background: rgba(239, 68, 68, 0.04);
}

:deep(.pref-datatable .p-datatable-tbody > tr:hover > td) {
  background: rgba(59, 130, 246, 0.035);
}

:deep(.pref-datatable .p-datatable-tbody > tr.pref-row--invalid:hover > td) {
  background: rgba(239, 68, 68, 0.07);
}

/* ─── AutoComplete cells ─── */
:deep(.pref-datatable .p-autocomplete) {
  width: 100%;
}

:deep(.pref-datatable .p-autocomplete-input),
:deep(.pref-datatable .p-autocomplete .p-inputtext) {
  width: 100%;
}

:deep(.pref-page .p-inputtext) {
  color: inherit;
}

:deep(.pref-cell-input) {
  font-size: 0.82rem !important;
  padding: 0.42rem 0.5rem !important;
  border-radius: 6px !important;
  border-color: var(--p-surface-300, #cbd5e1) !important;
  background: var(--p-surface-0, #ffffff) !important;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

:deep(.pref-cell-input:hover) {
  border-color: var(--p-primary-300, #93c5fd) !important;
}

:deep(.pref-cell-input:focus) {
  border-color: var(--p-primary-400, #60a5fa) !important;
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.18) !important;
  outline: none !important;
}

:deep(.pref-autocomplete-input) {
  font-size: 0.94rem !important;
  border-radius: 8px !important;
}

:deep(.pref-autocomplete-panel) {
  border-radius: 10px !important;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12) !important;
  overflow: hidden;
}

:deep(.pref-autocomplete-panel .p-autocomplete-option) {
  font-size: 0.84rem;
}

:deep(.pref-page .p-inputtext::placeholder) {
  color: inherit;
  opacity: 0.7;
}

:deep(.pref-page .p-button.p-button-outlined) {
  background: transparent;
}

:deep(.pref-page .p-button.p-button-secondary.p-button-outlined) {
  color: inherit;
}

:deep(.pref-page .p-button) {
  justify-content: center;
  text-align: center;
}

:deep(.pref-page .p-button-label) {
  text-align: center;
}

/* ─── Row actions ─── */
.pref-row-actions {
  display: grid;
  gap: 0.3rem;
}

.pref-row-actions__buttons {
  display: flex;
  gap: 0.1rem;
}

.pref-row-hint {
  font-size: 0.69rem;
  color: var(--p-text-muted-color, #94a3b8);
  line-height: 1.35;
}

.pref-row-error {
  font-size: 0.69rem;
  color: var(--p-red-600, #dc2626);
  line-height: 1.4;
  display: flex;
  align-items: flex-start;
  gap: 0.25rem;
}

.pref-row-error .pi {
  margin-top: 0.07rem;
  flex-shrink: 0;
}

/* ─── Responsive ─── */
@media (max-width: 1100px) {
  .pref-hero-inner {
    flex-direction: column;
    align-items: stretch;
  }

  .pref-hero-copy {
    padding-right: 0.1rem;
  }

  .pref-hero-controls {
    max-width: none;
    padding-left: 0.25rem;
    border-top: 1px solid var(--p-surface-200, #e2e8f0);
    padding-top: 1rem;
    margin-top: 0.25rem;
    justify-content: space-between;
    align-items: stretch;
    flex-wrap: wrap;
  }
}

@media (max-width: 640px) {
  .pref-layout {
    padding: 1rem 0.9rem 2rem;
  }

  .pref-topbar {
    padding: 0.6rem 0.9rem;
  }

  .pref-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .pref-table-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
