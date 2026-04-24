import { createError, defineEventHandler, readBody } from 'h3'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
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
import { runSchedulingAlgorithm } from '../../services/scheduling'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const TEST_TERM = 'TESTTERM'
const DEFAULT_SAMPLE_SIZE = 350

interface Payload {
  sampleSize?: number
  outputFilePath?: string
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

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive)
}

function sampleCourses(courses: ICourse[], count: number): ICourse[] {
  const shuffled = [...courses]

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1)
    const temp = shuffled[i]
    shuffled[i] = shuffled[j]!
    shuffled[j] = temp!
  }

  return shuffled.slice(0, Math.min(count, shuffled.length))
}

function randomDayPattern(course: ICourse): DayPattern[] {
  if (isDayPattern(course.typicalDays ?? null)) {
    return [course.typicalDays as DayPattern]
  }

  const options: DayPattern[] = ['MWF', 'TR', 'MW', 'MTWF', 'MWRF', 'W', 'T', 'R']
  return [options[randomInt(options.length)]!]
}

function randomStartTime(course: ICourse): string[] {
  const typicalTime = String(course.typicalTime ?? '').trim()
  if (TIME_PATTERN.test(typicalTime)) {
    return [typicalTime]
  }

  const options = ['08:00', '09:30', '10:00', '11:00', '12:30', '13:00', '14:00', '15:30']
  return [options[randomInt(options.length)]!]
}

function resolveOutputPath(requestedPath: string | undefined): string {
  if (requestedPath && requestedPath.trim().length > 0) {
    return path.isAbsolute(requestedPath)
      ? requestedPath
      : path.resolve(process.cwd(), requestedPath)
  }

  const stamp = new Date().toISOString().replace(/[.:]/g, '-')
  return path.resolve(
    process.cwd(),
    'testterm-output',
    `testterm-run-${stamp}.json`,
  )
}

function chooseProfessorForCourse(
  course: ICourse,
  professorsByDept: Map<string, IProfessor[]>,
  allProfessors: IProfessor[],
): IProfessor | null {
  const sameDepartment = professorsByDept.get(course.deptCode) ?? []
  if (sameDepartment.length > 0) {
    return sameDepartment[randomInt(sameDepartment.length)] ?? null
  }

  if (allProfessors.length === 0) {
    return null
  }

  return allProfessors[randomInt(allProfessors.length)] ?? null
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

  const sampleSize = Math.max(1, Math.min(10000, Math.floor(body.sampleSize ?? DEFAULT_SAMPLE_SIZE)))
  const outputFilePath = resolveOutputPath(body.outputFilePath)

  const [courses, professorDocs, rooms] = await Promise.all([
    CourseCatalog.find({ active: true }).lean<ICourse[]>().exec(),
    Professor.find({ active: true }).exec(),
    Room.find({ available: true }).lean<IRoom[]>().exec(),
  ])

  if (courses.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No active courses found' })
  }

  if (professorDocs.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No active professors found' })
  }

  const professorDocsById = new Map<string, IProfessor>()
  const professorsByDept = new Map<string, IProfessor[]>()

  for (const professor of professorDocs) {
    const professorDoc = professor.toObject<IProfessor>()
    const professorId = String(professorDoc._id)
    professorDocsById.set(professorId, professorDoc)

    const departmentProfessors = professorsByDept.get(professorDoc.departmentCode) ?? []
    departmentProfessors.push(professorDoc)
    professorsByDept.set(professorDoc.departmentCode, departmentProfessors)
  }

  const selectedCourses = sampleCourses(courses, sampleSize)
  const now = new Date()

  const generatedByProfessor = new Map<string, {
    professorId: string
    displayName: string
    departmentCode: string
    courses: ICoursePreference[]
  }>()

  for (const course of selectedCourses) {
    const selectedProfessor = chooseProfessorForCourse(
      course,
      professorsByDept,
      [...professorDocsById.values()],
    )

    if (selectedProfessor === null || selectedProfessor._id === undefined) {
      continue
    }

    const professorId = String(selectedProfessor._id)
    const preferredBuilding = normalizeBuildingCode(selectedProfessor.officeBuilding)
    const preference = buildCoursePreference(course, rooms, preferredBuilding)
    preference.preferredDays = randomDayPattern(course)
    preference.preferredTimes = randomStartTime(course)

    const existing = generatedByProfessor.get(professorId)
    if (existing !== undefined) {
      existing.courses.push(preference)
      continue
    }

    generatedByProfessor.set(professorId, {
      professorId,
      displayName: selectedProfessor.displayName,
      departmentCode: selectedProfessor.departmentCode,
      courses: [preference],
    })
  }

  const generatedDump: Array<{
    professorId: string
    displayName: string
    departmentCode: string
    submission: {
      term: string
      department: string
      submittedBy: string
      submittedAt: Date | null
      status: 'submitted'
      courses: ICoursePreference[]
    }
  }> = []

  const professorUpdates: Array<Promise<unknown>> = []
  const updatedProfessors: string[] = []

  for (const generated of generatedByProfessor.values()) {
    const professorDoc = professorDocsById.get(generated.professorId)
    if (professorDoc === undefined) {
      continue
    }

    const generatedSubmission = {
      term: TEST_TERM,
      department: professorDoc.departmentCode,
      submittedBy: generated.professorId,
      submittedAt: now,
      status: 'submitted' as const,
      courses: generated.courses,
    }

    generatedDump.push({
      professorId: generated.professorId,
      displayName: generated.displayName,
      departmentCode: generated.departmentCode,
      submission: generatedSubmission,
    })

    updatedProfessors.push(generated.professorId)

    professorUpdates.push(
      Professor.updateOne(
        { _id: generated.professorId },
        {
          $pull: { preferences: { term: TEST_TERM } },
        },
      ).exec(),
    )

    professorUpdates.push(
      Professor.updateOne(
        { _id: generated.professorId },
        {
          $push: { preferences: generatedSubmission },
        },
      ).exec(),
    )
  }

  await Promise.all(professorUpdates)

  const schedule = await runSchedulingAlgorithm(TEST_TERM, auth.userId.toLowerCase())

  const dumpPayload = {
    generatedAt: now.toISOString(),
    term: TEST_TERM,
    selectedCourseCount: selectedCourses.length,
    requestedSampleSize: sampleSize,
    selectedCourseIds: selectedCourses.map((course) => String(course._id ?? '')),
    updatedProfessorCount: updatedProfessors.length,
    generatedPreferences: generatedDump,
    schedule,
  }

  const outputDirectory = path.dirname(outputFilePath)
  await mkdir(outputDirectory, { recursive: true })
  await writeFile(outputFilePath, JSON.stringify(dumpPayload, null, 2), 'utf8')

  return {
    ok: true,
    term: TEST_TERM,
    selectedCourseCount: selectedCourses.length,
    requestedSampleSize: sampleSize,
    updatedProfessorCount: updatedProfessors.length,
    createdSubmissions: generatedDump.length,
    replacedEmptySubmissions: generatedDump.length,
    outputFilePath,
    schedule,
  }
})
