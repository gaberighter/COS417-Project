// server/api/schedule/terms.get.ts
// GET /api/schedule/terms — combine preference-backed terms with saved runs.
// Role: Admin | Faculty

import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Professor, Schedule, type ScheduleStatus } from '../../models/index'
import { compareAcademicTermsDesc } from '../../../shared/academicTerms'

type ScheduleSummaryAggregate = {
  _id: string
  term: string
  runNumber: number
  status: ScheduleStatus
  createdBy: string
  assignmentCount: number
  createdAt?: Date
  updatedAt?: Date
  approvedAt?: Date | null
  approvedBy?: string | null
}

type ScheduleTermIndexEntry = {
  term: string
  hasPreferences: boolean
  runs: ScheduleSummaryAggregate[]
}

export default defineEventHandler(async (event) => {
  requireAuth(event, ['Admin', 'Faculty'])
  await connectDB()

  const [professors, scheduleSummaries] = await Promise.all([
    Professor.find(
      { active: true },
      {
        preferences: 1,
      },
    )
      .lean()
      .exec(),
    Schedule.aggregate<ScheduleSummaryAggregate>([
      {
        $project: {
          _id: 1,
          term: 1,
          runNumber: 1,
          status: 1,
          createdBy: 1,
          createdAt: 1,
          updatedAt: 1,
          approvedAt: 1,
          approvedBy: 1,
          assignmentCount: {
            $size: {
              $ifNull: ['$assignments', []],
            },
          },
        },
      },
      {
        $sort: {
          term: -1,
          runNumber: -1,
        },
      },
    ]).exec(),
  ])

  const entriesByTerm = new Map<string, ScheduleTermIndexEntry>()

  function ensureEntry(term: string) {
    const normalizedTerm = term.trim()
    if (!normalizedTerm) return null

    if (!entriesByTerm.has(normalizedTerm)) {
      entriesByTerm.set(normalizedTerm, {
        term: normalizedTerm,
        hasPreferences: false,
        runs: [],
      })
    }

    return entriesByTerm.get(normalizedTerm) ?? null
  }

  for (const professor of professors) {
    for (const preference of professor.preferences ?? []) {
      const entry = ensureEntry(preference.term ?? '')
      if (entry) {
        entry.hasPreferences = true
      }
    }
  }

  for (const scheduleSummary of scheduleSummaries) {
    const entry = ensureEntry(scheduleSummary.term)
    if (entry) {
      entry.runs.push(scheduleSummary)
    }
  }

  const entries = [...entriesByTerm.values()]

  for (const entry of entries) {
    entry.runs.sort((left, right) => right.runNumber - left.runNumber)
  }

  return entries.sort((left, right) =>
    compareAcademicTermsDesc(left.term, right.term),
  )
})
