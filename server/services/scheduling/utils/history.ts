import type { Course, HistoricalAssignment, PlacementProfile, Room } from '../types'
import { schedulingConfig } from '../config'

function parseCourseLevel(courseNumber: string): number | null {
  const match = String(courseNumber).match(/\d+/)
  if (!match) {
    return null
  }

  const numeric = Number(match[0])
  if (!Number.isFinite(numeric)) {
    return null
  }

  return Math.floor(numeric / 100)
}

function parseFloor(roomNumber: string | null | undefined): number | null {
  if (!roomNumber) {
    return null
  }

  const match = String(roomNumber).match(/\d/)
  if (!match) {
    return null
  }

  return Number(match[0])
}

function normalizeDeptCode(value: string): string {
  return value.trim().toUpperCase()
}

function normalizeRoomDisplayName(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function roomMatchesPreference(room: Room, preferredRoomId: string | null, preferredBuilding: string | null): boolean {
  if (preferredRoomId !== null && preferredRoomId === room._id) {
    return true
  }

  return preferredBuilding !== null && preferredBuilding === room.buildingCode
}

export function areDepartmentsSimilar(left: string, right: string): boolean {
  const normalizedLeft = normalizeDeptCode(left)
  const normalizedRight = normalizeDeptCode(right)

  if (normalizedLeft === normalizedRight) {
    return true
  }

  const similarLeft = schedulingConfig.similarDepartments[normalizedLeft] ?? []
  if (similarLeft.includes(normalizedRight)) {
    return true
  }

  const similarRight = schedulingConfig.similarDepartments[normalizedRight] ?? []
  return similarRight.includes(normalizedLeft)
}

export function isSimilarCourse(
  baseCourse: Course,
  baseEnrollment: number | null,
  candidate: Course,
): boolean {
  const baseDept = normalizeDeptCode(baseCourse.deptCode)
  const candidateDept = normalizeDeptCode(candidate.deptCode)

  if (baseCourse.labComponent || candidate.labComponent) {
    return baseCourse.labComponent === candidate.labComponent && baseDept === candidateDept
  }

  if (!areDepartmentsSimilar(baseDept, candidateDept)) {
    return false
  }

  const baseLevel = parseCourseLevel(baseCourse.courseNumber)
  const candidateLevel = parseCourseLevel(candidate.courseNumber)
  if (baseLevel === null || candidateLevel === null || baseLevel !== candidateLevel) {
    return false
  }

  if (baseEnrollment === null || candidate.typicalEnrollment === null) {
    return false
  }

  const maxDelta = Math.max(
    schedulingConfig.similarity.enrollmentDeltaAbsolute,
    Math.ceil(baseEnrollment * schedulingConfig.similarity.enrollmentDeltaPercent),
  )

  return Math.abs(baseEnrollment - candidate.typicalEnrollment) <= maxDelta
}

export function buildPlacementProfile(
  assignments: HistoricalAssignment[],
  roomsById: Map<string, Room>,
): PlacementProfile {
  const buildings = new Set<string>()
  const floors = new Set<number>()
  const roomTypes = new Set<Room['roomType']>()
  const roomIds = new Set<string>()
  let capacityMin: number | null = null
  let capacityMax: number | null = null

  for (const assignment of assignments) {
    if (assignment.buildingCode) {
      buildings.add(assignment.buildingCode)
    }

    roomIds.add(assignment.roomId)

    const room = roomsById.get(assignment.roomId)
    if (!room) {
      continue
    }

    roomTypes.add(room.roomType)

    const floor = parseFloor(room.roomNumber)
    if (floor !== null) {
      floors.add(floor)
    }

    capacityMin = capacityMin === null ? room.capacity : Math.min(capacityMin, room.capacity)
    capacityMax = capacityMax === null ? room.capacity : Math.max(capacityMax, room.capacity)
  }

  return {
    buildings: [...buildings],
    floors: [...floors],
    roomTypes: [...roomTypes],
    roomIds: [...roomIds],
    capacityMin,
    capacityMax,
  }
}

export function roomRequiresRealData(room: Room): boolean {
  const roomDisplayName = normalizeRoomDisplayName(room.displayName)
  if (roomDisplayName === null) {
    return false
  }

  return schedulingConfig.guardedRoomDisplayNamesRequiringRealData.some(
    (configuredName) => normalizeRoomDisplayName(configuredName) === roomDisplayName,
  )
}

export function hasRealDataForRoom(
  room: Room,
  input: {
    historicalAssignments: HistoricalAssignment[]
    preferredRoomId: string | null
    preferredBuilding: string | null
    historicalPreferredRoomIds?: string[]
    historicalPreferredBuildings?: string[]
  },
): boolean {
  if (!roomRequiresRealData(room)) {
    return true
  }

  if (roomMatchesPreference(room, input.preferredRoomId, input.preferredBuilding)) {
    return true
  }

  if (input.historicalAssignments.some((assignment) => assignment.roomId === room._id || assignment.buildingCode === room.buildingCode)) {
    return true
  }

  if ((input.historicalPreferredRoomIds ?? []).includes(room._id)) {
    return true
  }

  return (input.historicalPreferredBuildings ?? []).includes(room.buildingCode)
}

export function isPlacementAbnormal(room: Room, profile: PlacementProfile): { abnormal: boolean; reasons: string[] } {
  const reasons: string[] = []

  if (profile.buildings.length > 0 && !profile.buildings.includes(room.buildingCode)) {
    reasons.push(`building ${room.buildingCode} not in historical set (${profile.buildings.join(', ')})`)
  }

  const floor = parseFloor(room.roomNumber)
  if (floor !== null && profile.floors.length > 0 && !profile.floors.includes(floor)) {
    reasons.push(`floor ${floor} not in historical set (${profile.floors.join(', ')})`)
  }

  if (profile.roomTypes.length > 0 && !profile.roomTypes.includes(room.roomType)) {
    reasons.push(`room type ${room.roomType} not in historical set (${profile.roomTypes.join(', ')})`)
  }

  if (profile.capacityMin !== null && profile.capacityMax !== null) {
    if (room.capacity < profile.capacityMin || room.capacity > profile.capacityMax) {
      reasons.push(`capacity ${room.capacity} outside historical range ${profile.capacityMin}-${profile.capacityMax}`)
    }
  }

  return {
    abnormal: reasons.length > 0,
    reasons,
  }
}
