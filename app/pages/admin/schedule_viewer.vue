<template>
    <div class="schedule-viewer">
        <div class="top-bar">
            <h1>Schedule Viewer</h1>
        </div>
        <div class="main-content">
            <div class="schedule-search">
                <h2>Filter Schedule</h2>
            <div class="filter-grid">
                <label>
                    Term
                    <select v-model="filters.term">
                        <option value="">All Terms</option>
                        <option v-for="term in availableTerms" :key="term" :value="term">{{ term }}</option>
                    </select>
                </label>
                <label>
                    Instructor
                    <input v-model="filters.instructor" type="text" placeholder="e.g. Dr. Smith" />
                </label>
                <label>
                    Room
                    <input v-model="filters.room" type="text" placeholder="e.g. SCI 101" />
                </label>
                <label>
                    Building
                    <input v-model="filters.building" type="text" placeholder="e.g. SCI" />
                </label>
                <label>
                    Days
                    <select v-model="filters.days">
                        <option value="">Any</option>
                        <option value="MWF">MWF</option>
                        <option value="TR">TR</option>
                        <option value="MW">MW</option>
                        <option value="MTWF">MTWF</option>
                    </select>
                </label>
                <label>
                    Time (After)
                    <input v-model="filters.timeStart" type="time" />
                </label>
                <label>
                    Time (Before)
                    <input v-model="filters.timeEnd" type="time" />
                </label>
                <label>
                    Class ID
                    <input v-model="filters.classId" type="text" placeholder="e.g. COS417" />
                </label>
            </div>
            <div class="filter-actions">
                <button @click="applyFilters">Apply Filters</button>
                <button @click="resetFilters">Clear Filters</button>
                <p class="filter-results">Showing {{ filteredAssignments.length }} of {{ allAssignments.length }} assignments</p>
            </div>
            </div>
        <div class="schedule-content">
            <p v-if="pending">Loading schedule...</p>
            <div v-else-if="error" class="error-state">
                <p>Unable to load schedule.</p>
                <button @click="retryLoad">Retry</button>
            </div>
            <div v-else-if="schedules.length === 0" class="empty-state">
                <p>No schedules available. Please create a schedule first.</p>
            </div>
            <div v-else class="schedule-selector">
                <label>
                    Select Schedule:
                    <select v-model="selectedScheduleId" @change="loadSelectedSchedule">
                        <option value="">Choose a schedule...</option>
                        <option v-for="schedule in schedules" :key="schedule._id" :value="schedule._id">
                            {{ schedule.term }} — {{ schedule.status }} ({{ schedule.assignments.length }} assignments)
                        </option>
                    </select>
                </label>
            </div>
            <div v-if="selectedScheduleId" class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Class ID</th>
                            <th>Class Name</th>
                            <th>Instructor</th>
                            <th>Room</th>
                            <th>Time</th>
                            <th>Days</th>
                            <th>Capacity</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="assignment in filteredAssignments" :key="`${assignment.courseId}-${assignment.professorId}`">
                            <td>{{ assignment.courseId }}</td>
                            <td>{{ getCourseTitle(assignment.courseId) }}</td>
                            <td>{{ getProfessorName(assignment.professorId) }}</td>
                            <td>{{ getRoomInfo(assignment.roomId) }}</td>
                            <td>{{ assignment.startTime }} - {{ assignment.endTime }}</td>
                            <td>{{ assignment.days }}</td>
                            <td>{{ getRoomCapacity(assignment.roomId) }}</td>
                            <td>
                                <button class="btn-small" @click="editAssignment(assignment)">Edit</button>
                            </td>
                        </tr>
                        <tr v-if="filteredAssignments.length === 0">
                            <td colspan="8">No assignments match the selected filters.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div v-if="selectedSchedule && selectedSchedule.conflicts.length > 0" class="conflicts-section">
                <h3>Unresolved Conflicts ({{ selectedSchedule.conflicts.length }})</h3>
                <div class="conflicts-list">
                    <div v-for="(conflict, index) in selectedSchedule.conflicts" :key="index" class="conflict-item">
                        <strong>{{ conflict.courseId }}</strong>
                        <p>{{ conflict.reason }}</p>
                    </div>
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
    pageTitle: 'Schedule Viewer',
})

