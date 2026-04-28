import type {
  NearHardFlag,
  ScheduleAssignment,
  ScheduleConflict,
  ScheduleResult,
} from './types'
import { collectInputs } from './phases/phase1-collect'
import { sortByDifficulty } from './phases/phase2-generate'
import {
  collectPlacementFlags,
  evaluatePlacementOptions,
} from './phases/phase3-constrain'
import { optimizeCandidatePlacement } from './phases/phase4-optimize'
import { persistAndReturn } from './phases/phase5-output'

function makeAssignment(
  workItem: Parameters<typeof evaluatePlacementOptions>[0],
  chosen: {
    room: { _id: string }
    slot: {
      days: ScheduleAssignment['days']
      startTime: string
      endTime: string
    }
  },
): ScheduleAssignment {
  return {
    courseId: workItem.course._id,
    professorId: workItem.professor._id,
    roomId: chosen.room._id,
    days: chosen.slot.days,
    startTime: chosen.slot.startTime,
    endTime: chosen.slot.endTime,
  }
}

async function buildPlan(term: string): Promise<{
  assignments: ScheduleAssignment[]
  conflicts: ScheduleConflict[]
  nearHardFlags: NearHardFlag[]
  warnings: string[]
}> {
  const collected = await collectInputs(term)
  const orderedWorkItems = sortByDifficulty(collected.workItems)
  const pending = [...orderedWorkItems]
  const assignments: ScheduleAssignment[] = []
  const conflicts: ScheduleConflict[] = []
  const nearHardFlags: NearHardFlag[] = []

  // Repeatedly place classes that have exactly one valid hard-constraint option.
  let madeProgress = true
  while (madeProgress) {
    madeProgress = false

    for (let index = 0; index < pending.length; ) {
      const workItem = pending[index]
      if (workItem === undefined) {
        index += 1
        continue
      }

      const evaluation = evaluatePlacementOptions(
        workItem,
        collected.rooms,
        assignments,
      )

      if (evaluation.conflict !== null) {
        conflicts.push(evaluation.conflict)
        pending.splice(index, 1)
        madeProgress = true
        continue
      }

      if (evaluation.candidates.length === 1) {
        const chosen = evaluation.candidates[0]
        if (chosen === undefined) {
          index += 1
          continue
        }

        assignments.push(makeAssignment(workItem, chosen))
        nearHardFlags.push(
          ...collectPlacementFlags(workItem, chosen, assignments.slice(0, -1)),
        )
        pending.splice(index, 1)
        madeProgress = true
        continue
      }

      index += 1
    }
  }

  for (const workItem of pending) {
    const evaluation = evaluatePlacementOptions(
      workItem,
      collected.rooms,
      assignments,
    )

    if (evaluation.conflict !== null) {
      conflicts.push(evaluation.conflict)
      continue
    }

    const chosen = optimizeCandidatePlacement(
      evaluation.candidates,
      workItem,
      workItem.professor,
    )

    if (chosen === null) {
      conflicts.push({
        courseId: workItem.course._id,
        reason: 'No valid slot found after applying all hard constraints',
      })
      continue
    }

    const assignment = makeAssignment(workItem, chosen)

    assignments.push(assignment)
    nearHardFlags.push(
      ...collectPlacementFlags(workItem, chosen, assignments.slice(0, -1)),
    )
  }

  return {
    assignments,
    conflicts,
    nearHardFlags,
    warnings: collected.warnings,
  }
}

/**
 * Runs all scheduling phases and persists the final result.
 *
 * @param term - Academic term to schedule.
 * @param adminId - Administrator running the schedule.
 * @returns The persisted schedule result.
 */
export async function runSchedulingAlgorithm(
  term: string,
  adminId: string,
): Promise<ScheduleResult> {
  const plan = await buildPlan(term)
  return persistAndReturn(
    term,
    adminId,
    plan.assignments,
    plan.conflicts,
    plan.nearHardFlags,
  )
}

/**
 * Builds a schedule plan without persisting it, which keeps the legacy route compatible.
 *
 * @param term - Academic term to schedule.
 * @returns The computed assignments and conflicts.
 */
export async function runSchedulingPlan(term: string): Promise<{
  assignments: ScheduleAssignment[]
  conflicts: ScheduleConflict[]
}> {
  const plan = await buildPlan(term)
  return {
    assignments: plan.assignments,
    conflicts: plan.conflicts,
  }
}
