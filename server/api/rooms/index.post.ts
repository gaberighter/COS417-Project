// server/api/rooms/index.post.ts
// POST /api/rooms — §4.4.2
// Role: Admin — create or update a room record (upsert on buildingCode+roomNumber).

import { defineEventHandler, readBody, createError } from "h3";
import { requireAuth } from "../../utils/auth";
import { connectDB } from "../../utils/db";
import { db, type IRoom, type IRoomEquipment } from "../../models/index";
import { logAction } from "../../services/auditService";

const defaultEquipment = (): IRoomEquipment => ({
  projector: false,
  smartboard: false,
  whiteboard: false,
  piano: false,
  labStations: false,
  computers: false,
  outlets: true,
});

function normalizeEquipment(
  current: IRoomEquipment | undefined,
  patch: Partial<IRoomEquipment> | undefined,
  legacyFeatures: string[] | undefined
): IRoomEquipment {
  const next = {
    ...defaultEquipment(),
    ...(current ?? {}),
    ...(patch ?? {}),
  };

  for (const feature of legacyFeatures ?? []) {
    if (feature === "projector") next.projector = true;
    if (feature === "smartboard") next.smartboard = true;
    if (feature === "whiteboard") next.whiteboard = true;
    if (feature === "piano") next.piano = true;
    if (feature === "labStations") next.labStations = true;
    if (feature === "computers") next.computers = true;
    if (feature === "outlets") next.outlets = true;
  }

  return next;
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ["Admin"]);
  await connectDB();

  const body = await readBody<Partial<IRoom> & { features?: string[]; isActive?: boolean }>(event);
  const buildingCode = body.buildingCode?.trim().toUpperCase();
  const roomNumber = body.roomNumber?.trim();

  if (!buildingCode || !roomNumber) {
    throw createError({ statusCode: 400, statusMessage: "buildingCode and roomNumber are required" });
  }
  if (!/^[A-Z]{2,4}$/.test(buildingCode)) {
    throw createError({ statusCode: 400, statusMessage: "buildingCode must be 2-4 uppercase letters" });
  }
  if (body.capacity !== undefined && (!Number.isInteger(body.capacity) || body.capacity < 1)) {
    throw createError({ statusCode: 400, statusMessage: "capacity must be an integer >= 1" });
  }
  if (body.roomType && !["classroom", "lab"].includes(body.roomType)) {
    throw createError({ statusCode: 400, statusMessage: "roomType must be 'classroom' or 'lab'" });
  }

  const existing = db.rooms.findIndex(
    (room) => room.buildingCode === buildingCode && room.roomNumber === roomNumber
  );
  const current = existing >= 0 ? db.rooms[existing] : undefined;
  const now = new Date();
  const room: IRoom = {
    _id: current?._id ?? `${buildingCode}-${roomNumber}`,
    buildingCode,
    roomNumber,
    displayName:
      body.displayName !== undefined ? body.displayName : current?.displayName ?? null,
    capacity: body.capacity ?? current?.capacity ?? 1,
    roomType: body.roomType ?? current?.roomType ?? "classroom",
    available: body.available ?? body.isActive ?? current?.available ?? true,
    equipment: normalizeEquipment(current?.equipment, body.equipment, body.features),
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };

  if (room.equipment.labStations && room.roomType !== "lab") {
    throw createError({ statusCode: 400, statusMessage: "labStations requires roomType 'lab'" });
  }

  if (existing >= 0) {
    db.rooms[existing] = room;
  } else {
    db.rooms.push(room);
  }

  await logAction(
    auth,
    "ROOM_UPSERT",
    "rooms",
    room._id,
    `Created or updated room ${room.buildingCode} ${room.roomNumber}`
  );
  return room;
});
