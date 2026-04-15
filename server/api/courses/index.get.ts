// server/api/courses/index.get.ts
// GET /api/courses — §4.1.2
// Role: Admin | Faculty — returns active course catalog.

import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { db } from '../../models/index'

export default defineEventHandler(async (event) => {
  requireAuth(event, ['Admin', 'Faculty'])
  await connectDB()

  // TODO: replace with → return CourseCatalog.find({ active: true });
  return db.courses.filter((course) => course.active)
})
