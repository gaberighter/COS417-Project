<template>
  <div class="room-viewer">
    <!-- ── Left: filters ── -->
    <div class="room-search">
      <h2>Faculty Preferences</h2>

      <div class="filter-grid" style="grid-template-columns: 1fr">
        <label>
          Term *
          <select v-model="termInput" :disabled="termsPending || pending">
            <option value="" disabled>
              {{
                termsPending
                  ? 'Loading terms...'
                  : availableTerms.length > 0
                    ? 'Select a term'
                    : 'No terms available'
              }}
            </option>
            <option v-for="term in availableTerms" :key="term" :value="term">
              {{ term }}
            </option>
          </select>
        </label>
        <label>
          Department
          <input
            v-model="filters.department"
            type="text"
            placeholder="e.g. COS"
          />
        </label>
        <label>
          Professor
          <input
            v-model="filters.professor"
            type="text"
            placeholder="e.g. Jane Smith"
          />
        </label>
        <label>
          Status
          <select v-model="filters.status">
            <option value="any">Any</option>
            <option value="submitted">Submitted</option>
            <option value="not_submitted">Not Submitted</option>
          </select>
        </label>
      </div>

      <div class="filter-actions">
        <button
          class="btn-primary"
          :disabled="pending || termsPending || !termInput"
          @click="loadPreferences"
        >
          {{ pending ? 'Loading…' : 'Load' }}
        </button>
        <button class="btn-secondary" @click="resetFilters">
          Clear Filters
        </button>
        <p v-if="loadedTerm" class="filter-results">
          Showing {{ filtered.length }} of {{ submissions.length }} submission{{
            submissions.length !== 1 ? 's' : ''
          }}
          for <strong>{{ loadedTerm }}</strong>
        </p>
      </div>
    </div>

    <!-- ── Right: table ── -->
    <div class="room-content">
      <p v-if="pending">Loading submissions…</p>
      <div v-else-if="errorMessage" class="error-state">
        <p>{{ errorMessage }}</p>
        <button @click="loadPreferences">Retry</button>
      </div>
      <div v-else-if="!loadedTerm" class="empty-prompt">
        <p>
          Select a term and click <strong>Load</strong> to view submissions.
        </p>
      </div>
      <div v-else class="table-container">
        <table>
          <thead>
            <tr>
              <th>Professor</th>
              <th>Covenant ID</th>
              <th>Department</th>
              <th>Status</th>
              <th>Submitted At</th>
              <th>Courses</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sub in filtered" :key="sub.covenantId">
              <td>{{ sub.displayName }}</td>
              <td>{{ sub.covenantId }}</td>
              <td>{{ sub.departmentCode }}</td>
              <td>
                <span :class="statusBadgeClass(sub.status)">
                  {{ statusLabel(sub.status) }}
                </span>
              </td>
              <td>{{ formatDate(sub.submittedAt) }}</td>
              <td>{{ sub.courses?.length ?? 0 }}</td>
              <td class="row-actions">
                <button class="action-btn" @click="openDetail(sub)">
                  View Courses
                </button>
              </td>
            </tr>
            <tr v-if="filtered.length === 0">
              <td colspan="7">No submissions match the current filters.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- ── Course detail modal ── -->
  <div v-if="detailSub" class="modal-overlay" @click.self="detailSub = null">
    <div class="modal-content pref-modal">
      <div class="modal-header">
        <div>
          <h2>{{ detailSub.displayName }}</h2>
          <p class="modal-sub">
            {{ detailSub.departmentCode }} · {{ loadedTerm }} ·
            <span :class="statusBadgeClass(detailSub.status)">
              {{ statusLabel(detailSub.status) }}
            </span>
          </p>
        </div>
        <button class="close-btn" @click="detailSub = null">✕</button>
      </div>

      <div class="pref-courses">
        <p v-if="!detailSub.courses?.length" class="no-courses">
          No courses in this submission.
        </p>
        <div v-else class="courses-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>CRN</th>
                <th>Section</th>
                <th>Title</th>
                <th>Credits</th>
                <th>Max</th>
                <th>Days</th>
                <th>Time</th>
                <th>Instructor</th>
                <th>Building</th>
                <th>Room</th>
                <th>Fee</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(c, i) in detailSub.courses" :key="i">
                <td>{{ courseLabel(c) }}</td>
                <td>{{ fmt(c.crn) }}</td>
                <td>{{ fmt(c.section) }}</td>
                <td>{{ c.title }}</td>
                <td>{{ c.creditHours }}</td>
                <td>{{ c.maxCapacity ?? c.expectedEnrollment }}</td>
                <td>{{ (c.preferredDays ?? []).join(', ') || '—' }}</td>
                <td>{{ (c.preferredTimes ?? []).join(', ') || '—' }}</td>
                <td>{{ fmt(c.instructor) }}</td>
                <td>{{ fmt(c.preferredBuilding) }}</td>
                <td>{{ roomLabelForPreference(c.preferredRoomId) }}</td>
                <td>
                  {{
                    c.courseFee != null
                      ? `$${Number(c.courseFee).toFixed(2)}`
                      : '—'
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
  pageTitle: 'Preference Viewer',
})

