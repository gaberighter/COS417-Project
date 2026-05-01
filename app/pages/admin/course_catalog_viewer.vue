<template>
  <div class="room-viewer">
    <div class="room-search">
      <h2>Filter Course Catalog</h2>
      <div class="filter-grid">
        <label>
          Department
          <input
            v-model="filters.deptCode"
            type="text"
            placeholder="e.g. COS"
          />
        </label>
        <label>
          Course Number
          <input
            v-model="filters.courseNumber"
            type="text"
            placeholder="e.g. 126"
          />
        </label>
        <label>
          Title
          <input
            v-model="filters.title"
            type="text"
            placeholder="e.g. Algorithms"
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
        <label>
          Lab Component
          <select v-model="filters.labComponent">
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
          Showing {{ filteredCourses.length }} of {{ courses.length }} courses
        </p>
      </div>
    </div>
    <div class="room-content">
      <p v-if="pending">Loading course catalog...</p>
      <div v-else-if="error" class="error-state">
        <p>Unable to load course catalog.</p>
        <button @click="retryLoad">Retry</button>
      </div>
      <div v-else class="table-container">
        <table>
          <thead>
            <tr>
              <th>Department</th>
              <th>Course Number</th>
              <th>Title</th>
              <th>Credit Hours</th>
              <th>Typical Enrollment</th>
              <th>Lab</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="course in filteredCourses" :key="course._id">
              <td>{{ course.deptCode }}</td>
              <td>{{ course.courseNumber }}</td>
              <td>{{ course.title }}</td>
              <td>{{ course.creditHours }}</td>
              <td>{{ formatNullable(course.typicalEnrollment) }}</td>
              <td>{{ formatBoolean(course.labComponent) }}</td>
              <td>
                <span :class="getStatusClass(course.active)">
                  {{ getStatusText(course.active) }}
                </span>
              </td>
              <td class="row-actions">
                <button
                  type="button"
                  class="action-btn action-btn--edit"
                  @click="openEditCourseModal(course)"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="action-btn action-btn--delete"
                  @click="deleteCourse(course)"
                >
                  Delete
                </button>
              </td>
            </tr>
            <tr v-if="filteredCourses.length === 0">
              <td colspan="8">No courses found.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="statusMessage" class="action-message">{{ statusMessage }}</p>
    </div>
  </div>
  <button
    class="add-room-fab"
    @click="openAddCourseModal"
    title="Add New Course"
  >
    +
  </button>
  <div
    v-if="showCourseModal"
    class="modal-overlay"
    @click.self="closeCourseModal"
  >
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ isEditMode ? 'Edit Course' : 'Add New Course' }}</h2>
        <button class="close-btn" @click="closeCourseModal">✕</button>
      </div>
      <form @submit.prevent="submitCourse" class="room-form">
        <div class="form-group">
          <label for="deptCode">Department Code *</label>
          <input
            id="deptCode"
            v-model="courseForm.deptCode"
            type="text"
            placeholder="e.g. COS"
            maxlength="4"
            :disabled="isEditMode"
            required
          />
        </div>
        <div class="form-group">
          <label for="courseNumber">Course Number *</label>
          <input
            id="courseNumber"
            v-model="courseForm.courseNumber"
            type="text"
            placeholder="e.g. 126"
            :disabled="isEditMode"
            required
          />
        </div>
        <div class="form-group">
          <label for="title">Title *</label>
          <input
            id="title"
            v-model="courseForm.title"
            type="text"
            placeholder="e.g. Algorithms"
            required
          />
        </div>
        <div class="form-group">
          <label for="creditHours">Credit Hours *</label>
          <input
            id="creditHours"
            v-model.number="courseForm.creditHours"
            type="number"
            min="0"
            required
          />
        </div>
        <div class="form-group">
          <label for="typicalEnrollment">Typical Enrollment</label>
          <input
            id="typicalEnrollment"
            v-model.number="courseForm.typicalEnrollment"
            type="number"
            min="0"
            placeholder="Optional"
          />
        </div>
        <div class="form-group">
          <label for="typicalProfessor">Typical Professor</label>
          <input
            id="typicalProfessor"
            v-model="courseForm.typicalProfessor"
            type="text"
            placeholder="Optional"
          />
        </div>
        <div class="form-group">
          <label for="typicalDays">Typical Days</label>
          <select id="typicalDays" v-model="courseForm.typicalDays">
            <option value="">Not set</option>
            <option v-for="day in dayOptions" :key="day" :value="day">
              {{ day }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label for="typicalTime">Typical Time</label>
          <input
            id="typicalTime"
            v-model="courseForm.typicalTime"
            type="text"
            placeholder="e.g. 10:30 AM"
          />
        </div>
        <div class="form-group">
          <label for="requiredEquipment">Required Equipment</label>
          <input
            id="requiredEquipment"
            v-model="courseForm.requiredEquipment"
            type="text"
            placeholder="Comma-separated list"
          />
        </div>
        <div class="form-group">
          <label for="prerequisites">Prerequisites</label>
          <input
            id="prerequisites"
            v-model="courseForm.prerequisites"
            type="text"
            placeholder="Comma-separated course ids"
          />
        </div>
        <div class="form-group">
          <label for="corequisites">Corequisites</label>
          <input
            id="corequisites"
            v-model="courseForm.corequisites"
            type="text"
            placeholder="Comma-separated course ids"
          />
        </div>
        <div class="form-group checkbox-group">
          <label class="checkbox-label">
            <input v-model="courseForm.labComponent" type="checkbox" />
            Lab Component
          </label>
        </div>
        <div class="form-group checkbox-group">
          <label class="checkbox-label">
            <input v-model="courseForm.active" type="checkbox" />
            Active
          </label>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" @click="closeCourseModal">
            Cancel
          </button>
          <button type="submit" class="btn-primary">
            {{ isEditMode ? 'Save Changes' : 'Create Course' }}
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
  pageTitle: 'Course Catalog Viewer',
})

