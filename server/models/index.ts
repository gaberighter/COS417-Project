import mongoose, { type Model, Schema } from 'mongoose'

export type DayPattern =
  | 'MWF'
  | 'TR'
  | 'MW'
  | 'MTWF'
  | 'MWRF'
  | 'M'
  | 'W'
  | 'T'
  | 'R'
export type RoomType = 'classroom' | 'lab'
export type PreferenceStatus = 'empty' | 'draft' | 'submitted' | 'approved'
export type ScheduleStatus = 'draft' | 'under_review' | 'approved' | 'exported'

export interface IRoomEquipment {
  projector: boolean
  smartboard: boolean
  whiteboard: boolean
  piano: boolean
  labStations: boolean
  computers: boolean
  outlets: boolean
}

export interface IRoom {
  _id?: string
  buildingName: string
  roomNumber: string
  displayName: string
  capacity: number
  roomType: RoomType
  available: boolean
  equipment: IRoomEquipment
  abbreviation: string
}

export interface ICourse {
  _id?: string
  deptCode: string
  courseNumber: string
  title: string
  creditHours: number
  typicalEnrollment?: number | null
  requiredEquipment: string[]
  labComponent: boolean
  active: boolean
  typicalProfessor?: string | null
  typicalDays?: DayPattern | null
  typicalTime?: string | null
  prerequisites: string[]
  corequisites: string[]
}

export interface ICoursePreference {
  courseId: string
  section?: string | null
  title: string
  expectedEnrollment: number
  maxCapacity?: number | null
  creditHours: number
  preferredDays?: DayPattern[]
  preferredTimes?: string[]
  avoidTimes?: string[]
  requiredEquipment?: string[]
  preferredBuilding?: string | null
  preferredRoomId?: string | null
  backToBackWith?: string | null
  coreqWith?: string[]
}

export interface IPreferenceSubmission {
  term: string
  department: string
  submittedBy: string
  submittedAt?: Date | null
  status: PreferenceStatus
  courses: ICoursePreference[]
}

// Preferences are embedded in professor documents because submissions are
// authored, updated, and read in professor context.
export interface IProfessor {
  _id?: string
  covenantId: string
  displayName: string
  departmentCode: string
  officeBuilding?: string | null
  officeRoom?: string | null
  seniorityYear?: number | null
  active: boolean
  preferences: IPreferenceSubmission[]
}

export interface IAssignment {
  courseId: string
  professorId: string
  roomId: string
  days: DayPattern
  startTime: string
  endTime: string
  overrideBy?: string | null
}

export interface IConflict {
  courseId: string
  reason: string
  resolvedBy?: string | null
  resolvedAt?: Date | null
}

export interface ISchedule {
  _id?: string
  term: string
  runNumber: number
  status: ScheduleStatus
  createdBy: string
  assignments: IAssignment[]
  conflicts: IConflict[]
}

export interface IAuditLog {
  _id?: string
  userId?: string | null
  covenantId?: string | null
  action: string
  collectionName?: string | null
  documentId?: string | null
  detail: string
  ipAddress?: string | null
  timestamp: Date
}

function normalize(value: string): string {
  return value.trim()
}

function buildRoomId(room: Pick<IRoom, 'abbreviation'>): string {
  return normalize(room.abbreviation).toUpperCase()
}

function buildCourseId(
  course: Pick<ICourse, 'deptCode' | 'courseNumber'>,
): string {
  return `${normalize(course.deptCode).toUpperCase()} ${normalize(course.courseNumber)}`
}

function buildProfessorId(professor: Pick<IProfessor, 'covenantId'>): string {
  return normalize(professor.covenantId).toLowerCase()
}

function buildScheduleId(term: string, runNumber: number): string {
  return `${normalize(term)}-${runNumber}`
}

const roomEquipmentSchema = new Schema<IRoomEquipment>(
  {
    projector: { type: Boolean, required: true, default: false },
    smartboard: { type: Boolean, required: true, default: false },
    whiteboard: { type: Boolean, required: true, default: false },
    piano: { type: Boolean, required: true, default: false },
    labStations: { type: Boolean, required: true, default: false },
    computers: { type: Boolean, required: true, default: false },
    outlets: { type: Boolean, required: true, default: true },
  },
  { _id: false },
)

