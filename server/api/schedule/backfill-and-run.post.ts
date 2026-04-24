import { createError, defineEventHandler, readBody } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import {
  CourseCatalog,
  Professor,
  Room,
  type DayPattern,
  type ICourse,
  type ICoursePreference,
  type IProfessor,
  type IRoom,
} from '../../models/index'
import { runSchedulingAlgorithm, runSchedulingPlan } from '../../services/scheduling'

const TERM_PATTERN = /^[A-Za-z0-9_-]{1,32}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

interface Payload {
  term: string
  status?: 'empty' | 'draft' | 'submitted' | 'approved'
  overwriteEmpty?: boolean
  dryRun?: boolean
  dumpOnly?: boolean
  includeSchedulePlan?: boolean
}

function normalizeTerm(term: unknown): string {
  const normalized = String(term ?? '').trim()
  if (!normalized) {
    throw createError({ statusCode: 400, statusMessage: 'term is required' })
  }
  if (!TERM_PATTERN.test(normalized)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid term format' })
  }

  return normalized
}

function isDayPattern(value: string | null | undefined): value is DayPattern {
  return value === 'MWF' || value === 'TR' || value === 'MW' || value === 'MTWF' || value === 'MWRF' || value === 'W' || value === 'T' || value === 'R'
}

function normalizeBuildingCode(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) {
    return null
  }

  return trimmed.toUpperCase()
}

function pickPreferredRoomId(
  rooms: IRoom[],
  expectedEnrollment: number,
  preferredBuilding: string | null,
  requiredEquipment: string[],
): string | null {
  const equip = new Set(requiredEquipment.map((item) => item.trim().toLowerCase()).filter(Boolean))

  const candidates = rooms
    .filter((room) => room.available)
    .filter((room) => room.capacity >= expectedEnrollment)
    .filter((room) => {
      if (preferredBuilding === null) {
        return true
      }

      const abbreviation = String(room.abbreviation ?? '').trim().toUpperCase()
      return abbreviation.startsWith(`${preferredBuilding} `) || abbreviation === preferredBuilding
    })
    .filter((room) => {
      if (equip.size === 0) {
        return true
      }

      return [...equip].every((name) => {
        const key = name as keyof IRoom['equipment']
        return Boolean(room.equipment?.[key])
      })
    })
    .sort((a, b) => a.capacity - b.capacity)

  return candidates[0]?._id ?? null
}

function buildCoursePreference(
  course: ICourse,
  rooms: IRoom[],
  preferredBuilding: string | null,
): ICoursePreference {
  const expectedEnrollmentRaw = course.typicalEnrollment ?? 25
  const expectedEnrollment = Math.max(1, Math.round(expectedEnrollmentRaw))
  const requiredEquipment = [...(course.requiredEquipment ?? [])]

  return {
    courseId: String(course._id ?? '').trim(),
    title: String(course.title ?? '').trim(),
    expectedEnrollment,
    maxCapacity: null,
    creditHours: Math.min(4, Math.max(0, Math.round(course.creditHours ?? 3))),
    preferredDays: isDayPattern(course.typicalDays ?? null) ? [course.typicalDays as DayPattern] : [],
    preferredTimes: TIME_PATTERN.test(String(course.typicalTime ?? '').trim()) ? [String(course.typicalTime).trim()] : [],
    avoidTimes: [],
    requiredEquipment,
    preferredBuilding,
    preferredRoomId: pickPreferredRoomId(rooms, expectedEnrollment, preferredBuilding, requiredEquipment),
    backToBackWith: null,
    coreqWith: [...(course.corequisites ?? [])],
  }
}

