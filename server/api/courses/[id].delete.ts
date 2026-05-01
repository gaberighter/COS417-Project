// server/api/courses/[id].delete.ts
// DELETE /api/courses/:id — remove a course by _id.
// Role: Admin

import { defineEventHandler, getRouterParam, createError } from 'h3'
import mongoose from 'mongoose'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { CourseCatalog } from '../../models/index'
import { logAction } from '../../services/auditService'
import { getClientIp } from '../../utils/ip'

const IS_OBJECT_ID = /^[0-9a-f]{24}$/i

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  const id = getRouterParam(event, 'id', { decode: true })
  if (!id || !id.trim()) {
    // Missing or empty id is a client error — return 400 instead of a 500.
    throw createError({
      statusCode: 400,
      statusMessage: 'Course id is required',
    })
  }

  const clientIp = getClientIp(event)
  const courseId = id.trim()

  // Find and delete the course — handle both String _id and legacy ObjectId _id
  let deleted = await CourseCatalog.findOneAndDelete({ _id: courseId })
    .lean()
    .exec()
  if (!deleted && IS_OBJECT_ID.test(courseId)) {
    const raw = await CourseCatalog.collection.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(courseId),
    })
    deleted = raw as typeof deleted
  }

  if (!deleted) {
    // Return 404 when the requested course _id doesn't exist.
    throw createError({
      statusCode: 404,
      statusMessage: `Course not found: ${courseId}`,
    })
  }

  await logAction(
    auth,
    'COURSE_DELETE',
    'courseCatalog',
    courseId,
    `Deleted course ${deleted.deptCode} ${deleted.courseNumber}: ${deleted.title}`,
    clientIp,
  )

  return { ok: true, deleted: deleted }
})
