// server/api/rooms/[id].delete.ts
// DELETE /api/rooms/:id — remove a room by abbreviation/_id.
// Role: Admin

import { defineEventHandler, getRouterParam, createError } from 'h3'
import mongoose from 'mongoose'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Room } from '../../models/index'
import { logAction } from '../../services/auditService'
import { getClientIp } from '../../utils/ip'

const IS_OBJECT_ID = /^[0-9a-f]{24}$/i

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  const id = getRouterParam(event, 'id', { decode: true })
  if (!id || !id.trim()) {
    // Missing or empty id is a client error — return 400 instead of a 500.
    throw createError({ statusCode: 400, statusMessage: 'Room id is required' })
  }

  const clientIp = getClientIp(event)
  const roomId = id.trim().toUpperCase()

  // Handle abbreviation, String _id, and legacy ObjectId _id values.
  let deleted = await Room.findOneAndDelete({
    $or: [{ _id: roomId }, { abbreviation: roomId }],
  })
    .lean()
    .exec()
  if (!deleted && IS_OBJECT_ID.test(roomId)) {
    const raw = await Room.collection.findOneAndDelete({
      $or: [
        { _id: new mongoose.Types.ObjectId(roomId) },
        { abbreviation: roomId },
      ],
    })
    deleted = raw as typeof deleted
  }

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
