import type {
  NearHardFlag,
  PlacementTrace,
  ScheduleAssignment,
  ScheduleConflict,
} from './types'
import { collectInputs } from './phases/phase1-collect'
import { sortByDifficulty } from './phases/phase2-generate'
import {
  collectPlacementFlags,
  evaluatePlacementOptions,
} from './phases/phase3-constrain'
import { optimizeCandidatePlacement } from './phases/phase4-optimize'

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
    courseId: workItem.scheduledCourseId,
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
  traces: PlacementTrace[]
}> {
  const collected = await collectInputs(term)
  const orderedWorkItems = sortByDifficulty(collected.workItems)
  const pending = [...orderedWorkItems]
  const assignments: ScheduleAssignment[] = []
  const conflicts: ScheduleConflict[] = [...collected.conflicts]
  const nearHardFlags: NearHardFlag[] = []
  const traces: PlacementTrace[] = []

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

  function buildTrace(
    workItem: Parameters<typeof evaluatePlacementOptions>[0],
    status: PlacementTrace['status'],
    stage: PlacementTrace['stage'],
    reasons: string[],
    evaluation?: ReturnType<typeof evaluatePlacementOptions>,
    decisionLog: string[] = [],
    chosen?: {
      room: { _id: string }
      slot: {
        days: ScheduleAssignment['days']
        startTime: string
        endTime: string
      }
    },
  ): PlacementTrace {
    return {
      courseId: workItem.scheduledCourseId,
      catalogCourseId: workItem.catalogCourseId,
      professorId: workItem.professor._id,
      status,
      stage,
      chosen: chosen
        ? {
            roomId: chosen.room._id,
            days: chosen.slot.days,
            startTime: chosen.slot.startTime,
            endTime: chosen.slot.endTime,
          }
        : undefined,
      candidateRooms: (evaluation?.candidateRooms ?? []).map(
        (room) => room._id,
      ),
      candidateSlots: (evaluation?.candidateSlots ?? []).map((slot) => ({
        days: slot.days,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
      candidateCount: evaluation?.candidates.length ?? 0,
      selectedTier: evaluation?.selectedTier ?? null,
      reasons,
      decisionLog,
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
        const conflict = makeRuntimeConflict(
          workItem.scheduledCourseId,
          'PLACEMENT_EVALUATION_FAILED',
          `Constraint evaluation failed. ${detail}`,
        )
        traces.push(
          buildTrace(workItem, 'conflict', 'evaluation_failed', [
            conflict.reason,
          ]),
        )
        conflicts.push(conflict)
        pending.splice(index, 1)
        madeProgress = true
        continue
      }

      if (evaluation.conflict !== null) {
        traces.push(
          buildTrace(
            workItem,
            'conflict',
            'constraint_conflict',
            [evaluation.conflict.reason],
            evaluation,
            evaluation.decisionLog,
          ),
        )
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
          traces.push(
            buildTrace(
              workItem,
              'assigned',
              'single_candidate',
              ['Assigned from single surviving candidate.'],
              evaluation,
              [
                ...evaluation.decisionLog,
                'Only one pairing survived the fallback tiers, so it was assigned immediately.',
              ],
              chosen,
            ),
          )
        } catch (error) {
          assignments.pop()
          const detail =
            error instanceof Error ? error.message : 'Unknown assignment error'
          const conflict = makeRuntimeConflict(
            workItem.scheduledCourseId,
            'ASSIGNMENT_APPLICATION_FAILED',
            `The selected placement could not be applied. ${detail}`,
          )
          traces.push(
            buildTrace(
              workItem,
              'conflict',
              'assignment_failed',
              [conflict.reason],
              evaluation,
              evaluation.decisionLog,
              chosen,
            ),
          )
          conflicts.push(conflict)
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
      const conflict = makeRuntimeConflict(
        workItem.scheduledCourseId,
        'PLACEMENT_EVALUATION_FAILED',
        `Constraint evaluation failed. ${detail}`,
      )
      traces.push(
        buildTrace(workItem, 'conflict', 'evaluation_failed', [
          conflict.reason,
        ]),
      )
      conflicts.push(conflict)
      continue
    }

    if (evaluation.conflict !== null) {
      traces.push(
        buildTrace(
          workItem,
          'conflict',
          'constraint_conflict',
          [evaluation.conflict.reason],
          evaluation,
          evaluation.decisionLog,
        ),
      )
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
      const conflict = makeRuntimeConflict(
        workItem.scheduledCourseId,
        'PLACEMENT_OPTIMIZATION_FAILED',
        `Candidate ranking failed. ${detail}`,
      )
      traces.push(
        buildTrace(
          workItem,
          'conflict',
          'optimization_failed',
          [conflict.reason],
          evaluation,
          evaluation.decisionLog,
        ),
      )
      conflicts.push(conflict)
      continue
    }

    if (chosen === null) {
      const conflict = {
        courseId: workItem.scheduledCourseId,
        reason: 'No valid slot found after applying all hard constraints',
      }
      traces.push(
        buildTrace(
          workItem,
          'conflict',
          'optimization_failed',
          [conflict.reason],
          evaluation,
          evaluation.decisionLog,
        ),
      )
      conflicts.push(conflict)
      continue
    }

    try {
      const assignment = makeAssignment(workItem, chosen)
      assignments.push(assignment)
      nearHardFlags.push(
        ...collectPlacementFlags(workItem, chosen, assignments.slice(0, -1)),
      )
      traces.push(
        buildTrace(
          workItem,
          'assigned',
          'optimized',
          ['Assigned after candidate ranking.'],
          evaluation,
          [...evaluation.decisionLog, ...chosen.decisionLog],
          chosen,
        ),
      )
    } catch (error) {
      assignments.pop()
      const detail =
        error instanceof Error ? error.message : 'Unknown assignment error'
      const conflict = makeRuntimeConflict(
        workItem.scheduledCourseId,
        'ASSIGNMENT_APPLICATION_FAILED',
        `The selected placement could not be applied. ${detail}`,
      )
      traces.push(
        buildTrace(
          workItem,
          'conflict',
          'assignment_failed',
          [conflict.reason],
          evaluation,
          [...evaluation.decisionLog, ...chosen.decisionLog],
          chosen,
        ),
      )
      conflicts.push(conflict)
    }
  }

  return {
    assignments,
    conflicts,
    nearHardFlags,
    warnings: collected.warnings,
    traces,
  }
}

/**
 * Builds a schedule plan without persisting it so the admin page can review and approve it.
 *
 * @param term - Academic term to schedule.
 * @returns The computed plan with debug traces.
 */
export async function runSchedulingPlan(term: string): Promise<{
  assignments: ScheduleAssignment[]
  conflicts: ScheduleConflict[]
  nearHardFlags: NearHardFlag[]
  warnings: string[]
  traces: PlacementTrace[]
}> {
  const plan = await buildPlan(term)
  return {
    assignments: plan.assignments,
    conflicts: plan.conflicts,
    nearHardFlags: plan.nearHardFlags,
    warnings: plan.warnings,
    traces: plan.traces,
  }
}
