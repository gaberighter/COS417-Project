// server/services/schedulingEngine.ts
// §4.6 Scheduling Engine — constraint-satisfaction algorithm (§6)
// STUB: returns an empty result. Replace with the real algorithm from §6.3.

import { CourseCatalog, Professor, Room, type ISchedule } from '../models/index'

export interface EngineResult {
  assignments: ISchedule['assignments']
  conflicts: ISchedule['conflicts']
}

/**
 * Run the scheduling algorithm for `term`.
 * Phases per SDD §6.3:
 *   1. Input Collection
 *   2. Tentative Schedule Generation
 *   3. Constraint Checking
 *   4. Optimization
 *   5. Output
 */
export async function run(term: string): Promise<EngineResult> {
  // TODO: implement phases per §6.3.1–§6.3.5

  // Phase 1 — collect inputs from DB
  const [_rooms, _courses, _professors] = await Promise.all([
    Room.find({ available: true }).lean().exec(),
    CourseCatalog.find({ active: true }).lean().exec(),
    Professor.find({ active: true }).lean().exec(),
  ])
  void term
  void _rooms
  void _courses
  void _professors

  // Phase 2–4 — STUB (no assignments generated yet)
  const assignments: ISchedule['assignments'] = []
  const conflicts: ISchedule['conflicts'] = []

  // Phase 5 — return result (caller persists it)
  return { assignments, conflicts }
}