type BooleanFilter = 'any' | 'true' | 'false'

type DayPattern = 'MWF' | 'TR' | 'MW' | 'MTWF' | 'MWRF' | 'M' | 'W' | 'T' | 'R'

interface Course {
  _id: string
  deptCode: string
  courseNumber: string
  title: string
  creditHours: number
  typicalEnrollment?: number | null
  requiredEquipment: string[]
  labComponent: boolean
  active: boolean
  typicalProfessor?: string | null
  typicalDays?: DayPattern | null
  typicalTime?: string | null
  prerequisites: string[]
  corequisites: string[]
}

interface CourseFilters {
  deptCode: string
  courseNumber: string
  title: string
  active: BooleanFilter
  labComponent: BooleanFilter
}

interface CourseForm {
  deptCode: string
  courseNumber: string
  title: string
  creditHours: number | null
  typicalEnrollment: number | null
  requiredEquipment: string
  labComponent: boolean
  active: boolean
  typicalProfessor: string
  typicalDays: DayPattern | ''
  typicalTime: string
  prerequisites: string
  corequisites: string
}

const courses = ref<Course[]>([])
const pending = ref(false)
const error = ref<Error | null>(null)
const deleteMessage = ref('')
const actionMessage = ref('')
const showCourseModal = ref(false)
const isEditMode = ref(false)
const editingCourseId = ref('')

