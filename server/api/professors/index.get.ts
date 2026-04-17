// server/api/professors/index.get.ts
// GET /api/professors — §4.3.2
// Role: Admin — returns active professor records.

import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Professor } from '../../models/index'

export default defineEventHandler(async (event) => {
  requireAuth(event, ['Admin'])
  await connectDB()

  return Professor.find({ active: true }).lean().exec()
})