type StatusFilter = 'any' | 'submitted' | 'not_submitted'

type CourseRecord = {
  _id: string
  deptCode: string
  courseNumber: string
  title: string
}

type RoomRecord = {
  _id: string
  abbreviation?: string | null
  buildingName?: string | null
  roomNumber: string
  displayName?: string | null
}

type CoursePreference = {
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

type PreferenceSubmission = {
  professorId: string
  covenantId: string
  displayName: string
  departmentCode: string
  term?: string
  department?: string | null
  submittedBy?: string
  submittedAt?: string | null
  status: 'not_submitted' | 'submitted'
  courses: CoursePreference[]
}

type ScheduleTermEntry = {
  term: string
  hasPreferences: boolean
}

const termInput = ref('')
const loadedTerm = ref('')
const submissions = ref<PreferenceSubmission[]>([])
const pending = ref(false)
const termsPending = ref(false)
const errorMessage = ref('')
const detailSub = ref<PreferenceSubmission | null>(null)
const courses = ref<CourseRecord[]>([])
const rooms = ref<RoomRecord[]>([])
const availableTerms = ref<string[]>([])
let referenceLoadPromise: Promise<void> | null = null

const createDefaultFilters = () => ({
  department: '',
  professor: '',
  status: 'any' as StatusFilter,
})

const filters = reactive(createDefaultFilters())

function normalizeLookupValue(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function looksLikeOpaqueId(value: string): boolean {
  return /^[a-f0-9]{24}$/i.test(value)
}

function normalizeCourseIdText(value: string): string {
  const normalized = normalizeWhitespace(value)
  return looksLikeOpaqueId(normalized) ? normalized : normalized.toUpperCase()
}

function normalizeSectionText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }

  const normalized = normalizeWhitespace(String(value)).toUpperCase()
  return normalized.length > 0 ? normalized : null
}

function parseEmbeddedSection(normalizedCourseId: string): {
  catalogCourseId: string
  section: string | null
} {
  const opaqueMatch = normalizedCourseId.match(/^([a-f0-9]{24})-([A-Z0-9]+)$/i)
  if (opaqueMatch) {
    return {
      catalogCourseId: normalizeCourseIdText(
        opaqueMatch[1] ?? normalizedCourseId,
      ),
      section: normalizeSectionText(opaqueMatch[2] ?? null),
    }
  }

  const match = normalizedCourseId.match(/^(.+\s+\S+)-([A-Z0-9]+)$/)
  if (!match) {
    return {
      catalogCourseId: normalizedCourseId,
      section: null,
    }
  }

  return {
    catalogCourseId: normalizeCourseIdText(match[1] ?? normalizedCourseId),
    section: normalizeSectionText(match[2] ?? null),
  }
}

function normalizeCourseReference(
  courseId: string,
  section?: string | null,
): {
  catalogCourseId: string
  section: string | null
} {
  const rawCourseId = normalizeCourseIdText(courseId)
  const normalizedSection = normalizeSectionText(section)

  if (normalizedSection !== null) {
    const suffix = `-${normalizedSection}`
    const catalogCourseId = rawCourseId.endsWith(suffix)
      ? normalizeCourseIdText(rawCourseId.slice(0, -suffix.length))
      : rawCourseId

    return {
      catalogCourseId,
      section: normalizedSection,
    }
  }

  return parseEmbeddedSection(rawCourseId)
}

function subjectLabel(course: CourseRecord): string {
  return [course.deptCode, course.courseNumber].filter(Boolean).join(' ')
}

function roomDisplayLabel(room: RoomRecord): string {
  return (
    room.abbreviation ||
    room.displayName ||
    [room.buildingName, room.roomNumber].filter(Boolean).join(' ')
  )
}

const courseLookup = computed(() => {
  const lookup = new Map<string, CourseRecord>()

  for (const course of courses.value) {
    for (const key of [course._id, subjectLabel(course)]) {
      const normalized = normalizeLookupValue(key)
      if (normalized) {
        lookup.set(normalized, course)
      }
    }
  }

  return lookup
})

const roomLookup = computed(() => {
  const lookup = new Map<string, RoomRecord>()

  for (const room of rooms.value) {
    for (const key of [
      room._id,
      room.abbreviation ?? null,
      room.displayName ?? null,
      [room.buildingName, room.roomNumber].filter(Boolean).join(' '),
    ]) {
      const normalized = normalizeLookupValue(key)
      if (normalized) {
        lookup.set(normalized, room)
      }
    }
  }

  return lookup
})