const roomSchema = new Schema<IRoom>(
  {
    _id: { type: String },
    buildingName: { type: String, required: true, trim: true },
    roomNumber: { type: String, required: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    roomType: { type: String, required: true, enum: ['classroom', 'lab'] },
    available: { type: Boolean, required: true, default: true },
    equipment: { type: roomEquipmentSchema, required: true },
    abbreviation: { type: String, required: true, trim: true, uppercase: true },
  },
  { collection: 'rooms', timestamps: true, versionKey: false },
)

roomSchema.pre('validate', function setRoomId() {
  if (!this._id) {
    this._id = buildRoomId(this)
  }
})

const courseSchema = new Schema<ICourse>(
  {
    _id: { type: String },
    deptCode: { type: String, required: true, trim: true, uppercase: true },
    courseNumber: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    creditHours: { type: Number, required: true, min: 0 },
    typicalEnrollment: { type: Number, default: null, min: 0 },
    requiredEquipment: { type: [String], required: true, default: [] },
    labComponent: { type: Boolean, required: true, default: false },
    active: { type: Boolean, required: true, default: true },
    typicalProfessor: { type: String, default: null, trim: true },
    typicalDays: {
      type: String,
      enum: ['MWF', 'TR', 'MW', 'MTWF', 'MWRF', 'M', 'W', 'T', 'R'],
      default: null,
    },
    typicalTime: { type: String, default: null, trim: true },
    prerequisites: { type: [String], required: true, default: [] },
    corequisites: { type: [String], required: true, default: [] },
  },
  { collection: 'courseCatalog', timestamps: true, versionKey: false },
)

courseSchema.pre('validate', function setCourseId() {
  if (!this._id) {
    this._id = buildCourseId(this)
  }
})

const coursePreferenceSchema = new Schema<ICoursePreference>(
  {
    courseId: { type: String, required: true, trim: true },
    section: { type: String, default: null, trim: true },
    title: { type: String, required: true, trim: true },
    expectedEnrollment: { type: Number, required: true, min: 0 },
    maxCapacity: { type: Number, default: null, min: 0 },
    creditHours: { type: Number, required: true, min: 0 },
    preferredDays: {
      type: [String],
      enum: ['MWF', 'TR', 'MW', 'MTWF', 'MWRF', 'M', 'W', 'T', 'R'],
      default: [],
    },
    preferredTimes: { type: [String], default: [] },
    avoidTimes: { type: [String], default: [] },
    requiredEquipment: { type: [String], default: [] },
    preferredBuilding: { type: String, default: null, trim: true },
    preferredRoomId: { type: String, default: null, trim: true },
    backToBackWith: { type: String, default: null, trim: true },
    coreqWith: { type: [String], default: [] },
  },
  { _id: false },
)

const preferenceSubmissionSchema = new Schema<IPreferenceSubmission>(
  {
    term: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true, uppercase: true },
    submittedBy: { type: String, required: true, trim: true },
    submittedAt: { type: Date, default: null },
    status: {
      type: String,
      required: true,
      enum: ['empty', 'draft', 'submitted', 'approved'],
      default: 'draft',
    },
    courses: { type: [coursePreferenceSchema], required: true, default: [] },
  },
  { _id: false },
)

const professorSchema = new Schema<IProfessor>(
  {
    _id: { type: String },
    covenantId: { type: String, required: true, trim: true, lowercase: true },
    displayName: { type: String, required: true, trim: true },
    departmentCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    officeBuilding: { type: String, default: null, trim: true },
    officeRoom: { type: String, default: null, trim: true },
    seniorityYear: { type: Number, default: null },
    active: { type: Boolean, required: true, default: true },
    preferences: {
      type: [preferenceSubmissionSchema],
      required: true,
      default: [],
    },
  },
  { collection: 'professors', timestamps: true, versionKey: false },
)

professorSchema.pre('validate', function setProfessorId() {
  if (!this._id) {
    this._id = buildProfessorId(this)
  }
})

const assignmentSchema = new Schema<IAssignment>(
  {
    courseId: { type: String, required: true, trim: true },
    professorId: { type: String, required: true, trim: true },
    roomId: { type: String, required: true, trim: true },
    days: {
      type: String,
      required: true,
      enum: ['MWF', 'TR', 'MW', 'MTWF', 'MWRF', 'M', 'W', 'T', 'R'],
    },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    overrideBy: { type: String, default: null, trim: true },
  },
  { _id: false },
)

const conflictSchema = new Schema<IConflict>(
  {
    courseId: { type: String, required: true, trim: true },
    reason: { type: String, required: true, trim: true },
    resolvedBy: { type: String, default: null, trim: true },
    resolvedAt: { type: Date, default: null },
  },
  { _id: false },
)

const scheduleSchema = new Schema<ISchedule>(
  {
    _id: { type: String },
    term: { type: String, required: true, trim: true },
    runNumber: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      required: true,
      enum: ['draft', 'under_review', 'approved', 'exported'],
      default: 'draft',
    },
    createdBy: { type: String, required: true, trim: true },
    assignments: { type: [assignmentSchema], required: true, default: [] },
    conflicts: { type: [conflictSchema], required: true, default: [] },
  },
  { collection: 'schedules', timestamps: true, versionKey: false },
)

