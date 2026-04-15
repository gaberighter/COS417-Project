// server/api/schedule/[term]/export.get.ts
// GET /api/schedule/:term/export — §4.5.2
// Role: Admin — download Banner-compatible CSV.

import { defineEventHandler, getRouterParam, createError, setHeader } from "h3";
import { requireAuth } from "../../../utils/auth";
import { connectDB } from "../../../utils/db";
import {
  db,
  type IAssignment,
  type ICourse,
  type IProfessor,
  type IRoom,
} from "../../../models/index";
import { logAction } from "../../../services/auditService";

const bannerHeaders = [
  "Department",
  "CourseNumber",
  "Section",
  "Title",
  "CreditHours",
  "ProfessorCovenantId",
  "Days",
  "StartTime",
  "EndTime",
  "BuildingCode",
  "RoomNumber",
  "EstimatedEnrollment",
] as const;

const TERM_PARAM_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function findCourse(courseId: string): ICourse | undefined {
  return db.courses.find((candidate) => candidate._id === courseId);
}

function findProfessor(professorId: string): IProfessor | undefined {
  return db.professors.find(
    (candidate) =>
      candidate._id === professorId || candidate.covenantId === professorId,
  );
}

function findRoom(roomId: string): IRoom | undefined {
  return db.rooms.find(
    (candidate) =>
      candidate._id === roomId ||
      `${candidate.buildingCode}-${candidate.roomNumber}` === roomId,
  );
}

function findEstimatedEnrollment(
  term: string,
  professorId: string,
  courseId: string,
): number | null {
  const professor = findProfessor(professorId);
  const submission = professor?.preferences.find(
    (candidate) => candidate.term === term,
  );
  const coursePreference = submission?.courses.find(
    (candidate) => candidate.courseId === courseId,
  );

  return coursePreference?.expectedEnrollment ?? null;
}

function buildBannerRows(term: string, assignments: IAssignment[]): string[] {
  const rows: string[] = [];
  const missingFields: string[] = [];

  for (const assignment of assignments) {
    const course = findCourse(assignment.courseId);
    const professor = findProfessor(assignment.professorId);
    const room = findRoom(assignment.roomId);
    const estimatedEnrollment = findEstimatedEnrollment(
      term,
      assignment.professorId,
      assignment.courseId,
    );

    const values = [
      course?.deptCode ?? "",
      course?.courseNumber ?? "",
      "",
      course?.title ?? "",
      course ? String(course.creditHours) : "",
      professor?.covenantId ?? "",
      assignment.days ?? "",
      assignment.startTime ?? "",
      assignment.endTime ?? "",
      room?.buildingCode ?? "",
      room?.roomNumber ?? "",
      estimatedEnrollment !== null ? String(estimatedEnrollment) : "",
    ];

    const rowMissing = bannerHeaders.filter((_, index) => values[index] === "");
    if (rowMissing.length > 0) {
      missingFields.push(`${assignment.courseId}: ${rowMissing.join(", ")}`);
      continue;
    }

    rows.push(values.map(escapeCsv).join(","));
  }

  if (missingFields.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot export schedule with missing required data: ${missingFields.join("; ")}`,
    });
  }

  return rows;
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ["Admin"]);
  await connectDB();

  const term = getRouterParam(event, "term");
  if (!term) {
    throw createError({ statusCode: 400, statusMessage: "term is required" });
  }
  if (!TERM_PARAM_PATTERN.test(term)) {
    throw createError({
      statusCode: 400,
      statusMessage: "invalid term format",
    });
  }

  const schedule = db.schedules
    .filter((candidate) => candidate.term === term)
    .sort((left, right) => right.runNumber - left.runNumber)[0];
  if (!schedule) {
    throw createError({
      statusCode: 404,
      statusMessage: `No schedule for term: ${term}`,
    });
  }
  if (!["approved", "exported"].includes(schedule.status)) {
    throw createError({
      statusCode: 409,
      statusMessage: `Schedule ${term} must be approved before export`,
    });
  }

  const rows = buildBannerRows(term, schedule.assignments);
  const csv = [bannerHeaders.join(","), ...rows].join("\n");

  schedule.status = "exported";
  schedule.updatedAt = new Date();

  setHeader(event, "Content-Type", "text/csv; charset=utf-8");
  const encodedTerm = encodeURIComponent(term);
  setHeader(
    event,
    "Content-Disposition",
    `attachment; filename="schedule_${term}.csv"; filename*=UTF-8''schedule_${encodedTerm}.csv`,
  );

  await logAction(
    auth,
    "SCHEDULE_EXPORT",
    "schedules",
    schedule._id,
    `Exported Banner CSV for ${term}`,
  );
  return csv;
});
