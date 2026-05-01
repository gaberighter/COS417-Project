import { buildScheduleLookupData } from '~~/app/utils/schedule'
import type {
  CourseRecord,
  PreferenceSubmissionRecord,
  ProfessorRecord,
  RoomRecord,
} from '~~/types/schedule'

let staticPromise: Promise<void> | null = null
let staticCourses: CourseRecord[] | null = null
let staticProfessors: ProfessorRecord[] | null = null
let staticRooms: RoomRecord[] | null = null

const preferenceCache = new Map<string, PreferenceSubmissionRecord[]>()
const preferencePromises = new Map<string, Promise<PreferenceSubmissionRecord[]>>()

export function useScheduleReferenceData() {
  const courses = ref<CourseRecord[]>(staticCourses ?? [])
  const professors = ref<ProfessorRecord[]>(staticProfessors ?? [])
  const rooms = ref<RoomRecord[]>(staticRooms ?? [])
  const preferences = ref<PreferenceSubmissionRecord[]>([])
  const staticPending = ref(false)
  const preferencePending = ref(false)

  async function loadStatic(force = false) {
    if (!force && staticCourses && staticProfessors && staticRooms) {
      courses.value = staticCourses
      professors.value = staticProfessors
      rooms.value = staticRooms
      return
    }

    if (!staticPromise || force) {
      staticPromise = Promise.all([
        $fetch<CourseRecord[]>('/api/courses'),
        $fetch<ProfessorRecord[]>('/api/professors'),
        $fetch<RoomRecord[]>('/api/rooms'),
      ]).then(([nextCourses, nextProfessors, nextRooms]) => {
        staticCourses = nextCourses
        staticProfessors = nextProfessors
        staticRooms = nextRooms
      })
    }

    staticPending.value = true
    try {
      await staticPromise
      courses.value = staticCourses ?? []
      professors.value = staticProfessors ?? []
      rooms.value = staticRooms ?? []
    } finally {
      staticPending.value = false
    }
  }

  async function loadPreferences(term: string, force = false) {
    if (!term.trim()) {
      preferences.value = []
      return
    }

    if (!force && preferenceCache.has(term)) {
      preferences.value = preferenceCache.get(term) ?? []
      return
    }

    if (!preferencePromises.has(term) || force) {
      preferencePromises.set(
        term,
        $fetch<PreferenceSubmissionRecord[] | null>(
          `/api/preferences/${encodeURIComponent(term)}`,
        ).then((response) => {
          const normalized = Array.isArray(response)
            ? response
            : response
              ? [response]
              : []
          preferenceCache.set(term, normalized)
          return normalized
        }),
      )
    }

    preferencePending.value = true
    try {
      preferences.value = await (preferencePromises.get(term) ?? Promise.resolve([]))
    } finally {
      preferencePending.value = false
    }
  }

  async function loadForTerm(term: string, force = false) {
    await loadStatic(force)
    await loadPreferences(term, force)
  }

  const lookups = computed(() =>
    buildScheduleLookupData({
      courses: courses.value,
      professors: professors.value,
      rooms: rooms.value,
      preferences: preferences.value,
    }),
  )

  return {
    courses,
    professors,
    rooms,
    preferences,
    lookups,
    staticPending,
    preferencePending,
    loadStatic,
    loadPreferences,
    loadForTerm,
  }
}
