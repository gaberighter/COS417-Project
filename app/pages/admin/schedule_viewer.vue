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
      <div v-else-if="selectedScheduleError">Unable to load schedule details.</div>
      <pre v-else-if="selectedScheduleDetails">{{
        JSON.stringify(selectedScheduleDetails, null, 2)
      }}</pre>
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

const {
  data: schedules,
  pending: schedulePending,
  error: scheduleError,
} = useFetch<ScheduleSummary[]>('/api/schedule')

const scheduleItems = computed(() => schedules.value ?? [])
const schedulesByTerm = computed(() => {
  return scheduleItems.value.reduce<Record<string, ScheduleSummary[]>>(
    (acc, schedule) => {
      if (!acc[schedule.term]) acc[schedule.term] = []
      acc[schedule.term].push(schedule)
      return acc
    },
    {},
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
      response.schedules.find((item) => item.runNumber === schedule.runNumber) ??
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
</script>

<style>
.schedule-viewer {
  max-width: 1000px;
  margin: 0 auto;
  padding: 16px;
}

.schedule-list {
  margin-top: 1rem;
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
}

.term-dropdown > summary::-webkit-details-marker {
  display: none;
}

.term-dropdown[open] {
  background-color: var(--color-surface-elevated);
}

.schedule-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.6rem;
}

.schedule-buttons button {
  text-align: left;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
}

@media (max-width: 640px) {
  .term-dropdown {
    width: 100%;
  }
}
</style>
