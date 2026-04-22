#!/usr/bin/env node

/**
 * Comprehensive API Test Suite
 * Tests all endpoints with realistic payloads and reverts MongoDB changes after testing
 */

import mongoose from 'mongoose'
import { fileURLToPath } from 'url'
import path from 'path'
import * as fs from 'fs'
import http from 'http'
import https from 'https'
import { URL } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

// Load environment from .env file
function loadEnv() {
  const envPath = path.join(repoRoot, '.env')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8')
    content.split('\n').forEach((line) => {
      const [key, value] = line.split('=')
      if (key && value) {
        process.env[key.trim()] = value.trim()
      }
    })
  }
}

loadEnv()

// ============================================================================
// CONFIGURATION & STATE
// ============================================================================

const BASE_URL = 'http://localhost:3000'
const TEST_ADMIN_TOKEN = 'test-admin-token'
const TEST_FACULTY_TOKEN = 'test-faculty-token'
const TEST_TERM = 'SPRING-2025'
const TEST_DEPARTMENT = 'CS'

let testResults = {
  passed: 0,
  failed: 0,
  tests: [],
}

const backupData = {
  professors: [],
  courses: [],
  rooms: [],
  schedules: [],
  preferences: [],
  auditLogs: [],
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function log(level, message, data = null) {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level}]`

  if (data) {
    console.log(`${prefix} ${message}`, data)
  } else {
    console.log(`${prefix} ${message}`)
  }
}

function logSection(title) {
  console.log('\n' + '='.repeat(80))
  console.log(`║ ${title.padEnd(76)} ║`)
  console.log('='.repeat(80))
}

function logTest(testName, status, details = '') {
  const icon = status === 'PASS' ? '✓' : '✗'
  const color = status === 'PASS' ? '\x1b[32m' : '\x1b[31m'
  const reset = '\x1b[0m'

  console.log(`${color}${icon}${reset} ${testName}`)
  if (details) {
    console.log(`  └─ ${details}`)
  }

  testResults.tests.push({ testName, status, details })
  if (status === 'PASS') {
    testResults.passed++
  } else {
    testResults.failed++
  }
}

async function apiCall(method, endpoint, body = null, token = TEST_ADMIN_TOKEN) {
  const urlStr = `${BASE_URL}/api${endpoint}`
  const url = new URL(urlStr)
  
  const requestModule = url.protocol === 'https:' ? https : http
  
  return new Promise((resolve) => {
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }

    const req = requestModule.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        let parsedData
        try {
          parsedData = data ? JSON.parse(data) : null
        } catch {
          parsedData = data
        }

        resolve({
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          data: parsedData,
          headers: res.headers,
        })
      })
    })

    req.on('error', (error) => {
      resolve({
        status: 0,
        ok: false,
        error: error.message,
        data: null,
      })
    })

    if (body) {
      req.write(JSON.stringify(body))
    }

    req.end()
  })
}

// ============================================================================
// DATABASE FUNCTIONS
// ============================================================================

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI || '')
    log('INFO', '✓ Connected to MongoDB')
    return true
  } catch (error) {
    log('ERROR', '✗ Failed to connect to MongoDB:', error.message)
    process.exit(1)
  }
}

async function backupDatabase() {
  logSection('BACKING UP DATABASE')

  try {
    const db = mongoose.connection.db

    // Get all collections
    const collections = await db.listCollections().toArray()
    log('INFO', `Found ${collections.length} collections`)

    for (const { name } of collections) {
      const docs = await db.collection(name).find({}).toArray()
      backupData[name] = JSON.parse(JSON.stringify(docs))
      log('INFO', `Backed up ${name}: ${docs.length} documents`)
    }

    log('INFO', '✓ Database backup complete')
    return true
  } catch (error) {
    log('ERROR', '✗ Backup failed:', error.message)
    return false
  }
}

async function restoreDatabase() {
  logSection('RESTORING DATABASE')

  try {
    const db = mongoose.connection.db

    // Clear all collections
    const collections = await db.listCollections().toArray()
    for (const { name } of collections) {
      await db.collection(name).deleteMany({})
      log('INFO', `Cleared ${name}`)
    }

    // Restore from backup
    for (const [collectionName, docs] of Object.entries(backupData)) {
      if (docs && docs.length > 0) {
        await db.collection(collectionName).insertMany(docs)
        log('INFO', `Restored ${collectionName}: ${docs.length} documents`)
      }
    }

    log('INFO', '✓ Database restore complete')
    return true
  } catch (error) {
    log('ERROR', '✗ Restore failed:', error.message)
    return false
  }
}

// ============================================================================
// TEST DATA GENERATORS
// ============================================================================

function createTestProfessor(index = 1) {
  return {
    covenantId: `prof${index}`,
    displayName: `Professor Test ${index}`,
    departmentCode: TEST_DEPARTMENT,
    officeBuilding: `Building ${String.fromCharCode(65 + index)}`,
    officeRoom: `${100 + index}`,
    seniorityYear: 2020 + index,
    active: true,
  }
}

function createTestCourse(index = 1) {
  return {
    deptCode: TEST_DEPARTMENT,
    courseNumber: `${100 + index}`,
    title: `Test Course ${index}: Introduction to Testing`,
    creditHours: 3 + (index % 2),
    typicalEnrollment: 30 + index * 5,
    requiredEquipment: ['projector', 'whiteboard'],
    labComponent: index % 2 === 0,
    active: true,
  }
}

function createTestRoom(index = 1) {
  return {
    buildingName: `Building ${String.fromCharCode(65 + (index % 3))}`,
    roomNumber: `${200 + index}`,
    displayName: `Classroom ${index}`,
    capacity: 30 + index * 5,
    roomType: index % 3 === 0 ? 'lab' : 'classroom',
    available: true,
    equipment: {
      projector: index % 2 === 0,
      smartboard: index % 3 === 0,
      whiteboard: true,
      piano: false,
      labStations: index % 3 === 0,
      computers: index % 3 === 0,
      outlets: true,
    },
    abbreviation: `R${200 + index}`,
  }
}

function createTestPreference(courseId, index = 1) {
  return {
    courseId,
    title: `Test Course ${index}`,
    expectedEnrollment: 25,
    creditHours: 3,
    preferredDays: ['MWF'],
    preferredTimes: ['09:00-10:30'],
    requiredEquipment: ['projector'],
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

async function testProfessorsEndpoint() {
  logSection('TESTING PROFESSORS ENDPOINT')

  // Test POST - Create professors
  const testProf = createTestProfessor(1)
  let response = await apiCall('POST', '/professors', {
    professors: [testProf],
  })
  logTest('POST /api/professors - Create professor', response.ok ? 'PASS' : 'FAIL', `Status: ${response.status}`)

  // Test GET - Retrieve professors
  response = await apiCall('GET', '/professors')
  logTest(
    'GET /api/professors - Retrieve all professors',
    response.ok ? 'PASS' : 'FAIL',
    `Status: ${response.status}, Count: ${Array.isArray(response.data) ? response.data.length : 'N/A'}`
  )

  // Test POST - Update professor
  testProf.displayName = 'Updated Professor Name'
  response = await apiCall('POST', '/professors', {
    professors: [testProf],
  })
  logTest('POST /api/professors - Update professor', response.ok ? 'PASS' : 'FAIL', `Status: ${response.status}`)
}

async function testCoursesEndpoint() {
  logSection('TESTING COURSES ENDPOINT')

  // Test POST - Create courses
  const testCourse = createTestCourse(1)
  let response = await apiCall('POST', '/courses', {
    courses: [testCourse],
  })
  logTest('POST /api/courses - Create course', response.ok ? 'PASS' : 'FAIL', `Status: ${response.status}`)

  // Test GET - Retrieve courses
  response = await apiCall('GET', '/courses')
  logTest(
    'GET /api/courses - Retrieve all courses',
    response.ok ? 'PASS' : 'FAIL',
    `Status: ${response.status}, Count: ${Array.isArray(response.data) ? response.data.length : 'N/A'}`
  )

  // Test POST - Create multiple courses
  const courses = [createTestCourse(2), createTestCourse(3)]
  response = await apiCall('POST', '/courses', { courses })
  logTest('POST /api/courses - Create multiple courses', response.ok ? 'PASS' : 'FAIL', `Status: ${response.status}`)

  // Test POST - Update course
  testCourse.title = 'Updated Course Title'
  response = await apiCall('POST', '/courses', {
    courses: [testCourse],
  })
  logTest('POST /api/courses - Update course', response.ok ? 'PASS' : 'FAIL', `Status: ${response.status}`)
}

async function testRoomsEndpoint() {
  logSection('TESTING ROOMS ENDPOINT')

  // Test POST - Create rooms
  const testRoom = createTestRoom(1)
  let response = await apiCall('POST', '/rooms', {
    rooms: [testRoom],
  })
  logTest('POST /api/rooms - Create room', response.ok ? 'PASS' : 'FAIL', `Status: ${response.status}`)

  // Test GET - Retrieve rooms
  response = await apiCall('GET', '/rooms')
  logTest(
    'GET /api/rooms - Retrieve all rooms',
    response.ok ? 'PASS' : 'FAIL',
    `Status: ${response.status}, Count: ${Array.isArray(response.data) ? response.data.length : 'N/A'}`
  )

  // Test POST - Create multiple rooms
  const rooms = [createTestRoom(2), createTestRoom(3)]
  response = await apiCall('POST', '/rooms', { rooms })
  logTest('POST /api/rooms - Create multiple rooms', response.ok ? 'PASS' : 'FAIL', `Status: ${response.status}`)

  // Test POST - Update room
  testRoom.displayName = 'Updated Room Name'
  response = await apiCall('POST', '/rooms', {
    rooms: [testRoom],
  })
  logTest('POST /api/rooms - Update room', response.ok ? 'PASS' : 'FAIL', `Status: ${response.status}`)
}

async function testPreferencesEndpoint() {
  logSection('TESTING PREFERENCES ENDPOINT')

  // First ensure we have test data (professors and courses)
  const prof = createTestProfessor(10)
  await apiCall('POST', '/professors', { professors: [prof] })

  const course = createTestCourse(10)
  await apiCall('POST', '/courses', { courses: [course] })

  // Test POST - Submit preferences
  const preference = {
    term: TEST_TERM,
    department: TEST_DEPARTMENT,
    courses: [createTestPreference(`${course.deptCode} ${course.courseNumber}`, 1)],
  }

  let response = await apiCall('POST', '/preferences', preference, TEST_FACULTY_TOKEN)
  logTest('POST /api/preferences - Submit preferences', response.ok ? 'PASS' : 'FAIL', `Status: ${response.status}`)

  // Test GET - Retrieve preferences for term
  response = await apiCall('GET', `/preferences/${TEST_TERM}`)
  logTest(
    'GET /api/preferences/:term - Retrieve preferences',
    response.ok || response.status === 404 ? 'PASS' : 'FAIL',
    `Status: ${response.status}`
  )
}

async function testScheduleEndpoint() {
  logSection('TESTING SCHEDULE ENDPOINT')

  // Test POST - Run scheduler
  let response = await apiCall('POST', '/schedule/run', {
    term: TEST_TERM,
  })
  logTest('POST /api/schedule/run - Run scheduler', response.ok ? 'PASS' : 'FAIL', `Status: ${response.status}`)

  // Test GET - Retrieve schedule
  response = await apiCall('GET', `/schedule/${TEST_TERM}`)
  logTest(
    'GET /api/schedule/:term - Retrieve schedule',
    response.ok || response.status === 404 ? 'PASS' : 'FAIL',
    `Status: ${response.status}`
  )

  // Test PATCH - Update schedule
  if (response.ok || response.status === 404) {
    response = await apiCall('PATCH', `/schedule/${TEST_TERM}`, {
      status: 'draft',
      assignments: [],
      conflicts: [],
    })
    logTest('PATCH /api/schedule/:term - Update schedule', response.ok || response.status === 404 ? 'PASS' : 'FAIL', `Status: ${response.status}`)
  }
}

async function testAuditLogsEndpoint() {
  logSection('TESTING AUDIT LOGS ENDPOINT')

  // Test POST - Create audit log
  const auditLog = {
    action: 'COURSE_UPSERT',
    collection: 'courses',
    documentId: 'CS-101',
    detail: 'Test course created',
    userId: 'testadmin',
  }

  let response = await apiCall('POST', '/audit-logs', auditLog)
  logTest('POST /api/audit-logs - Create audit log', response.ok ? 'PASS' : 'FAIL', `Status: ${response.status}`)

  // Test GET - Retrieve audit logs
  response = await apiCall('GET', '/audit-logs')
  logTest(
    'GET /api/audit-logs - Retrieve audit logs',
    response.ok ? 'PASS' : 'FAIL',
    `Status: ${response.status}, Count: ${Array.isArray(response.data) ? response.data.length : 'N/A'}`
  )
}

async function testErrorHandling() {
  logSection('TESTING ERROR HANDLING')

  // Test missing auth
  const response = await apiCall('GET', '/professors', null, '')
  logTest('Missing auth header - Should reject', response.status === 401 ? 'PASS' : 'FAIL', `Status: ${response.status}`)

  // Test invalid data
  const badCourse = { deptCode: 'CS' }
  const response2 = await apiCall('POST', '/courses', { courses: [badCourse] })
  logTest('Invalid course data - Should validate', !response2.ok ? 'PASS' : 'FAIL', `Status: ${response2.status}`)

  // Test invalid term format
  const response3 = await apiCall('GET', '/schedule/invalid!!!')
  logTest('Invalid term format - Should reject', !response3.ok ? 'PASS' : 'FAIL', `Status: ${response3.status}`)
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.clear()
  logSection('API ENDPOINT TEST SUITE')
  log('INFO', `Test Suite Started: ${new Date().toISOString()}`)
  log('INFO', `Base URL: ${BASE_URL}`)
  log('INFO', `Database: ${process.env.MONGO_URI}`)

  // Connect to database
  await connectDB()

  // Backup database
  const backupSuccess = await backupDatabase()
  if (!backupSuccess) {
    log('ERROR', 'Failed to backup database. Aborting tests.')
    process.exit(1)
  }

  // Run all test suites
  try {
    await testProfessorsEndpoint()
    await testCoursesEndpoint()
    await testRoomsEndpoint()
    await testPreferencesEndpoint()
    await testScheduleEndpoint()
    await testAuditLogsEndpoint()
    await testErrorHandling()
  } catch (error) {
    log('ERROR', 'Test suite error:', error.message)
  }

  // Print summary
  logSection('TEST SUMMARY')
  console.log(`
  Total Tests: ${testResults.passed + testResults.failed}
  Passed:      ${testResults.passed}
  Failed:      ${testResults.failed}
  Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%
  `)

  // Restore database
  log('INFO', 'Waiting 2 seconds before restore...')
  await new Promise((resolve) => setTimeout(resolve, 2000))

  const restoreSuccess = await restoreDatabase()
  if (!restoreSuccess) {
    log('WARNING', 'Database restore had issues, but continuing...')
  }

  // Disconnect
  await mongoose.disconnect()
  log('INFO', '✓ Disconnected from MongoDB')

  logSection('TEST SUITE COMPLETED')
  log('INFO', `Test Suite Finished: ${new Date().toISOString()}`)

  // Exit with appropriate code
  process.exit(testResults.failed === 0 ? 0 : 1)
}

// Run main
main().catch((error) => {
  log('ERROR', 'Fatal error:', error.message)
  process.exit(1)
})