export type ScheduleStatus = 'draft' | 'under_review' | 'approved' | 'exported'

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

export interface ScheduleAssignment {
  courseId: string
  professorId: string
  roomId: string
  days: DayPattern
  startTime: string
  endTime: string
  enrollmentOverride?: number | null
  overrideBy?: string | null
}

export interface ScheduleIssue {
  courseId: string
  reason: string
  resolvedBy?: string | null
  resolvedAt?: string | Date | null
}

export interface PlacementTrace {
  courseId: string
  catalogCourseId: string
  professorId: string
  status: 'assigned' | 'conflict'
  stage:
    | 'single_candidate'
    | 'optimized'
    | 'constraint_conflict'
    | 'evaluation_failed'
    | 'optimization_failed'
    | 'assignment_failed'
  chosen?: {
    roomId: string
    days: DayPattern
    startTime: string
    endTime: string
  } | null
  candidateRooms: string[]
  candidateSlots: Array<{
    days: DayPattern
    startTime: string
    endTime: string
  }>
  candidateCount: number
  selectedTier?: string | null
  reasons: string[]
  decisionLog: string[]
}

export interface SavedScheduleSummary {
  _id: string
  term: string
  runNumber: number
  status: ScheduleStatus
  createdBy: string
  assignmentCount?: number
  createdAt?: string
  updatedAt?: string
  approvedAt?: string | null
  approvedBy?: string | null
}

export interface SavedScheduleDetails extends SavedScheduleSummary {
  assignments: ScheduleAssignment[]
  conflicts: ScheduleIssue[]
  warnings: string[]
  nearHardFlags: ScheduleIssue[]
  traces: PlacementTrace[]
}

export interface ScheduleTermIndexEntry {
  term: string
  hasPreferences: boolean
  runs: SavedScheduleSummary[]
}

export interface ScheduleRunResponse {
  ok: true
  persisted: false
  term: string
  recommendedStatus: ScheduleStatus
  assignments: ScheduleAssignment[]
  conflicts: ScheduleIssue[]
  nearHardFlags: ScheduleIssue[]
  warnings: string[]
  traces: PlacementTrace[]
}

export interface CourseRecord {
  _id: string
  deptCode: string
  courseNumber: string
  title: string
  creditHours: number
}

export interface ProfessorRecord {
  _id: string
  covenantId: string
  displayName: string
  departmentCode: string
}

export interface RoomRecord {
  _id: string
  buildingName: string
  roomNumber: string
  displayName: string
  abbreviation: string
  capacity: number
  roomType: 'classroom' | 'lab'
}

export interface PreferenceSubmissionRecord {
  professorId: string
  covenantId: string
  displayName: string
  departmentCode: string
  term: string
  submittedBy: string
  submittedAt?: string | null
  status: 'submitted' | 'not_submitted'
  courses: Array<{
    courseId: string
    section?: string | null
    title: string
    expectedEnrollment: number
    creditHours: number
    instructor?: string | null
  }>
}

export interface EnrichedScheduleRow {
  courseId: string
  catalogCourseId: string
  section: string | null
  department: string
  courseNumber: string
  courseTitle: string
  instructorId: string
  instructorName: string
  roomId: string
  building: string
  roomNumber: string
  roomLabel: string
  enrollment: number | null
  days: DayPattern
  startTime: string
  endTime: string
  timeLabel: string
  overrideBy?: string | null
}
