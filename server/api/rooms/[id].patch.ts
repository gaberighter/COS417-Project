// server/api/rooms/[id].patch.ts
// PATCH /api/rooms/:id — update mutable fields of a room record.
// Role: Admin

import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Room, type IRoomEquipment } from '../../models/index'
import { logAction } from '../../services/auditService'

type RoomPatchPayload = {
  buildingName?: string
  displayName?: string | null
  capacity?: number
  roomType?: 'classroom' | 'lab'
  available?: boolean
  equipment?: Partial<IRoomEquipment>
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  const id = getRouterParam(event, 'id')
  if (!id?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Room id is required' })
  }

  let body: RoomPatchPayload
  try {
    body = (await readBody<RoomPatchPayload>(event)) ?? {}
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing or invalid JSON body',
    })
  }

  const roomId = id.trim().toUpperCase()

  const existing = await Room.findById(roomId).lean().exec()
  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: `Room not found: ${roomId}`,
    })
  }

  const patch: Record<string, unknown> = {}
  let changes = 0

  if (hasOwn(body, 'buildingName')) {
    const v = body.buildingName?.trim()
    if (!v) {
      throw createError({
        statusCode: 400,
        statusMessage: 'buildingName must not be empty',
      })
    }
    patch.buildingName = v
    changes++
  }
  if (hasOwn(body, 'displayName')) {
    patch.displayName =
      body.displayName?.trim() || existing.displayName || roomId
    changes++
  }
  if (hasOwn(body, 'capacity')) {
    if (!Number.isInteger(body.capacity) || (body.capacity ?? 0) < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'capacity must be an integer >= 1',
      })
    }
    patch.capacity = body.capacity
    changes++
  }
  if (hasOwn(body, 'roomType')) {
    if (!['classroom', 'lab'].includes(body.roomType ?? '')) {
      throw createError({
        statusCode: 400,
        statusMessage: "roomType must be 'classroom' or 'lab'",
      })
    }
    patch.roomType = body.roomType
    changes++
  }
  if (hasOwn(body, 'available')) {
    patch.available = Boolean(body.available)
    changes++
  }
  if (hasOwn(body, 'equipment')) {
    patch.equipment = {
      ...(existing.equipment ?? {}),
      ...(body.equipment ?? {}),
    }
    changes++
  }

  if (changes === 0) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'No mutable fields provided. Mutable fields: buildingName, displayName, capacity, roomType, available, equipment',
    })
  }

  const resolvedRoomType =
    (patch.roomType as string | undefined) ?? existing.roomType
  const resolvedEquipment =
    (patch.equipment as IRoomEquipment | undefined) ?? existing.equipment

  if (resolvedEquipment?.labStations && resolvedRoomType !== 'lab') {
    throw createError({
      statusCode: 400,
      statusMessage: "labStations requires roomType 'lab'",
    })
  }

  const updated = await Room.findByIdAndUpdate(
    roomId,
    { $set: patch },
    { new: true, runValidators: true },
  )
    .lean()
    .exec()

  await logAction(
    auth,
    'ROOM_UPDATE',
    'rooms',
    updated?._id,
    `Updated room ${roomId}`,
  )

  return updated
})
