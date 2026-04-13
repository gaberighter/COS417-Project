<template>
    <div class="schedule-viewer" id="schedule-viewer">
        <h1>Schedule Viewer</h1>
        <div class="schedule-layout">
            <aside class="schedule-list">
                <p v-if="isLoading">Loading schedules...</p>
                <p v-else-if="!groupedSchedules.length">No schedules found.</p>
                <section v-for="group in groupedSchedules" :key="group.semester" class="semester-group">
                    <h2>{{ group.semester }}</h2>
                    <div class="schedule-button-list">
                        <button
                            v-for="schedule in group.schedules"
                            :key="schedule.id"
                            :class="['schedule-button', { selected: schedule.id === selectedSchedule?.id }]"
                            @click="selectSchedule(schedule.id)"
                        >
                            {{ schedule.name }}
                        </button>
                    </div>
                </section>
            </aside>

            <section class="schedule-content">
                <template v-if="selectedSchedule">
                    <h2>{{ selectedSchedule.name }}</h2>
                    <p class="schedule-meta">
                        {{ selectedSchedule.semester }}
                    </p>
                    <ul class="course-list">
                        <li v-for="course in selectedSchedule.courses" :key="course.code + course.time">
                            <strong>{{ course.code }}</strong>
                            - {{ course.title }} ({{ course.time }}, {{ course.room }})
                        </li>
                    </ul>
                </template>
                <p v-else>Select a schedule to view details.</p>
            </section>
        </div>
    </div>
    <div class="temporary-debug-buttons">
        <button @click="redirectToLogin">Login Page</button>
        <button @click="redirectToAdmin">Admin Page</button>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

type ScheduleCourse = {
    code: string
    title: string
    time: string
    room: string
}

type ScheduleRecord = {
    id: string
    name: string
    semester: string
    courses: ScheduleCourse[]
}

const schedules = ref<ScheduleRecord[]>([])
const selectedScheduleId = ref<string | null>(null)
const isLoading = ref(true)

const groupedSchedules = computed(() => {
    const groups = new Map<string, ScheduleRecord[]>()

    for (const schedule of schedules.value) {
        if (!groups.has(schedule.semester)) {
            groups.set(schedule.semester, [])
        }

        groups.get(schedule.semester)?.push(schedule)
    }

    return Array.from(groups.entries()).map(([semester, schedulesForSemester]) => ({
        semester,
        schedules: schedulesForSemester
    }))
})

const selectedSchedule = computed(() => {
    return schedules.value.find((schedule) => schedule.id === selectedScheduleId.value) ?? null
})

function selectSchedule(scheduleId: string) {
    selectedScheduleId.value = scheduleId
}

async function loadSchedules() {
    isLoading.value = true

    // TODO: Replace this mock with server-backed MongoDB data when API is implemented.
    // Example expected API usage:
    // const apiSchedules = await $fetch<ScheduleRecord[]>('/api/schedule')
    // schedules.value = apiSchedules
    const exampleSchedules: ScheduleRecord[] = [
        {
            id: 'fall-26-primary',
            name: 'Default Faculty Load',
            semester: "Fall '26",
            courses: [
                { code: 'COS 417', title: 'Distributed Systems', time: 'MWF 09:00-09:50', room: 'CSB 110' },
                { code: 'COS 226', title: 'Algorithms', time: 'TTh 11:00-12:20', room: 'CSB 204' }
            ]
        },
        {
            id: 'fall-26-evening',
            name: 'Evening Section Plan',
            semester: "Fall '26",
            courses: [
                { code: 'COS 333', title: 'Database Systems', time: 'TTh 17:30-18:50', room: 'ENG 015' }
            ]
        },
        {
            id: 'spring-27-primary',
            name: 'Primary Spring Rotation',
            semester: "Spring '27",
            courses: [
                { code: 'COS 340', title: 'Operating Systems', time: 'MWF 10:00-10:50', room: 'CSB 118' },
                { code: 'COS 301', title: 'Software Engineering', time: 'TTh 13:00-14:20', room: 'CSB 220' }
            ]
        },
        {
            id: 'summer-27-compact',
            name: 'Summer Compact Term',
            semester: "Summer '27",
            courses: [
                { code: 'COS 299', title: 'Special Topics', time: 'MW 14:00-16:30', room: 'CSB 130' }
            ]
        }
    ]

    schedules.value = exampleSchedules
    selectedScheduleId.value = exampleSchedules[0]?.id ?? null
    isLoading.value = false
}

onMounted(loadSchedules)

const { redirectToLogin, redirectToAdmin } = useDebugNavigation()
</script>

<style>
#schedule-viewer {
    max-width: 1000px;
    margin: 0 auto;
    padding: 16px;
}

.schedule-layout {
    display: grid;
    grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
    gap: 20px;
}

.schedule-list {
    border: 1px solid #d6d9df;
    border-radius: 8px;
    padding: 16px;
}

.semester-group + .semester-group {
    margin-top: 16px;
}

.semester-group h2 {
    margin: 0 0 8px;
    font-size: 1rem;
}

.schedule-button-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.schedule-button {
    text-align: left;
}

.schedule-button.selected {
    background: #1f2937;
    color: #ffffff;
}

.schedule-content {
    border: 1px solid #d6d9df;
    border-radius: 8px;
    padding: 16px;
}

.schedule-meta {
    margin-top: 0;
    color: #4b5563;
}

.course-list {
    padding-left: 20px;
}

@media (max-width: 800px) {
    .schedule-layout {
        grid-template-columns: 1fr;
    }
}
</style>