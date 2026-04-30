import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const DEFAULT_MONGO_DB_NAME = 'COS417'

const DEFAULT_EQUIPMENT = {
  projector: false,
  smartboard: false,
  whiteboard: false,
  piano: false,
  labStations: false,
  computers: false,
  outlets: true,
}

function parseArgs(argv) {
  const flags = new Set(argv)
  const getValue = (name) => {
    const index = argv.indexOf(name)
    if (index < 0) return undefined
    return argv[index + 1]
  }

  return {
    minimal: flags.has('--minimal'),
    wipe: flags.has('--wipe'),
    inmemoryFile: getValue('--inmemory-file'),
  }
}

async function loadDotEnv() {
  const envPath = path.join(repoRoot, '.env')
  let envText = ''

  try {
    envText = await readFile(envPath, 'utf8')
  } catch {
    return
  }

  for (const rawLine of envText.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const equalIndex = line.indexOf('=')
    if (equalIndex <= 0) continue

    const key = line.slice(0, equalIndex).trim()
    if (!key || process.env[key] !== undefined) continue

    let value = line.slice(equalIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

function getEnvDbName() {
  const candidates = [
    process.env.MONGO_DB_NAME,
    process.env.MONGODB_DB_NAME,
    process.env.MONGO_DB,
  ]

  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim()
    if (value) {
      return value
    }
  }

  return undefined
}

function requireMongoConfig() {
  const uri = String(process.env.MONGO_URI ?? '').trim()
  if (!uri) {
    throw new Error(
      'MONGO_URI is required. Set it in environment or .env file.',
    )
  }

  let parsed
  try {
    parsed = new URL(uri)
  } catch {
    throw new Error('MONGO_URI must be a valid MongoDB connection string')
  }

  if (parsed.protocol !== 'mongodb:' && parsed.protocol !== 'mongodb+srv:') {
    throw new Error(
      'MONGO_URI must use the "mongodb://" or "mongodb+srv://" protocol.',
    )
  }
  const dbNameFromUri = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
  const dbNameFromEnv = getEnvDbName()

  const dbName = dbNameFromUri || dbNameFromEnv || DEFAULT_MONGO_DB_NAME

  return {
    uri,
    dbName,
  }
}

function normalizeRoom(input) {
  const roomNumber = String(input.roomNumber ?? '').trim()
  const rawCode = String(input.buildingCode ?? '')
    .trim()
    .toUpperCase()
  const abbrev = String(input.abbreviation ?? '')
    .trim()
    .toUpperCase()
  const buildingCodeFromAbbrev = abbrev.split(/\s+/)[0] || ''
  const buildingCode = rawCode || buildingCodeFromAbbrev
  const buildingName = String(
    input.buildingName ?? input.buildingCode ?? buildingCode,
  ).trim()
  const roomAbbreviation = abbrev || `${buildingCode} ${roomNumber}`.trim()

  const equipment = {
    ...DEFAULT_EQUIPMENT,
    ...(input.equipment ?? {}),
  }

  return {
    _id: roomAbbreviation,
    buildingName,
    roomNumber,
    displayName:
      input.displayName === null
        ? `${buildingName} ${roomNumber}`.trim()
        : String(input.displayName ?? `${buildingName} ${roomNumber}`).trim(),
    capacity: Number.isInteger(input.capacity) ? input.capacity : 1,
    roomType: input.roomType === 'lab' ? 'lab' : 'classroom',
    available: input.available ?? true,
    equipment,
    abbreviation: roomAbbreviation,
  }
}

function normalizeCourse(input) {
  const deptCode = String(input.deptCode ?? '')
    .trim()
    .toUpperCase()
  const courseNumber = String(input.courseNumber ?? '').trim()

  return {
    _id: `${deptCode} ${courseNumber}`.trim(),
    deptCode,
    courseNumber,
    title: String(input.title ?? '').trim(),
    creditHours: Number(input.creditHours ?? 0),
    typicalEnrollment:
      input.typicalEnrollment === null || input.typicalEnrollment === undefined
        ? null
        : Number(input.typicalEnrollment),
    requiredEquipment: Array.isArray(input.requiredEquipment)
      ? input.requiredEquipment.map((value) => String(value))
      : [],
    labComponent: Boolean(input.labComponent),
    active: input.active ?? true,
    typicalProfessor:
      input.typicalProfessor === null || input.typicalProfessor === undefined
        ? null
        : String(input.typicalProfessor),
    typicalDays:
      input.typicalDays === null || input.typicalDays === undefined
        ? null
        : String(input.typicalDays),
    typicalTime:
      input.typicalTime === null || input.typicalTime === undefined
        ? null
        : String(input.typicalTime),
    prerequisites: Array.isArray(input.prerequisites)
      ? input.prerequisites.map((value) => String(value))
      : [],
    corequisites: Array.isArray(input.corequisites)
      ? input.corequisites.map((value) => String(value))
      : [],
  }
}

function normalizePreferenceSubmission(input, professorId, departmentCode) {
  const status = input.status ?? 'submitted'
  const submitted = status === 'submitted' || status === 'approved'

  return {
    term: String(input.term ?? '').trim(),
    department: String(input.department ?? departmentCode ?? '')
      .trim()
      .toUpperCase(),
    submittedBy: String(input.submittedBy ?? professorId).trim(),
    submittedAt: submitted ? new Date(input.submittedAt ?? new Date()) : null,
    status,
    courses: Array.isArray(input.courses)
      ? input.courses.map((course) => ({
          courseId: String(course.courseId ?? '').trim(),
          title: String(course.title ?? '').trim(),
          expectedEnrollment: Number(course.expectedEnrollment ?? 0),
          maxCapacity:
            course.maxCapacity === null || course.maxCapacity === undefined
              ? null
              : Number(course.maxCapacity),
          creditHours: Number(course.creditHours ?? 0),
          preferredDays: Array.isArray(course.preferredDays)
            ? course.preferredDays.map((value) => String(value))
            : [],
          preferredTimes: Array.isArray(course.preferredTimes)
            ? course.preferredTimes.map((value) => String(value))
            : [],
          avoidTimes: Array.isArray(course.avoidTimes)
            ? course.avoidTimes.map((value) => String(value))
            : [],
          requiredEquipment: Array.isArray(course.requiredEquipment)
            ? course.requiredEquipment.map((value) => String(value))
            : [],
          preferredBuilding:
            course.preferredBuilding === null ||
            course.preferredBuilding === undefined
              ? null
              : String(course.preferredBuilding),
          preferredRoomId:
            course.preferredRoomId === null ||
            course.preferredRoomId === undefined
              ? null
              : String(course.preferredRoomId),
          backToBackWith:
            course.backToBackWith === null ||
            course.backToBackWith === undefined
              ? null
              : String(course.backToBackWith),
          coreqWith: Array.isArray(course.coreqWith)
            ? course.coreqWith.map((value) => String(value))
            : [],
        }))
      : [],
  }
}

function normalizeProfessor(input) {
  const covenantId = String(input.covenantId ?? '')
    .trim()
    .toLowerCase()

  return {
    _id: covenantId,
    covenantId,
    displayName: String(input.displayName ?? '').trim(),
    department: String(input.department ?? input.departmentCode ?? '')
      .trim()
      .toUpperCase(),
    departmentCode: String(input.departmentCode ?? '')
      .trim()
      .toUpperCase(),
    officeBuilding:
      input.officeBuilding === null || input.officeBuilding === undefined
        ? null
        : String(input.officeBuilding).trim(),
    officeRoom:
      input.officeRoom === null || input.officeRoom === undefined
        ? null
        : String(input.officeRoom).trim(),
    seniorityYear:
      input.seniorityYear === null || input.seniorityYear === undefined
        ? null
        : Number(input.seniorityYear),
    active: input.active ?? true,
    preferences: Array.isArray(input.preferences)
      ? input.preferences.map((submission) =>
          normalizePreferenceSubmission(
            submission,
            covenantId,
            String(input.departmentCode ?? ''),
          ),
        )
      : [],
  }
}

function normalizeSchedule(input) {
  const term = String(input.term ?? '').trim()
  const runNumber = Number(input.runNumber ?? 1)

  return {
    _id: `${term}-${runNumber}`,
    term,
    runNumber,
    status: String(input.status ?? 'draft'),
    createdBy: String(input.createdBy ?? 'seed'),
    assignments: Array.isArray(input.assignments)
      ? input.assignments.map((assignment) => ({
          courseId: String(assignment.courseId ?? '').trim(),
          professorId: String(assignment.professorId ?? '')
            .trim()
            .toLowerCase(),
          roomId: String(assignment.roomId ?? '')
            .trim()
            .toUpperCase(),
          days: String(assignment.days ?? 'MWF'),
          startTime: String(assignment.startTime ?? ''),
          endTime: String(assignment.endTime ?? ''),
          overrideBy:
            assignment.overrideBy === null ||
            assignment.overrideBy === undefined
              ? null
              : String(assignment.overrideBy),
        }))
      : [],
    conflicts: Array.isArray(input.conflicts)
      ? input.conflicts.map((conflict) => ({
          courseId: String(conflict.courseId ?? '').trim(),
          reason: String(conflict.reason ?? '').trim(),
          resolvedBy:
            conflict.resolvedBy === null || conflict.resolvedBy === undefined
              ? null
              : String(conflict.resolvedBy),
          resolvedAt:
            conflict.resolvedAt === null || conflict.resolvedAt === undefined
              ? null
              : new Date(conflict.resolvedAt),
        }))
      : [],
  }
}

function normalizeAuditLog(input) {
  return {
    _id: new mongoose.Types.ObjectId().toString(),
    userId:
      input.userId === null || input.userId === undefined
        ? null
        : String(input.userId).trim(),
    covenantId:
      input.covenantId === null || input.covenantId === undefined
        ? null
        : String(input.covenantId).trim().toLowerCase(),
    action: String(input.action ?? 'SEED_EVENT').trim(),
    collection:
      input.collection === null || input.collection === undefined
        ? null
        : String(input.collection).trim(),
    documentId:
      input.documentId === null || input.documentId === undefined
        ? null
        : String(input.documentId).trim(),
    detail: String(input.detail ?? 'Seed/migration log').trim(),
    ipAddress:
      input.ipAddress === null || input.ipAddress === undefined
        ? null
        : String(input.ipAddress).trim(),
    timestamp:
      input.timestamp === null || input.timestamp === undefined
        ? new Date()
        : new Date(input.timestamp),
  }
}

const MINIMAL_DATASET = {
  rooms: [
    {
      buildingName: 'Science North',
      roomNumber: '201',
      displayName: 'Science North 201',
      capacity: 28,
      roomType: 'classroom',
      available: true,
      equipment: {
        ...DEFAULT_EQUIPMENT,
        projector: true,
        whiteboard: true,
      },
      abbreviation: 'SN 201',
    },
    {
      buildingName: 'Brock Hall',
      roomNumber: '118',
      displayName: 'Brock Hall 118',
      capacity: 32,
      roomType: 'classroom',
      available: true,
      equipment: {
        ...DEFAULT_EQUIPMENT,
        projector: true,
        smartboard: true,
      },
      abbreviation: 'BH 118',
    },
  ],
  courses: [
    {
      deptCode: 'COS',
      courseNumber: '217',
      title: 'Data Structures',
      creditHours: 3,
      typicalEnrollment: 24,
      requiredEquipment: [],
      labComponent: false,
      active: true,
      typicalProfessor: 'Jeff Humphries',
      typicalDays: 'MWF',
      typicalTime: '10:00',
      prerequisites: ['COS 121'],
      corequisites: [],
    },
    {
      deptCode: 'COS',
      courseNumber: '243',
      title: 'Database Systems',
      creditHours: 3,
      typicalEnrollment: 20,
      requiredEquipment: ['projector'],
      labComponent: false,
      active: true,
      typicalProfessor: 'Zeyu Zhou',
      typicalDays: 'TR',
      typicalTime: '09:30',
      prerequisites: ['COS 121'],
      corequisites: [],
    },
  ],
  professors: [
    {
      covenantId: 'jeff.humphries',
      displayName: 'Jeff Humphries',
      departmentCode: 'COS',
      officeBuilding: 'MH',
      officeRoom: '142',
      seniorityYear: 2012,
      active: true,
      preferences: [
        {
          term: 'Fall2026',
          department: 'COS',
          submittedBy: 'jeff.humphries',
          status: 'submitted',
          courses: [
            {
              courseId: 'COS 217',
              title: 'Data Structures',
              expectedEnrollment: 24,
              maxCapacity: 30,
              creditHours: 3,
              preferredDays: ['MWF'],
              preferredTimes: ['10:00'],
              avoidTimes: ['08:00'],
              requiredEquipment: [],
              preferredBuilding: 'SN',
              preferredRoomId: 'SN 201',
              backToBackWith: null,
              coreqWith: [],
            },
          ],
        },
      ],
    },
    {
      covenantId: 'zeyu.zhou',
      displayName: 'Zeyu Zhou',
      departmentCode: 'COS',
      officeBuilding: 'MH',
      officeRoom: '373',
      seniorityYear: 2025,
      active: true,
      preferences: [
        {
          term: 'Fall2026',
          department: 'COS',
          submittedBy: 'zeyu.zhou',
          status: 'submitted',
          courses: [
            {
              courseId: 'COS 243',
              title: 'Database Systems',
              expectedEnrollment: 20,
              maxCapacity: 25,
              creditHours: 3,
              preferredDays: ['TR'],
              preferredTimes: ['09:30'],
              avoidTimes: [],
              requiredEquipment: ['projector'],
              preferredBuilding: 'BH',
              preferredRoomId: 'BH 118',
              backToBackWith: null,
              coreqWith: [],
            },
          ],
        },
      ],
    },
  ],
}

async function loadInMemoryDataset(filePathArg) {
  const fullPath = path.isAbsolute(filePathArg)
    ? filePathArg
    : path.join(repoRoot, filePathArg)
  const raw = JSON.parse(await readFile(fullPath, 'utf8'))

  return {
    rooms: Array.isArray(raw.rooms) ? raw.rooms : [],
    courses: Array.isArray(raw.courses) ? raw.courses : [],
    professors: Array.isArray(raw.professors) ? raw.professors : [],
    schedules: Array.isArray(raw.schedules) ? raw.schedules : [],
    auditLogs: Array.isArray(raw.auditLogs) ? raw.auditLogs : [],
  }
}

function normalizeDataset(dataset) {
  return {
    rooms: dataset.rooms.map(normalizeRoom),
    courses: dataset.courses.map(normalizeCourse),
    professors: dataset.professors.map(normalizeProfessor),
    schedules: (dataset.schedules ?? []).map(normalizeSchedule),
    auditLogs: (dataset.auditLogs ?? []).map(normalizeAuditLog),
  }
}

async function resetCollections(db, normalized) {
  const promises = []

  if (normalized.rooms.length > 0)
    promises.push(db.collection('rooms').deleteMany({}))
  if (normalized.courses.length > 0)
    promises.push(db.collection('courseCatalog').deleteMany({}))
  if (normalized.professors.length > 0)
    promises.push(db.collection('professors').deleteMany({}))
  if (normalized.schedules.length > 0)
    promises.push(db.collection('schedules').deleteMany({}))
  if (normalized.auditLogs.length > 0)
    promises.push(db.collection('auditLogs').deleteMany({}))

  await Promise.all(promises)
}

async function upsertById(collection, docs) {
  if (docs.length === 0) return

  await collection.bulkWrite(
    docs.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: doc },
        upsert: true,
      },
    })),
    { ordered: false },
  )
}

