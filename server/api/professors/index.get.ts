// server/api/professors/index.get.ts
// GET /api/professors — §4.3.2
// Role: Admin | Faculty — returns active professor records.
// Admins may pass ?includeInactive=true to receive all records.

import { defineEventHandler, getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import { connectDB } from '../../utils/db'
import { Professor } from '../../models/index'

type LegacyProfessorRecord = {
  department?: unknown
  preferences?: Array<object & { department?: unknown }>
}

function stripLegacyDepartmentFields<T extends LegacyProfessorRecord>(
  professor: T,
) {
  const { department, preferences, ...rest } = professor
  return {
    ...rest,
    preferences: (preferences ?? []).map((preference) => {
      const { department: preferenceDepartment, ...cleanPreference } =
        preference
      return cleanPreference
    }),
  }
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, ['Admin', 'Faculty'])
  await connectDB()

  const { includeInactive } = getQuery(event)
  const isAdmin = auth.role === 'Admin'
  const filter = isAdmin && includeInactive === 'true' ? {} : { active: true }

  const professors = await Professor.find(filter).lean().exec()
  return professors.map(stripLegacyDepartmentFields)
})
