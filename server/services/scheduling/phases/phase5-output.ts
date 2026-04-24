import { Schedule } from '../../../models/index'
import { connectDB } from '../../../utils/db'
import type {
  NearHardFlag,
  ScheduleAssignment,
  ScheduleConflict,
  ScheduleResult,
  ScheduleStatus,
} from '../types'

function computeStatus(conflicts: ScheduleConflict[], assignments: ScheduleAssignment[], nearHardFlags: NearHardFlag[]): ScheduleStatus {
  if (assignments.length === 0) {
    return 'under_review'
  }

  if (conflicts.length > 0 || nearHardFlags.length > 0) {
    return 'under_review'
  }

  return 'approved'
}

async function nextRunNumber(term: string): Promise<number> {
  const latest = await Schedule.findOne({ term })
    .sort({ runNumber: -1 })
    .select({ runNumber: 1 })
    .lean<{ runNumber?: number }>()
    .exec()

  return (latest?.runNumber ?? 0) + 1
}

/**
 * Persists the finished schedule and returns the stored run metadata.
 *
 * @param term - Academic term being scheduled.
 * @param adminId - Administrator responsible for the run.
 * @param assignments - Final accepted assignments.
 * @param conflicts - Conflicts produced by the run.
 * @param nearHardFlags - Optional non-blocking flags that should force under-review status.
 * @returns The persisted schedule result.
 */
export async function persistAndReturn(
  term: string,
  adminId: string,
  assignments: ScheduleAssignment[],
  conflicts: ScheduleConflict[],
  nearHardFlags: NearHardFlag[] = [],
): Promise<ScheduleResult> {
  await connectDB()
  const runNumber = await nextRunNumber(term)
  const status = computeStatus(conflicts, assignments, nearHardFlags)

  const schedule: ScheduleResult = {
    term,
    runNumber,
    status,
    createdBy: adminId,
    assignments,
    conflicts,
  }

  await Schedule.create(schedule)

  return schedule
}
