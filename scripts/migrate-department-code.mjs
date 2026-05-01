#!/usr/bin/env node

import mongoose from 'mongoose'

function requireMongoConfig() {
  const uri = process.env.MONGO_URI
  if (!uri) {
    throw new Error('MONGO_URI is required')
  }

  const parsed = new URL(uri)
  if (parsed.protocol !== 'mongodb:' && parsed.protocol !== 'mongodb+srv:') {
    throw new Error('MONGO_URI must use mongodb:// or mongodb+srv://')
  }

  const pathDbName = parsed.pathname.replace(/^\//, '').trim()
  return {
    uri,
    dbName: process.env.MONGODB_DB_NAME?.trim() || pathDbName || undefined,
  }
}

function normalizeDepartmentCode(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
}

function migrateProfessor(professor) {
  const departmentCode = normalizeDepartmentCode(
    professor.departmentCode || professor.department,
  )

  const preferences = Array.isArray(professor.preferences)
    ? professor.preferences.map((submission) => {
        const submissionDepartmentCode = normalizeDepartmentCode(
          submission.departmentCode || submission.department || departmentCode,
        )
        const { department, ...rest } = submission

        return {
          ...rest,
          departmentCode: submissionDepartmentCode,
        }
      })
    : []

  return {
    departmentCode,
    preferences,
  }
}

async function main() {
  const { uri, dbName } = requireMongoConfig()
  await mongoose.connect(uri, { dbName })

  const professors = mongoose.connection.db.collection('professors')
  const cursor = professors.find({})
  let modified = 0

  for await (const professor of cursor) {
    const migrated = migrateProfessor(professor)

    await professors.updateOne(
      { _id: professor._id },
      {
        $set: migrated,
        $unset: { department: '' },
      },
    )
    modified += 1
  }

  console.log(`Migrated ${modified} professor document(s).`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
