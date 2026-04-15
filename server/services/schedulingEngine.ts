// server/services/schedulingEngine.ts
// §4.6 Scheduling Engine — constraint-satisfaction algorithm (§6)
// STUB: returns an empty result. Replace with the real algorithm from §6.3.

import { db, type ISchedule } from '../models/index'

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
  const _rooms = db.rooms.filter((room) => room.available)
  const _courses = db.courses.filter((course) => course.active)
  const _professors = db.professors.filter((professor) => professor.active)
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
