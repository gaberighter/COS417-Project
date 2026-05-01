export type ScheduleRunLifecycleStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'failed'

export interface ScheduleRunStateSnapshot {
  status: ScheduleRunLifecycleStatus
  activeRun: {
    term: string
    startedAt: string
  } | null
  lastRun: {
    term: string
    startedAt: string
    finishedAt: string
    status: Exclude<ScheduleRunLifecycleStatus, 'idle' | 'running'>
    errorMessage?: string | null
    recommendedStatus?: string | null
    assignmentCount?: number | null
    conflictCount?: number | null
    warningCount?: number | null
    nearHardFlagCount?: number | null
  } | null
}

type MutableRunState = {
  status: ScheduleRunLifecycleStatus
  activeRun: {
    term: string
    startedAt: string
  } | null
  lastRun: ScheduleRunStateSnapshot['lastRun']
}

const scheduleRunState: MutableRunState = {
  status: 'idle',
  activeRun: null,
  lastRun: null,
}

function cloneState(): ScheduleRunStateSnapshot {
  return {
    status: scheduleRunState.status,
    activeRun: scheduleRunState.activeRun
      ? { ...scheduleRunState.activeRun }
      : null,
    lastRun: scheduleRunState.lastRun ? { ...scheduleRunState.lastRun } : null,
  }
}

export function beginScheduleRun(
  term: string,
): ScheduleRunStateSnapshot | null {
  if (scheduleRunState.activeRun) {
    return cloneState()
  }

  scheduleRunState.status = 'running'
  scheduleRunState.activeRun = {
    term,
    startedAt: new Date().toISOString(),
  }

  return null
}

export function completeScheduleRun(input: {
  term: string
  recommendedStatus: string
  assignmentCount: number
  conflictCount: number
  warningCount: number
  nearHardFlagCount: number
}): ScheduleRunStateSnapshot {
  const startedAt =
    scheduleRunState.activeRun?.term === input.term
      ? scheduleRunState.activeRun.startedAt
      : new Date().toISOString()

  scheduleRunState.status = 'completed'
  scheduleRunState.activeRun = null
  scheduleRunState.lastRun = {
    term: input.term,
    startedAt,
    finishedAt: new Date().toISOString(),
    status: 'completed',
    recommendedStatus: input.recommendedStatus,
    assignmentCount: input.assignmentCount,
    conflictCount: input.conflictCount,
    warningCount: input.warningCount,
    nearHardFlagCount: input.nearHardFlagCount,
    errorMessage: null,
  }

  return cloneState()
}

export function failScheduleRun(
  term: string,
  errorMessage: string,
): ScheduleRunStateSnapshot {
  const startedAt =
    scheduleRunState.activeRun?.term === term
      ? scheduleRunState.activeRun.startedAt
      : new Date().toISOString()

  scheduleRunState.status = 'failed'
  scheduleRunState.activeRun = null
  scheduleRunState.lastRun = {
    term,
    startedAt,
    finishedAt: new Date().toISOString(),
    status: 'failed',
    errorMessage,
  }

  return cloneState()
}
