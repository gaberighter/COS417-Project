// server/api/preferences/[term].get.ts
// GET /api/preferences/:term — §4.3.2
// Role: Admin — retrieve all preference submissions for a term.
// Note: since preferences are stored per-professor (not per-term in the stub),
//       this returns all professors who have submitted preferences.
//       With Mongoose you'd query a dedicated Preferences collection by term.

import { defineEventHandler, getRouterParam, createError } from "h3";
import { requireAuth } from "../../utils/auth";
import { connectDB } from "../../utils/db";
import { db } from "../../models/index";

export default defineEventHandler(async (event) => {
  requireAuth(event, ["Admin"]);
  await connectDB();

  const term = getRouterParam(event, "term");
  if (!term) {
    throw createError({ statusCode: 400, statusMessage: "term is required" });
  }

  const results = db.professors
    .filter((professor) => professor.active)
    .flatMap((professor) =>
      professor.preferences
        .filter((submission) => submission.term === term)
        .map((submission) => ({
          professorId: professor._id ?? professor.covenantId,
          covenantId: professor.covenantId,
          displayName: professor.displayName,
          departmentCode: professor.departmentCode,
          ...submission,
        }))
    );

  return results;
});