function normalizeIdentifier(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

function professorMatchesTypical(professor: IProfessor, course: ICourse): boolean {
  const typical = normalizeIdentifier(course.typicalProfessor)

  if (!typical) {
    return false
  }

  return (
    normalizeIdentifier(professor._id) === typical ||
    normalizeIdentifier(professor.covenantId) === typical ||
    normalizeIdentifier(professor.displayName) === typical
  )
}

function assignCoursesToProfessors(
  courses: ICourse[],
  professors: IProfessor[],
): Map<string, ICourse[]> {
  const assignments = new Map<string, ICourse[]>()
  const loadByProfessor = new Map<string, number>()

  for (const professor of professors) {
    const professorId = String(professor._id)
    assignments.set(professorId, [])
    loadByProfessor.set(professorId, 0)
  }

  for (const course of courses) {
    const departmentProfessors = professors.filter(
      (professor) => professor.departmentCode === course.deptCode,
    )

    if (departmentProfessors.length === 0) {
      continue
    }

    const preferredProfessor = departmentProfessors.find((professor) =>
      professorMatchesTypical(professor, course),
    )

    const targetProfessor =
      preferredProfessor ??
      [...departmentProfessors].sort((a, b) => {
        const aLoad = loadByProfessor.get(String(a._id)) ?? 0
        const bLoad = loadByProfessor.get(String(b._id)) ?? 0
        return aLoad - bLoad
      })[0]

    if (targetProfessor === undefined) {
      continue
    }

    const targetProfessorId = String(targetProfessor._id)
    const current = assignments.get(targetProfessorId) ?? []
    current.push(course)
    assignments.set(targetProfessorId, current)
    loadByProfessor.set(targetProfessorId, (loadByProfessor.get(targetProfessorId) ?? 0) + 1)
  }

  return assignments
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin'])
  await connectDB()

  let body: Payload
  try {
    body = (await readBody<Payload>(event)) ?? ({ term: '' } as Payload)
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing or invalid JSON body',
    })
  }

  const term = normalizeTerm(body.term)
  const targetStatus = body.status ?? 'submitted'
  const overwriteEmpty = body.overwriteEmpty ?? true
  const dryRun = body.dryRun ?? false
  const dumpOnly = body.dumpOnly ?? false
  const includeSchedulePlan = body.includeSchedulePlan ?? false

  const [courses, professors, rooms] = await Promise.all([
    CourseCatalog.find({ active: true }).lean<ICourse[]>().exec(),
    Professor.find({ active: true }).exec(),
    Room.find({ available: true }).lean<IRoom[]>().exec(),
  ])

  const professorDocsById = new Map<string, IProfessor>()
  for (const professor of professors) {
    const professorDoc = professor.toObject<IProfessor>()
    professorDocsById.set(String(professor._id), professorDoc)
  }

  const assignedCoursesByProfessor = assignCoursesToProfessors(
    courses,
    [...professorDocsById.values()],
  )

  const updatedProfessors: string[] = []
  const generatedDump: Array<{
    professorId: string
    displayName: string
    departmentCode: string
    submission: {
      term: string
      department: string
      submittedBy: string
      submittedAt: Date | null
      status: 'empty' | 'draft' | 'submitted' | 'approved'
      courses: ICoursePreference[]
    }
  }> = []
  let createdSubmissions = 0
  let replacedEmptySubmissions = 0

  for (const professor of professors) {
    const professorId = String(professor._id)
    const professorDoc = professorDocsById.get(professorId)
    if (professorDoc === undefined) {
      continue
    }

    const preferredBuilding = normalizeBuildingCode(professorDoc.officeBuilding)
    const assignedCourses = assignedCoursesByProfessor.get(professorId) ?? []
    const professorCourses = assignedCourses.map((course) =>
      buildCoursePreference(course, rooms, preferredBuilding),
    )

    if (professorCourses.length === 0) {
      continue
    }

    const existingIndex = professor.preferences.findIndex(
      (submission) => submission.term === term,
    )

    const generatedSubmission = {
      term,
      department: professor.departmentCode,
      submittedBy: String(professor._id),
      submittedAt:
        targetStatus === 'submitted' || targetStatus === 'approved'
          ? new Date()
          : null,
      status: targetStatus,
      courses: professorCourses,
    }

    generatedDump.push({
      professorId,
      displayName: professorDoc.displayName,
      departmentCode: professorDoc.departmentCode,
      submission: generatedSubmission,
    })

    let needsSave = false

    if (existingIndex === -1) {
      professor.preferences.push(generatedSubmission)
      createdSubmissions += 1
      needsSave = true
    } else if (overwriteEmpty) {
      const existing = professor.preferences[existingIndex]
      const existingIsEmpty = existing !== undefined && (
        existing.status === 'empty' ||
        (Array.isArray(existing.courses) && existing.courses.length === 0)
      )

      if (existingIsEmpty) {
        professor.preferences[existingIndex] = generatedSubmission
        replacedEmptySubmissions += 1
        needsSave = true
      }
    }

    if (needsSave) {
      updatedProfessors.push(String(professor._id))
      if (!dryRun) {
        await professor.save()
      }
    }
  }

  if (dryRun || dumpOnly) {
    const schedulePlan = includeSchedulePlan
      ? await runSchedulingPlan(term)
      : null

    return {
      ok: true,
      term,
      dryRun: true,
      dumpOnly,
      includeSchedulePlan,
      schedulePlanSource: includeSchedulePlan
        ? 'databaseCurrentState'
        : null,
      updatedProfessorCount: updatedProfessors.length,
      createdSubmissions,
      replacedEmptySubmissions,
      generatedPreferences: generatedDump,
      schedule: null,
      schedulePlan,
    }
  }

  const schedule = await runSchedulingAlgorithm(term, auth.userId.toLowerCase())

  return {
    ok: true,
    term,
    updatedProfessorCount: updatedProfessors.length,
    createdSubmissions,
    replacedEmptySubmissions,
    schedule,
  }
})
