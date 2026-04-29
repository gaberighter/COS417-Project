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
  const conflicts: ScheduleConflict[] = [...collected.conflicts]
  const nearHardFlags: NearHardFlag[] = []

  function makeRuntimeConflict(
    courseId: string,
    code: string,
    detail: string,
  ): ScheduleConflict {
    return {
      courseId,
      reason: `[${code}] ${detail}`,
    }
  }

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

      let evaluation: ReturnType<typeof evaluatePlacementOptions>
      try {
        evaluation = evaluatePlacementOptions(
          workItem,
          collected.rooms,
          assignments,
        )
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : 'Unknown constraint error'
        conflicts.push(
          makeRuntimeConflict(
            workItem.course._id,
            'PLACEMENT_EVALUATION_FAILED',
            `Constraint evaluation failed. ${detail}`,
          ),
        )
        pending.splice(index, 1)
        madeProgress = true
        continue
      }

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

        try {
          assignments.push(makeAssignment(workItem, chosen))
          nearHardFlags.push(
            ...collectPlacementFlags(
              workItem,
              chosen,
              assignments.slice(0, -1),
            ),
          )
        } catch (error) {
          assignments.pop()
          const detail =
            error instanceof Error ? error.message : 'Unknown assignment error'
          conflicts.push(
            makeRuntimeConflict(
              workItem.course._id,
              'ASSIGNMENT_APPLICATION_FAILED',
              `The selected placement could not be applied. ${detail}`,
            ),
          )
          pending.splice(index, 1)
          madeProgress = true
          continue
        }
        pending.splice(index, 1)
        madeProgress = true
        continue
      }

      index += 1
    }
  }

  for (const workItem of pending) {
    let evaluation: ReturnType<typeof evaluatePlacementOptions>
    try {
      evaluation = evaluatePlacementOptions(
        workItem,
        collected.rooms,
        assignments,
      )
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'Unknown constraint error'
      conflicts.push(
        makeRuntimeConflict(
          workItem.course._id,
          'PLACEMENT_EVALUATION_FAILED',
          `Constraint evaluation failed. ${detail}`,
        ),
      )
      continue
    }

    if (evaluation.conflict !== null) {
      conflicts.push(evaluation.conflict)
      continue
    }

    let chosen: ReturnType<typeof optimizeCandidatePlacement>
    try {
      chosen = optimizeCandidatePlacement(
        evaluation.candidates,
        workItem,
        workItem.professor,
      )
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'Unknown optimization error'
      conflicts.push(
        makeRuntimeConflict(
          workItem.course._id,
          'PLACEMENT_OPTIMIZATION_FAILED',
          `Candidate ranking failed. ${detail}`,
        ),
      )
      continue
    }

    if (chosen === null) {
      conflicts.push({
        courseId: workItem.course._id,
        reason: 'No valid slot found after applying all hard constraints',
      })
      continue
    }

    try {
      const assignment = makeAssignment(workItem, chosen)
      assignments.push(assignment)
      nearHardFlags.push(
        ...collectPlacementFlags(workItem, chosen, assignments.slice(0, -1)),
      )
    } catch (error) {
      assignments.pop()
      const detail =
        error instanceof Error ? error.message : 'Unknown assignment error'
      conflicts.push(
        makeRuntimeConflict(
          workItem.course._id,
          'ASSIGNMENT_APPLICATION_FAILED',
          `The selected placement could not be applied. ${detail}`,
        ),
      )
    }
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
