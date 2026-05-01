// server/api/courses/index.get.ts
// GET /api/courses — §4.1.2
// Role: Admin | Faculty — returns active course catalog.
// Admins may pass ?includeInactive=true to receive all records.

import { defineEventHandler, getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { CourseCatalog } from '../../models/index'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin', 'Faculty'])
  await connectDB()

  const { includeInactive } = getQuery(event)
  const isAdmin = auth.role === 'Admin'
  const filter = isAdmin && includeInactive === 'true' ? {} : { active: true }

  return CourseCatalog.find(filter).lean().exec()
})
