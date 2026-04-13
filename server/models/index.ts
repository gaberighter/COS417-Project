// §5 — Mongoose schemas (stub — wire to real MongoDB via MONGODB_URI in .env)
// Replace these in-memory stubs with real Mongoose models once DB is connected.
// Each export mirrors the collection schema from SDD §5.2–§5.6.

export type DayPattern = "MWF" | "TR" | "MW" | "MTWF";
export type RoomType = "classroom" | "lab";
export type PreferenceStatus = "empty" | "draft" | "submitted" | "approved";
export type ScheduleStatus = "draft" | "under_review" | "approved" | "exported";

export interface ITimestampedDocument {
  createdAt?: Date;
  updatedAt?: Date;
}

// ── rooms ────────────────────────────────────────────────────────────────────
export interface IRoomEquipment {
  projector: boolean;
  smartboard: boolean;
  whiteboard: boolean;
  piano: boolean;
  labStations: boolean;
  computers: boolean;
  outlets: boolean;
}

export interface IRoom extends ITimestampedDocument {
  _id?: string;
  buildingCode: string;
  roomNumber: string;
  displayName?: string | null;
  capacity: number;
  roomType: RoomType;
  available: boolean;
  equipment: IRoomEquipment;
}

// ── courseCatalog ─────────────────────────────────────────────────────────────
export interface ICourse extends ITimestampedDocument {
  _id?: string;
  deptCode: string;
  courseNumber: string;
  title: string;
  creditHours: number;
  typicalEnrollment?: number | null;
  requiredEquipment: string[];
  labComponent: boolean;
  active: boolean;
  typicalProfessor?: string | null;
  typicalDays?: DayPattern | null;
  typicalTime?: string | null;
  prerequisites: string[];
  corequisites: string[];
}

// ── professors ────────────────────────────────────────────────────────────────
export interface ICoursePreference {
  courseId: string;
  title: string;
  expectedEnrollment: number;
  maxCapacity?: number | null;
  creditHours: number;
  preferredDays?: DayPattern[];
  preferredTimes?: string[];
  avoidTimes?: string[];
  requiredEquipment?: string[];
  preferredBuilding?: string | null;
  preferredRoomId?: string | null;
  backToBackWith?: string | null;
  coreqWith?: string[];
}

export interface IPreferenceSubmission {
  term: string;
  department: string;
  submittedBy: string;
  submittedAt?: Date | null;
  status: PreferenceStatus;
  courses: ICoursePreference[];
}

export interface IProfessor extends ITimestampedDocument {
  _id?: string;
  covenantId: string;
  displayName: string;
  departmentCode: string;
  officeBuilding?: string | null;
  officeRoom?: string | null;
  seniorityYear?: number | null;
  active: boolean;
  preferences: IPreferenceSubmission[];
}

// ── schedules ─────────────────────────────────────────────────────────────────
export interface IAssignment extends ITimestampedDocument {
  courseId: string;
  professorId: string;
  roomId: string;
  days: DayPattern;
  startTime: string;
  endTime: string;
  overrideBy?: string | null;
}

export interface IConflict extends ITimestampedDocument {
  courseId: string;
  reason: string;
  resolvedBy?: string | null;
  resolvedAt?: Date | null;
}

export interface ISchedule extends ITimestampedDocument {
  _id?: string;
  term: string;
  runNumber: number;
  status: ScheduleStatus;
  createdBy: string;
  assignments: IAssignment[];
  conflicts: IConflict[];
}

// ── auditLogs ─────────────────────────────────────────────────────────────────
export interface IAuditLog extends ITimestampedDocument {
  _id?: string;
  userId?: string | null;
  covenantId?: string | null;
  action: string;
  collection?: string | null;
  documentId?: string | null;
  detail: string;
  ipAddress?: string | null;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// STUB in-memory stores — replace with Mongoose model calls
// ---------------------------------------------------------------------------
export const db = {
  rooms: [] as IRoom[],
  courses: [] as ICourse[],
  professors: [] as IProfessor[],
  schedules: [] as ISchedule[],
  auditLogs: [] as IAuditLog[],
};