interface Assignment {
    courseId: string
    professorId: string
    roomId: string
    days: string
    startTime: string
    endTime: string
    overrideBy?: string
}

interface Conflict {
    courseId: string
    reason: string
    resolvedBy?: string
    resolvedAt?: Date
}

interface Schedule {
    _id: string
    term: string
    runNumber: number
    status: string
    createdBy: string
    assignments: Assignment[]
    conflicts: Conflict[]
}

interface Course {
    _id: string
    title: string
}

interface Room {
    _id: string
    buildingCode: string
    roomNumber: string
    capacity: number
}

interface Professor {
    _id: string
    displayName: string
}

type FilterState = {
    term: string
    instructor: string
    room: string
    building: string
    days: string
    timeStart: string
    timeEnd: string
    classId: string
}

const schedules = ref<Schedule[]>([])
const allAssignments = ref<Assignment[]>([])
const filteredAssignments = ref<Assignment[]>([])
const selectedScheduleId = ref<string>('')
const selectedSchedule = ref<Schedule | null>(null)
const pending = ref(false)
const error = ref<Error | null>(null)
const courses = ref<Map<string, Course>>(new Map())
const rooms = ref<Map<string, Room>>(new Map())
const professors = ref<Map<string, Professor>>(new Map())

const availableTerms = computed(() => {
    return [...new Set(schedules.value.map(s => s.term))].sort()
})

const filters = reactive<FilterState>({
    term: '',
    instructor: '',
    room: '',
    building: '',
    days: '',
    timeStart: '',
    timeEnd: '',
    classId: '',
})

const appliedFilters = reactive<FilterState>({
    term: '',
    instructor: '',
    room: '',
    building: '',
    days: '',
    timeStart: '',
    timeEnd: '',
    classId: '',
})

const loadSchedules = async () => {
    pending.value = true
    error.value = null
    try {
        // Load schedules
        schedules.value = await $fetch<Schedule[]>('/api/schedule', {
            headers: { 'x-dev-role': 'Admin' }
        })
        
        // Load reference data
        const [coursesData, roomsData, professorsData] = await Promise.all([
            $fetch<Course[]>('/api/courses', { headers: { 'x-dev-role': 'Admin' } }),
            $fetch<Room[]>('/api/rooms', { headers: { 'x-dev-role': 'Admin' } }),
            $fetch<Professor[]>('/api/professors', { headers: { 'x-dev-role': 'Admin' } })
        ])
        
        courses.value = new Map(coursesData.map(c => [c._id, c]))
        rooms.value = new Map(roomsData.map(r => [r._id, r]))
        professors.value = new Map(professorsData.map(p => [p._id, p]))
    } catch (e) {
        error.value = e as Error
    } finally {
        pending.value = false
    }
}

const loadSelectedSchedule = () => {
    if (!selectedScheduleId.value) {
        allAssignments.value = []
        filteredAssignments.value = []
        selectedSchedule.value = null
        return
    }
    
    const schedule = schedules.value.find(s => s._id === selectedScheduleId.value)
    if (schedule) {
        selectedSchedule.value = schedule
        allAssignments.value = schedule.assignments
        applyFilters()
    }
}

const includesInsensitive = (value: string, query: string) => {
    return value.toLowerCase().includes(query.trim().toLowerCase())
}

const filterAssignments = () => {
    filteredAssignments.value = allAssignments.value.filter(assignment => {
        if (appliedFilters.classId && !includesInsensitive(assignment.courseId, appliedFilters.classId)) {
            return false
        }
        
        if (appliedFilters.instructor) {
            const profName = getProfessorName(assignment.professorId)
            if (!includesInsensitive(profName, appliedFilters.instructor)) {
                return false
            }
        }
        
        if (appliedFilters.room) {
            const roomInfo = getRoomInfo(assignment.roomId)
            if (!includesInsensitive(roomInfo, appliedFilters.room)) {
                return false
            }
        }
        
        if (appliedFilters.building) {
            const room = rooms.value.get(assignment.roomId)
            if (!room || !includesInsensitive(room.buildingCode, appliedFilters.building)) {
                return false
            }
        }
        
        if (appliedFilters.days && assignment.days !== appliedFilters.days) {
            return false
        }
        
        if (appliedFilters.timeStart && assignment.startTime < appliedFilters.timeStart) {
            return false
        }
        
        if (appliedFilters.timeEnd && assignment.startTime >= appliedFilters.timeEnd) {
            return false
        }
        
        return true
    })
}

