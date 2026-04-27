<template>
  <div class="schedule-viewer">
    <h1>Schedule Viewer</h1>
    <div class="schedule-list">
      <div v-if="scheduleError">Unable to load schedules.</div>
      <div v-else-if="schedulePending">Loading schedules...</div>
      <div v-else-if="scheduleItems.length === 0">No schedules available.</div>
      <div v-else class="schedule-buttons">
        <button
          v-for="schedule in scheduleItems"
          :key="schedule._id"
          @click="selectSchedule(schedule)"
        >
          {{ formatScheduleLabel(schedule) }}
        </button>
      </div>
    </div>
    <div class="schedule-content">

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

const {
  data: schedules,
  pending: schedulePending,
  error: scheduleError,
} = useFetch<ScheduleSummary[]>('/api/schedule')

const scheduleItems = computed(() => schedules.value ?? [])
const selectedScheduleId = ref<string | null>(null)

function selectSchedule(schedule: ScheduleSummary) {
  selectedScheduleId.value = schedule._id
  // TODO: Load the selected schedule details into the viewer.
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
</style>
