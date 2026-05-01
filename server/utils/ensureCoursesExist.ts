// Upsert any courses referenced in a preference submission that are not yet
// in the course catalog. Uses $setOnInsert so existing courses are untouched.
import { CourseCatalog } from '../models/index'
import type { ICoursePreference } from '../models/index'

export async function ensurePreferenceCoursesExist(
  courses: ICoursePreference[],
): Promise<void> {
  const referencedIds = [
    ...new Set(courses.map((c) => c.courseId).filter(Boolean)),
  ]
  if (referencedIds.length === 0) return

  const existing = await CourseCatalog.find({ _id: { $in: referencedIds } })
    .lean()
    .exec()
  const existingIds = new Set(existing.map((c) => String(c._id)))

  const toCreate = courses
    .filter((c) => !existingIds.has(c.courseId))
    .map((c) => {
      const parts = c.courseId.trim().split(/\s+/)
      const deptCode = parts[0]?.toUpperCase() ?? ''
      const courseNumber = parts.slice(1).join(' ')
      if (!deptCode || !courseNumber) return null
      return {
        _id: c.courseId,
        deptCode,
        courseNumber,
        title: c.title,
        creditHours: c.creditHours,
        requiredEquipment: [] as string[],
        labComponent: false,
        active: true,
        prerequisites: [] as string[],
        corequisites: [] as string[],
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)

  if (toCreate.length === 0) return

  await CourseCatalog.bulkWrite(
    toCreate.map((c) => ({
      updateOne: {
        filter: { _id: c._id },
        update: { $setOnInsert: c },
        upsert: true,
      },
    })),
    { ordered: false },
  )
}