async function run() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.minimal && !args.inmemoryFile) {
    throw new Error('Provide one mode: --minimal or --inmemory-file <path>')
  }

  await loadDotEnv()
  const { uri: mongoUri, dbName } = requireMongoConfig()

  let dataset
  if (args.minimal) {
    dataset = {
      rooms: MINIMAL_DATASET.rooms,
      courses: MINIMAL_DATASET.courses,
      professors: MINIMAL_DATASET.professors,
      schedules: [],
      auditLogs: [],
    }
  } else {
    dataset = await loadInMemoryDataset(args.inmemoryFile)
  }

  const normalized = normalizeDataset(dataset)

  await mongoose.connect(mongoUri, { dbName })
  const db = mongoose.connection.db

  if (args.wipe) {
    await resetCollections(db, normalized)
  }

  await Promise.all([
    upsertById(db.collection('rooms'), normalized.rooms),
    upsertById(db.collection('courseCatalog'), normalized.courses),
    upsertById(db.collection('professors'), normalized.professors),
    upsertById(db.collection('schedules'), normalized.schedules),
    upsertById(db.collection('auditLogs'), normalized.auditLogs),
  ])

  await mongoose.disconnect()

  console.log('Seed complete')
  console.log(`rooms: ${normalized.rooms.length}`)
  console.log(`courses: ${normalized.courses.length}`)
  console.log(`professors: ${normalized.professors.length}`)
  console.log(`schedules: ${normalized.schedules.length}`)
  console.log(`auditLogs: ${normalized.auditLogs.length}`)
}

run().catch(async (error) => {
  console.error(error)
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
  process.exit(1)
})
