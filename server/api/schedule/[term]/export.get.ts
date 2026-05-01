// server/api/schedule/[term]/export.get.ts
// GET /api/schedule/:term/export — §4.5.2
// Role: Admin | Faculty — download a human-readable schedule as CSV or Excel.

import {
  defineEventHandler,
  getRouterParam,
  createError,
  getQuery,
  setHeader,
} from 'h3'
import { requireAuth } from '../../../utils/auth'
import { connectDB } from '../../../utils/db'
import { logAction } from '../../../services/auditService'
import {
  findScheduleByTerm,
  parseOptionalRunNumber,
} from '../../../services/scheduling/scheduleRecords'
import {
  buildScheduleExportFile,
  markScheduleAsExported,
  parseScheduleExportFormat,
} from '../../../services/scheduling/scheduleExport'

const TERM_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin', 'Faculty'])
  await connectDB()
  const query = getQuery(event)

  const term = getRouterParam(event, 'term')
  if (!term) {
    throw createError({ statusCode: 400, statusMessage: 'term is required' })
  }
  if (!TERM_PATTERN.test(term)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid term format' })
  }
  const runNumber = parseOptionalRunNumber(query.runNumber)
  const format = parseScheduleExportFormat(query.format)
  const schedule = await findScheduleByTerm(term, runNumber, { lean: true })
  if (!schedule) {
    throw createError({
      statusCode: 404,
      statusMessage:
        runNumber !== undefined
          ? `No schedule for term ${term} run ${runNumber}`
          : `No schedule for term: ${term}`,
    })
  }

  const file = await buildScheduleExportFile(schedule, format)
  await markScheduleAsExported(schedule._id)
  setHeader(
    event,
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  )
  setHeader(event, 'Pragma', 'no-cache')
  setHeader(event, 'Expires', '0')
  setHeader(event, 'Surrogate-Control', 'no-store')
  setHeader(event, 'X-Schedule-Export-Version', 'human-readable-v2')
  setHeader(
    event,
    'X-Schedule-Export-Headers',
    'Dept|Course|Section|Title|Instructor|Time|Building|Room|Enroll|CRN|Course Fee',
  )
  setHeader(event, 'Content-Type', file.contentType)
  setHeader(
    event,
    'Content-Disposition',
    `attachment; filename="${file.filename}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
  )

  await logAction(
    auth,
    'SCHEDULE_EXPORT',
    'schedules',
    schedule._id,
    `Exported ${format.toUpperCase()} schedule for ${term} run ${schedule.runNumber}`,
  )
  return file.body
})