const getCourseTitle = (courseId: string): string => {
    return courses.value.get(courseId)?.title || courseId
}

const getProfessorName = (professorId: string): string => {
    return professors.value.get(professorId)?.displayName || professorId
}

const getRoomInfo = (roomId: string): string => {
    const room = rooms.value.get(roomId)
    if (!room) return roomId
    return `${room.buildingCode} ${room.roomNumber}`
}

const getRoomCapacity = (roomId: string): number => {
    return rooms.value.get(roomId)?.capacity || 0
}

const applyFilters = () => {
    Object.assign(appliedFilters, filters)
    filterAssignments()
}

const resetFilters = () => {
    Object.assign(filters, {
        term: '',
        instructor: '',
        room: '',
        building: '',
        days: '',
        timeStart: '',
        timeEnd: '',
        classId: '',
    })
    Object.assign(appliedFilters, filters)
    filterAssignments()
}

const editAssignment = (assignment: Assignment) => {
    // TODO: Implement edit functionality
    console.log('Edit assignment:', assignment)
}

const retryLoad = () => loadSchedules()

const { redirectToLogin, redirectToAdmin } = useDebugNavigation()

onMounted(loadSchedules)
</script>

<style scoped>
.schedule-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.top-bar {
    width: 100%;
    padding: 1.5rem;
    background-color: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 1rem;
}

.top-bar h1 {
    margin: 0;
    font-size: 1.75rem;
}

.main-content {
    display: grid;
    grid-template-columns: 25% 75%;
    gap: 1rem;
    padding: 0 1rem 1rem 1rem;
    flex: 1;
    overflow: hidden;
}

.schedule-search {
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 1rem;
    height: fit-content;
}

.schedule-search h2 {
    margin-top: 0;
}

.filter-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
}

.filter-grid label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.9rem;
}

.filter-grid input,
.filter-grid select {
    background-color: var(--color-surface-elevated);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    border-radius: 6px;
    min-height: 2.1rem;
    padding: 0.25rem 0.5rem;
}

.filter-grid input:focus-visible,
.filter-grid select:focus-visible {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: 2px;
}

.filter-actions {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.filter-actions button {
    width: 100%;
}

.filter-results {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
}

.schedule-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.schedule-selector {
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 1rem;
}

.schedule-selector label {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-weight: 500;
}

.schedule-selector select {
    background-color: var(--color-surface-elevated);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    border-radius: 6px;
    min-height: 2.1rem;
    padding: 0.25rem 0.5rem;
}

.empty-state,
.error-state {
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 2rem;
    text-align: center;
}

.error-state {
    border-color: var(--color-error);
}

.table-container {
    overflow-x: auto;
    overflow-y: auto;
    max-height: 600px;
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
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
}

.btn-small {
    padding: 0.25rem 0.75rem;
    font-size: 0.85rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background-color: var(--color-surface-elevated);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: background-color 0.2s;
}

.btn-small:hover {
    background-color: var(--color-focus-ring);
}

.conflicts-section {
    background-color: var(--color-surface);
    border: 1px solid var(--color-warning);
    border-radius: 10px;
    padding: 1rem;
}

.conflicts-section h3 {
    margin-top: 0;
    color: var(--color-warning);
}

.conflicts-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.conflict-item {
    background-color: var(--color-surface-elevated);
    border-left: 4px solid var(--color-warning);
    padding: 0.75rem;
    border-radius: 4px;
}

.conflict-item strong {
    display: block;
    margin-bottom: 0.25rem;
}

.conflict-item p {
    margin: 0;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
}

@media (max-width: 900px) {
    .main-content {
        grid-template-columns: 1fr;
    }

    .top-bar {
        padding: 1rem;
    }
}
</style>