const filtered = computed(() =>
  submissions.value.filter((s) => {
    if (
      filters.department &&
      !s.departmentCode
        .toLowerCase()
        .includes(filters.department.trim().toLowerCase())
    )
      return false
    if (
      filters.professor &&
      !s.displayName
        .toLowerCase()
        .includes(filters.professor.trim().toLowerCase())
    )
      return false
    if (filters.status !== 'any' && s.status !== filters.status) return false
    return true
  }),
)

async function ensureReferenceData() {
  if (courses.value.length > 0 && rooms.value.length > 0) {
    return
  }

  if (!referenceLoadPromise) {
    referenceLoadPromise = Promise.all([
      $fetch<CourseRecord[]>('/api/courses', {
        headers: { 'x-dev-role': 'Admin' },
      }),
      $fetch<RoomRecord[]>('/api/rooms', {
        headers: { 'x-dev-role': 'Admin' },
      }),
    ])
      .then(([fetchedCourses, fetchedRooms]) => {
        courses.value = fetchedCourses
        rooms.value = fetchedRooms
      })
      .finally(() => {
        referenceLoadPromise = null
      })
  }

  await referenceLoadPromise
}

async function loadAvailableTerms() {
  termsPending.value = true

  try {
    const entries = await $fetch<ScheduleTermEntry[]>('/api/schedule/terms', {
      headers: { 'x-dev-role': 'Admin' },
    })

    availableTerms.value = entries
      .filter((entry) => entry.hasPreferences)
      .map((entry) => entry.term)

    if (!termInput.value && availableTerms.value.length > 0) {
      const [latestTerm] = availableTerms.value
      termInput.value = latestTerm ?? ''
    }
  } catch {
    availableTerms.value = []
  } finally {
    termsPending.value = false
  }
}

async function loadPreferences() {
  const term = termInput.value.trim()
  if (!term) {
    errorMessage.value = 'Enter a term before loading.'
    return
  }
  pending.value = true
  errorMessage.value = ''
  submissions.value = []
  loadedTerm.value = ''
  try {
    const [res] = await Promise.all([
      $fetch<PreferenceSubmission | PreferenceSubmission[]>(
        `/api/preferences/${encodeURIComponent(term)}`,
        { headers: { 'x-dev-role': 'Admin' } },
      ),
      ensureReferenceData().catch(() => undefined),
    ])
    submissions.value = Array.isArray(res) ? res : res ? [res] : []
    loadedTerm.value = term
  } catch (err: unknown) {
    const msg =
      err &&
      typeof err === 'object' &&
      'data' in err &&
      typeof (err as { data?: { statusMessage?: string } }).data
        ?.statusMessage === 'string'
        ? (err as { data: { statusMessage: string } }).data.statusMessage
        : 'Failed to load preferences.'
    errorMessage.value = msg
  } finally {
    pending.value = false
  }
}

function resetFilters() {
  Object.assign(filters, createDefaultFilters())
}

function openDetail(sub: PreferenceSubmission) {
  detailSub.value = sub
}

function statusLabel(status: string) {
  return status === 'submitted' ? 'Submitted' : 'Not Submitted'
}

function statusBadgeClass(status: string) {
  return status === 'submitted'
    ? 'status-badge status-badge--available'
    : 'status-badge status-badge--unavailable'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function fmt(value?: string | null) {
  return value?.trim() || '—'
}

function courseLabel(course: CoursePreference) {
  const normalized = normalizeCourseReference(
    course.courseId,
    course.section ?? null,
  )
  const record =
    courseLookup.value.get(normalizeLookupValue(normalized.catalogCourseId)) ??
    courseLookup.value.get(normalizeLookupValue(course.courseId))

  if (!record) {
    return fmt(course.courseId)
  }

  const label = subjectLabel(record)
  return normalized.section ? `${label}-${normalized.section}` : label
}

function roomLabelForPreference(value?: string | null) {
  if (!value) return 'N/A'

  const room = roomLookup.value.get(normalizeLookupValue(value))
  return room ? roomDisplayLabel(room) : fmt(value)
}

onMounted(() => {
  void loadAvailableTerms()
})

const { redirectToLogin, redirectToAdmin } = useDebugNavigation()
</script>

<style src="~/assets/css/room-viewer.css"></style>

<style scoped>
:deep(.app-content) {
  width: 100%;
  margin: 0;
  padding: 0;
}

.empty-prompt {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-secondary);
  font-size: 0.95rem;
  text-align: center;
  padding: 2rem;
}

.pref-modal {
  max-width: 92vw;
  width: 1100px;
}

.modal-sub {
  margin: 0.25rem 0 0;
  font-size: 0.88rem;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pref-courses {
  padding: 1rem 1.5rem 1.5rem;
}

.courses-table-wrap {
  overflow-x: auto;
}

.no-courses {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}
</style>
