// server/api/rooms/[id].patch.ts
// PATCH /api/rooms/:id — update mutable fields of a room record.
// Role: Admin

import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import mongoose from 'mongoose'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Room, type IRoomEquipment } from '../../models/index'
import { logAction } from '../../services/auditService'

const IS_OBJECT_ID = /^[0-9a-f]{24}$/i

async function findRoomByAnyId(roomId: string) {
  const byString = await Room.findOne({
    $or: [{ _id: roomId }, { abbreviation: roomId }],
  })
    .lean()
    .exec()
  if (byString) return byString
  if (IS_OBJECT_ID.test(roomId)) {
    const raw = await Room.collection.findOne({
      $or: [
        { _id: new mongoose.Types.ObjectId(roomId) },
        { abbreviation: roomId },
      ],
    })
    return raw as typeof byString | null
  }
  return null
}

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

  const id = getRouterParam(event, 'id', { decode: true })
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

  const existing = await findRoomByAnyId(roomId)
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await Room.collection.findOneAndUpdate(
    { _id: existing._id } as any,
    { $set: patch },
    { returnDocument: 'after' },
  )

  await logAction(
    auth,
    'ROOM_UPDATE',
    'rooms',
    String(updated?._id ?? roomId),
    `Updated room ${roomId}`,
  )

  return updated
})
