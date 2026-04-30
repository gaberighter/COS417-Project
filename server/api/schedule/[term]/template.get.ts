// server/api/schedule/[term]/template.get.ts
// GET /api/schedule/:term/template — retrieve template with current schedule structure for easier PATCH
// Allows users to see the exact format needed for PATCH requests
// Role: Admin

import { defineEventHandler, getRouterParam, createError } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { connectDB } from '../../../utils/db'
import { Schedule } from '../../../models/index'

const TERM_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

export default defineEventHandler(async (event) => {
  requireAuth(event, ['Admin'])
  await connectDB()

  const term = getRouterParam(event, 'term')
  if (!term) {
    throw createError({ statusCode: 400, statusMessage: 'term is required' })
  }
  if (!TERM_PATTERN.test(term)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid term format' })
  }

  // Get the latest schedule for the term to use as a template
  const schedule = await Schedule.findOne({ term })
    .sort({ runNumber: -1 })
    .lean()
    .exec()

  if (!schedule) {
    // Return an empty template if no schedule exists
    return {
      ok: true,
      term,
      message: 'No schedule found. Here is the template structure.',
      template: {
        runNumber: 1,
        status: 'draft',
        createdBy: 'admin@example.com',
        assignments: [],
        conflicts: [],
      },
      examples: {
        status: ['draft', 'under_review', 'approved', 'exported'],
        assignmentExample: {
          courseId: 'CS 101',
          professorId: 'john.doe',
          roomId: 'MUSIC101',
          days: 'MWF',
          startTime: '09:00',
          endTime: '10:30',
          overrideBy: null,
        },
        conflictExample: {
          courseId: 'CS 101',
          reason: 'Professor unavailable',
          resolvedBy: null,
          resolvedAt: null,
        },
      },
      description: {
        runNumber: 'Optional: specific run number to update. Omit to update latest.',
        status: 'Optional: schedule status',
        createdBy: 'Optional: admin email or identifier',
        assignments: 'Optional: array of course-professor-room assignments',
        conflicts: 'Optional: array of scheduling conflicts',
      },
    }
  }

  // Return current schedule structure as template for modification
  return {
    ok: true,
    term,
    message: 'Here is the current schedule structure for PATCH updates.',
    currentSchedule: {
      _id: schedule._id,
      term: schedule.term,
      runNumber: schedule.runNumber,
    },
    template: {
      runNumber: schedule.runNumber,
      status: schedule.status,
      createdBy: schedule.createdBy,
      assignments: schedule.assignments,
      conflicts: schedule.conflicts,
    },
    examples: {
      status: ['draft', 'under_review', 'approved', 'exported'],
      assignmentExample: {
        courseId: 'CS 101',
        professorId: 'john.doe',
        roomId: 'MUSIC101',
        days: 'MWF',
        startTime: '09:00',
        endTime: '10:30',
        overrideBy: null,
      },
      conflictExample: {
        courseId: 'CS 101',
        reason: 'Professor unavailable',
        resolvedBy: null,
        resolvedAt: null,
      },
    },
    validDayPatterns: ['MWF', 'TR', 'MW', 'MTWF', 'MWRF', 'W', 'T', 'R'],
    description: {
      runNumber: 'Optional: specific run number to update. Omit to update latest.',
      status: 'Optional: schedule status (must be one of the valid statuses)',
      createdBy: 'Optional: admin email or identifier',
      assignments: 'Optional: complete array of course-professor-room assignments. Format shown in assignmentExample.',
      conflicts: 'Optional: complete array of scheduling conflicts. Format shown in conflictExample.',
    },
    instructions: {
      _: 'How to use this template:',
      '1': 'Copy the template section',
      '2': 'Modify only the fields you want to update',
      '3': 'Send as PATCH /api/schedule/:term with Content-Type: application/json',
      '4': 'Note: assignments and conflicts arrays replace existing data (not merged)',
    },
  }
})
