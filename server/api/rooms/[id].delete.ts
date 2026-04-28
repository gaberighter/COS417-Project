// server/api/rooms/[id].delete.ts
// DELETE /api/rooms/:id — remove a room by abbreviation/_id.
// Role: Admin

import { defineEventHandler, getRouterParam, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Room } from '../../models/index'
import { logAction } from '../../services/auditService'
import { getClientIp } from '../../utils/ip'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  const id = getRouterParam(event, 'id')
  if (!id || !id.trim()) {
    // Missing or empty id is a client error — return 400 instead of a 500.
    throw createError({ statusCode: 400, statusMessage: 'Room id is required' })
  }

  const clientIp = getClientIp(event)
  const roomId = id.trim().toUpperCase()

  // Find and delete the room
  const deleted = await Room.findOneAndDelete({ _id: roomId }).lean().exec()

  if (!deleted) {
    // Return 404 when the requested room doesn't exist.
    throw createError({
      statusCode: 404,
      statusMessage: `Room not found: ${roomId}`,
    })
  }

  await logAction(
    auth,
    'ROOM_DELETE',
    'rooms',
    roomId,
    `Deleted room ${deleted.buildingName} ${deleted.roomNumber}`,
    clientIp,
  )

  return { ok: true, deleted: deleted }
})