const dayOptions: DayPattern[] = [
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

const createDefaultFilters = (): CourseFilters => ({
  deptCode: '',
  courseNumber: '',
  title: '',
  active: 'any',
  labComponent: 'any',
})

const createEmptyCourseForm = (): CourseForm => ({
  deptCode: '',
  courseNumber: '',
  title: '',
  creditHours: null,
  typicalEnrollment: null,
  requiredEquipment: '',
  labComponent: false,
  active: true,
  typicalProfessor: '',
  typicalDays: '',
  typicalTime: '',
  prerequisites: '',
  corequisites: '',
})

const filters = reactive<CourseFilters>(createDefaultFilters())
const appliedFilters = reactive<CourseFilters>(createDefaultFilters())
const courseForm = reactive<CourseForm>(createEmptyCourseForm())

const includesInsensitive = (value: string, query: string) =>
  value.toLowerCase().includes(query.trim().toLowerCase())

const matchesBooleanFilter = (value: boolean, filter: BooleanFilter) => {
  if (filter === 'any') {
    return true
  }

  return filter === 'true' ? value : !value
}

const splitCsv = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

const loadCourses = async () => {
  pending.value = true
  error.value = null

  try {
    const fetchedCourses = await $fetch<Course[]>('/api/courses', {
      query: { includeInactive: 'true' },
      headers: { 'x-dev-role': 'Admin' },
    })
    courses.value = fetchedCourses
  } catch (loadError) {
    error.value = loadError as Error
  } finally {
    pending.value = false
  }
}

const retryLoad = () => loadCourses()

const filteredCourses = computed(() => {
  return courses.value.filter((course) => {
    if (
      appliedFilters.deptCode &&
      !includesInsensitive(course.deptCode, appliedFilters.deptCode)
    ) {
      return false
    }

    if (
      appliedFilters.courseNumber &&
      !includesInsensitive(course.courseNumber, appliedFilters.courseNumber)
    ) {
      return false
    }

    if (
      appliedFilters.title &&
      !includesInsensitive(course.title, appliedFilters.title)
    ) {
      return false
    }

    if (!matchesBooleanFilter(course.active, appliedFilters.active)) {
      return false
    }

    if (
      !matchesBooleanFilter(course.labComponent, appliedFilters.labComponent)
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

const openAddCourseModal = () => {
  isEditMode.value = false
  Object.assign(courseForm, createEmptyCourseForm())
  actionMessage.value = ''
  showCourseModal.value = true
}

const openEditCourseModal = (course: Course) => {
  isEditMode.value = true
  editingCourseId.value = course._id
  actionMessage.value = ''
  Object.assign(courseForm, {
    deptCode: course.deptCode,
    courseNumber: course.courseNumber,
    title: course.title,
    creditHours: course.creditHours,
    typicalEnrollment: course.typicalEnrollment ?? null,
    requiredEquipment: course.requiredEquipment.join(', '),
    labComponent: course.labComponent,
    active: course.active,
    typicalProfessor: course.typicalProfessor ?? '',
    typicalDays: course.typicalDays ?? '',
    typicalTime: course.typicalTime ?? '',
    prerequisites: course.prerequisites.join(', '),
    corequisites: course.corequisites.join(', '),
  })
  showCourseModal.value = true
}

const closeCourseModal = () => {
  showCourseModal.value = false
  isEditMode.value = false
  editingCourseId.value = ''
  Object.assign(courseForm, createEmptyCourseForm())
}

const normalizeOptionalString = (value: string) => {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const normalizeOptionalNumber = (value: number | null) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const submitCourse = async () => {
  try {
    if (isEditMode.value) {
      await $fetch(
        `/api/courses/${encodeURIComponent(editingCourseId.value)}`,
        {
          method: 'PATCH',
          body: {
            title: courseForm.title.trim(),
            creditHours: courseForm.creditHours,
            typicalEnrollment: normalizeOptionalNumber(
              courseForm.typicalEnrollment,
            ),
            requiredEquipment: splitCsv(courseForm.requiredEquipment),
            labComponent: courseForm.labComponent,
            active: courseForm.active,
            typicalProfessor: normalizeOptionalString(
              courseForm.typicalProfessor,
            ),
            typicalDays: courseForm.typicalDays || null,
            typicalTime: normalizeOptionalString(courseForm.typicalTime),
            prerequisites: splitCsv(courseForm.prerequisites),
            corequisites: splitCsv(courseForm.corequisites),
          },
          headers: { 'x-dev-role': 'Admin' },
        },
      )
    } else {
      await $fetch('/api/courses', {
        method: 'POST',
        body: {
          deptCode: courseForm.deptCode.trim().toUpperCase(),
          courseNumber: courseForm.courseNumber.trim(),
          title: courseForm.title.trim(),
          creditHours: courseForm.creditHours,
          typicalEnrollment: normalizeOptionalNumber(
            courseForm.typicalEnrollment,
          ),
          requiredEquipment: splitCsv(courseForm.requiredEquipment),
          labComponent: courseForm.labComponent,
          active: courseForm.active,
          typicalProfessor: normalizeOptionalString(
            courseForm.typicalProfessor,
          ),
          typicalDays: courseForm.typicalDays || null,
          typicalTime: normalizeOptionalString(courseForm.typicalTime),
          prerequisites: splitCsv(courseForm.prerequisites),
          corequisites: splitCsv(courseForm.corequisites),
        },
        headers: { 'x-dev-role': 'Admin' },
      })
    }
    actionMessage.value = isEditMode.value
      ? 'Course updated.'
      : 'Course created.'
    await loadCourses()
    closeCourseModal()
  } catch (saveError) {
    console.error('Failed to save course:', saveError)
    actionMessage.value =
      saveError instanceof Error && saveError.message
        ? `Failed to save course: ${saveError.message}`
        : 'Failed to save course.'
  }
}

const deleteCourse = async (course: Course) => {
  deleteMessage.value = ''

  const shouldDelete = window.confirm(
    `Delete course ${course.deptCode} ${course.courseNumber}: ${course.title}?`,
  )
  if (!shouldDelete) {
    return
  }

  try {
    await $fetch(`/api/courses/${encodeURIComponent(course._id)}`, {
      method: 'DELETE',
      headers: { 'x-dev-role': 'Admin' },
    })
    deleteMessage.value = 'Course deleted.'
    await loadCourses()
  } catch (deleteError) {
    console.error('Failed to delete course:', deleteError)
    deleteMessage.value = 'Failed to delete course. Please try again.'
  }
}

const statusMessage = computed(() => deleteMessage.value || actionMessage.value)

const formatNullable = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return String(value)
}

const formatBoolean = (value: boolean) => (value ? 'Yes' : 'No')

const getStatusText = (active: boolean) => (active ? 'Active' : 'Inactive')

const getStatusClass = (active: boolean) => {
  return active
    ? 'status-badge status-badge--available'
    : 'status-badge status-badge--unavailable'
}

const { redirectToLogin, redirectToAdmin } = useDebugNavigation()

onMounted(loadCourses)
</script>

<style src="~/assets/css/room-viewer.css"></style>

<style scoped>
:deep(.app-content) {
  width: 100%;
  margin: 0;
  padding: 0;
}
</style>
