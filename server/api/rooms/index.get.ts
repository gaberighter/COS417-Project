// server/api/rooms/index.get.ts
// GET /api/rooms — §4.4.2
// Role: Admin | Faculty — returns full room inventory.

import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Room } from '../../models/index'

export default defineEventHandler(async (event) => {
  requireAuth(event, ['Admin', 'Faculty'])
  await connectDB()

  return Room.find({}).lean().exec()
})
