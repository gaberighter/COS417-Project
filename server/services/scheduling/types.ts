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

export type ScheduleStatus = 'draft' | 'under_review' | 'approved' | 'exported'

export type PreferenceStatus = 'submitted' | 'not_submitted'

export interface Room {
  _id: string
  buildingCode: string
  roomNumber: string
  displayName: string | null
  abbreviation?: string | null
  capacity: number
  roomType: 'classroom' | 'lab'
  available: boolean
  equipment: {
    projector: boolean
    smartboard: boolean
    whiteboard: boolean
    piano: boolean
    labStations: boolean
    computers: boolean
    outlets: boolean
  }
}

export interface Course {
  _id: string
  deptCode: string
  courseNumber: string
  title: string
  creditHours: number
  typicalEnrollment: number | null
  requiredEquipment: string[]
  labComponent: boolean
  active: boolean
  typicalProfessor: string | null
  typicalDays: DayPattern | null
  typicalTime: string | null
  prerequisites: string[]
  corequisites: string[]
}

export interface CoursePreference {
  courseId: string
  section?: string | null
  title: string
  expectedEnrollment: number | null
  maxCapacity: number | null
  creditHours: number
  preferredDays: DayPattern[]
  preferredTimes: string[]
  avoidTimes: string[]
  requiredEquipment: string[]
  instructor?: string | null
  preferredBuilding: string | null
  preferredRoomId: string | null
  backToBackWith: string | null
  coreqWith: string[]
}

export interface PreferenceSubmission {
  term: string
  departmentCode: string
  submittedBy: string
  submittedAt: Date | null
  status: PreferenceStatus
  courses: CoursePreference[]
}

export interface Professor {
  _id: string
  covenantId: string
  displayName: string
  departmentCode: string
  officeBuilding: string | null
  officeRoom: string | null
  seniorityYear: number | null
  active: boolean
  preferences: PreferenceSubmission[]
}

export interface PreferenceRecord extends CoursePreference {
  catalogCourseId: string
  scheduledCourseId: string
  section: string | null
  professorId: string
  professorName: string
  departmentCode: string
  submittedAt: Date | null
  status: PreferenceStatus
  term: string
}

export interface CourseWorkItem {
  scheduledCourseId: string
  catalogCourseId: string
  section: string | null
  course: Course
  professor: Professor
  preference: PreferenceRecord | null
  historicalAssignments: HistoricalAssignment[]
  professorHistory: HistoricalAssignment[]
  similarProfessorHistory: HistoricalAssignment[]
  similarCourseHistory: HistoricalAssignment[]
  departmentHistory: HistoricalAssignment[]
  similarDepartmentHistory: HistoricalAssignment[]
  historicalPreferences: PreferenceRecord[]
  placementProfile: PlacementProfile
  hasSubmittedRoomBuildingPreference: boolean
  hasDirectRoomHistory: boolean
  departmentTypicalRoomIds: string[]
  expectedEnrollment: number | null
  preferredDays: DayPattern[]
  preferredTimes: string[]
  avoidTimes: string[]
  requiredEquipment: string[]
  preferredBuilding: string | null
  preferredRoomId: string | null
  backToBackWith: string | null
  preferredBackToBackWith: string[]
  coreqWith: string[]
}

export interface TimeSlot {
  days: DayPattern
  startTime: string
  endTime: string
}

export interface HistoricalAssignment {
  term: string
  runNumber: number
  courseId: string
  professorId: string
  roomId: string
  days: DayPattern
  startTime: string
  endTime: string
  buildingCode: string | null
}

export interface PlacementProfile {
  buildings: string[]
  floors: number[]
  roomTypes: Array<Room['roomType']>
  roomIds: string[]
  capacityMin: number | null
  capacityMax: number | null
}

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

export interface ScheduleConflict {
  courseId: string
  reason: string
  resolvedBy?: string
  resolvedAt?: Date
}

export interface NearHardFlag {
  courseId: string
  reason: string
  resolvedBy?: string
  resolvedAt?: Date
}

export interface ScheduleResult {
  term: string
  runNumber: number
  status: ScheduleStatus
  createdBy: string
  assignments: ScheduleAssignment[]
  conflicts: ScheduleConflict[]
}

export interface CollectedInputs {
  rooms: Room[]
  courses: Course[]
  professors: Professor[]
  workItems: CourseWorkItem[]
  conflicts: ScheduleConflict[]
  warnings: string[]
}

export interface CandidateSlot {
  room: Room
  slot: TimeSlot
  avoidsBackToBackSameCourse?: boolean
  preferredBackToBackMatchCount?: number
}

export interface ConstraintEvaluation {
  workItem: CourseWorkItem
  candidateRooms: Room[]
  candidateSlots: TimeSlot[]
  candidates: CandidateSlot[]
  conflict: ScheduleConflict | null
  selectedTier: string | null
  decisionLog: string[]
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
  }
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

/**
 * Raised when the scheduling run cannot start because the input data is not usable.
 */
export class SchedulingInputError extends Error {
  public readonly reasons: string[]

  constructor(reasons: string[]) {
    super(`Scheduling input validation failed: ${reasons.join('; ')}`)
    this.name = 'SchedulingInputError'
    this.reasons = reasons
  }
}
