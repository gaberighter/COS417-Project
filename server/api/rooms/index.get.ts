// server/api/rooms/index.get.ts
// GET /api/rooms — §4.4.2
// Role: Admin — returns full room inventory.

import { defineEventHandler } from "h3";
import { requireAuth } from "../../utils/auth";
import { connectDB } from "../../utils/db";
import { db } from "../../models/index";

export default defineEventHandler(async (event) => {
  requireAuth(event, ["Admin"]);
  await connectDB();

  // TODO: replace with → return Room.find({});
  return db.rooms;
});
