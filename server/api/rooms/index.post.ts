// server/api/rooms/index.post.ts
// POST /api/rooms — §4.4.2
// Role: Admin — create or update a room record (upsert on room abbreviation/_id).

import { defineEventHandler, readBody, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Room, type IRoom, type IRoomEquipment } from '../../models/index'
import { logAction } from '../../services/auditService'

// Initiate to false for all except outlets for default arrangement
const defaultEquipment = (): IRoomEquipment => ({
  projector: false,
  smartboard: false,
  whiteboard: false,
  piano: false,
  labStations: false,
  computers: false,
  outlets: true,
})

// Normalize equipment by merging default, current, patch, and legacy features
function normalizeEquipment(
  current: IRoomEquipment | undefined,
  patch: Partial<IRoomEquipment> | undefined,
  legacyFeatures: string[] | undefined,
): IRoomEquipment {
  const next = {
    ...defaultEquipment(),
    ...(current ?? {}),
    ...(patch ?? {}),
  }

  for (const feature of legacyFeatures ?? []) {
    if (feature === 'projector') next.projector = true
    if (feature === 'smartboard') next.smartboard = true
    if (feature === 'whiteboard') next.whiteboard = true
    if (feature === 'piano') next.piano = true
    if (feature === 'labStations') next.labStations = true
    if (feature === 'computers') next.computers = true
    if (feature === 'outlets') next.outlets = true
  }

  return next
}

// Main endpoint call handler
export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  type RoomPayload = {
    buildingCode?: string
    buildingName?: string
    roomNumber?: string
    displayName?: string | null
    abbreviation?: string
    capacity?: number
    roomType?: IRoom['roomType']
    available?: boolean
    isActive?: boolean
    equipment?: Partial<IRoomEquipment>
    features?: string[]
  }

  let body: RoomPayload
  try {
    body = (await readBody<RoomPayload>(event)) ?? {}
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing or invalid JSON body',
    })
  }

  const buildingCode = body.buildingCode?.trim().toUpperCase()
  const inferredBuildingCode = body.abbreviation?.trim().split(/\s+/)[0]?.toUpperCase()
  const normalizedBuildingCode = buildingCode ?? inferredBuildingCode
  const roomNumber = body.roomNumber?.trim()

  if (!normalizedBuildingCode || !roomNumber) {
    throw createError({
      statusCode: 400,
      statusMessage: 'buildingCode and roomNumber are required',
    })
  }
  if (!/^[A-Z]{2,4}$/.test(normalizedBuildingCode)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'buildingCode must be 2-4 uppercase letters',
    })
  }
  if (
    body.capacity !== undefined &&
    (!Number.isInteger(body.capacity) || body.capacity < 1)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'capacity must be an integer >= 1',
    })
  }
  if (body.roomType && !['classroom', 'lab'].includes(body.roomType)) {
    throw createError({
      statusCode: 400,
      statusMessage: "roomType must be 'classroom' or 'lab'",
    })
  }

  const abbreviation =
    body.abbreviation?.trim().toUpperCase() ??
    `${normalizedBuildingCode} ${roomNumber}`

  const existing = await Room.findOne({ _id: abbreviation }).lean().exec()

  const room: Partial<IRoom> = {
    _id: abbreviation,
    abbreviation,
    buildingName:
      body.buildingName?.trim() ?? existing?.buildingName ?? normalizedBuildingCode,
    roomNumber,
    displayName:
      body.displayName !== undefined
        ? body.displayName
        : (existing?.displayName ?? `${normalizedBuildingCode} ${roomNumber}`),
    capacity: body.capacity ?? existing?.capacity ?? 1,
    roomType: body.roomType ?? existing?.roomType ?? 'classroom',
    available: body.available ?? body.isActive ?? existing?.available ?? true,
    equipment: normalizeEquipment(
      existing?.equipment,
      body.equipment,
      body.features,
    ),
  }

  if (room.equipment?.labStations && room.roomType !== 'lab') {
    throw createError({
      statusCode: 400,
      statusMessage: "labStations requires roomType 'lab'",
    })
  }

  const saved = await Room.findOneAndUpdate({ _id: abbreviation }, room, {
    upsert: true,
    new: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  })
    .lean()
    .exec()

  await logAction(
    auth,
    'ROOM_UPSERT',
    'rooms',
    saved?._id,
    `Created or updated room ${normalizedBuildingCode} ${roomNumber}`,
  )

  return saved
})