scheduleSchema.pre('validate', function setScheduleId() {
  if (!this._id) {
    this._id = buildScheduleId(this.term, this.runNumber)
  }
})

const auditLogSchema = new Schema<IAuditLog>(
  {
    _id: { type: String },
    userId: { type: String, default: null, trim: true, immutable: true },
    covenantId: { type: String, default: null, trim: true, immutable: true },
    action: { type: String, required: true, trim: true, immutable: true },
    collectionName: {
      type: String,
      default: null,
      trim: true,
      immutable: true,
    },
    documentId: { type: String, default: null, trim: true, immutable: true },
    detail: { type: String, required: true, trim: true, immutable: true },
    ipAddress: { type: String, default: null, trim: true, immutable: true },
    timestamp: {
      type: Date,
      required: true,
      default: () => new Date(),
      immutable: true,
    },
  },
  { collection: 'auditLogs', timestamps: false, versionKey: false },
)

auditLogSchema.pre('validate', function setAuditId() {
  if (!this._id) {
    this._id = new mongoose.Types.ObjectId().toString()
  }
})

// Prevent deletion and mutation of audit logs (write-once enforcement)
function preventAuditLogDelete() {
  throw new Error('Audit logs cannot be deleted')
}

function preventAuditLogUpdate() {
  throw new Error('Audit logs are immutable and cannot be updated')
}

// Register both query and document middleware where supported so the
// prevention runs for calls like `Model.deleteOne()` and document method
// calls like `doc.deleteOne()`.
auditLogSchema.pre(
  'deleteOne',
  { query: true, document: true },
  function preventDeleteOne() {
    preventAuditLogDelete()
  },
)
auditLogSchema.pre('findOneAndDelete', function preventFindOneAndDelete() {
  preventAuditLogDelete()
})
auditLogSchema.pre('deleteMany', function preventDeleteMany() {
  preventAuditLogDelete()
})

auditLogSchema.pre(
  'updateOne',
  { query: true, document: true },
  function preventUpdateOne() {
    preventAuditLogUpdate()
  },
)
auditLogSchema.pre('findOneAndUpdate', function preventFindOneAndUpdate() {
  preventAuditLogUpdate()
})
auditLogSchema.pre('updateMany', function preventUpdateMany() {
  preventAuditLogUpdate()
})

// Cover replacements and bulk operations as well
auditLogSchema.pre('replaceOne', function preventReplaceOne() {
  preventAuditLogUpdate()
})
auditLogSchema.pre('findOneAndReplace', function preventFindOneAndReplace() {
  preventAuditLogUpdate()
})
auditLogSchema.pre('bulkWrite', function preventBulkWrite() {
  preventAuditLogUpdate()
})

roomSchema.index({ abbreviation: 1 }, { unique: true })
courseSchema.index({ deptCode: 1, courseNumber: 1 }, { unique: true })
professorSchema.index({ covenantId: 1 }, { unique: true })
scheduleSchema.index({ term: 1, runNumber: -1 }, { unique: true })
auditLogSchema.index({ timestamp: -1 })

export const Room =
  (mongoose.models.Room as Model<IRoom>) ??
  mongoose.model<IRoom>('Room', roomSchema)

export const CourseCatalog =
  (mongoose.models.CourseCatalog as Model<ICourse>) ??
  mongoose.model<ICourse>('CourseCatalog', courseSchema)

export const Professor =
  (mongoose.models.Professor as Model<IProfessor>) ??
  mongoose.model<IProfessor>('Professor', professorSchema)

export const Schedule =
  (mongoose.models.Schedule as Model<ISchedule>) ??
  mongoose.model<ISchedule>('Schedule', scheduleSchema)

export const AuditLog =
  (mongoose.models.AuditLog as Model<IAuditLog>) ??
  mongoose.model<IAuditLog>('AuditLog', auditLogSchema)

let indexesInitPromise: Promise<void> | null = null

export async function initializeModelIndexes(): Promise<void> {
  if (!indexesInitPromise) {
    indexesInitPromise = Promise.all([
      Room.init(),
      CourseCatalog.init(),
      Professor.init(),
      Schedule.init(),
      AuditLog.init(),
    ]).then(() => undefined)

    indexesInitPromise.catch(() => {
      indexesInitPromise = null
    })
  }

  await indexesInitPromise
}

export function roomCode(room: Pick<IRoom, 'abbreviation'>): string {
  return buildRoomId(room)
}

export function courseCode(
  course: Pick<ICourse, 'deptCode' | 'courseNumber'>,
): string {
  return buildCourseId(course)
}

export function professorCode(
  professor: Pick<IProfessor, 'covenantId'>,
): string {
  return buildProfessorId(professor)
}

export function scheduleCode(term: string, runNumber: number): string {
  return buildScheduleId(term, runNumber)
}
