export type DayPattern = 'MWF' | 'TR' | 'MW' | 'MTWF'

export type ScheduleStatus = 'draft' | 'under_review' | 'approved' | 'exported'

export type PreferenceStatus = 'empty' | 'draft' | 'submitted' | 'approved'

export interface Room {
  _id: string
  buildingCode: string
  roomNumber: string
  displayName: string | null
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
  title: string
  expectedEnrollment: number | null
  maxCapacity: number | null
  creditHours: number
  preferredDays: DayPattern[]
  preferredTimes: string[]
  avoidTimes: string[]
  requiredEquipment: string[]
  preferredBuilding: string | null
  preferredRoomId: string | null
  backToBackWith: string | null
  coreqWith: string[]
}

export interface PreferenceSubmission {
  term: string
  department: string
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
  professorId: string
  professorName: string
  departmentCode: string
  submittedAt: Date | null
  status: PreferenceStatus
  term: string
}

export interface CourseWorkItem {
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
  overrideBy?: string
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
}

export interface ConstraintEvaluation {
  workItem: CourseWorkItem
  candidateRooms: Room[]
  candidateSlots: TimeSlot[]
  candidates: CandidateSlot[]
  conflict: ScheduleConflict | null
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
