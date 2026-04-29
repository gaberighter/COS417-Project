function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeCourseIdText(value: string): string {
  return normalizeWhitespace(value).toUpperCase()
}

function normalizeSectionText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }

  const normalized = normalizeWhitespace(String(value)).toUpperCase()
  return normalized.length > 0 ? normalized : null
}

function parseEmbeddedSection(
  normalizedCourseId: string,
): { catalogCourseId: string; section: string | null } {
  const match = normalizedCourseId.match(/^(.+\s+\S+)-([A-Z0-9]+)$/)
  if (!match) {
    return {
      catalogCourseId: normalizedCourseId,
      section: null,
    }
  }

  const [, catalogCourseId, section] = match
  return {
    catalogCourseId: normalizeCourseIdText(catalogCourseId),
    section: normalizeSectionText(section),
  }
}

export function buildScheduledCourseId(
  catalogCourseId: string,
  section: string | null,
): string {
  return section === null
    ? normalizeCourseIdText(catalogCourseId)
    : `${normalizeCourseIdText(catalogCourseId)}-${section}`
}

export function normalizeCourseReference(
  courseId: string,
  section?: string | null,
): {
  rawCourseId: string
  catalogCourseId: string
  scheduledCourseId: string
  section: string | null
} {
  const rawCourseId = normalizeCourseIdText(courseId)
  const normalizedSection = normalizeSectionText(section)

  if (normalizedSection !== null) {
    const suffix = `-${normalizedSection}`
    const catalogCourseId = rawCourseId.endsWith(suffix)
      ? normalizeCourseIdText(rawCourseId.slice(0, -suffix.length))
      : rawCourseId

    return {
      rawCourseId,
      catalogCourseId,
      scheduledCourseId: buildScheduledCourseId(
        catalogCourseId,
        normalizedSection,
      ),
      section: normalizedSection,
    }
  }

  const parsed = parseEmbeddedSection(rawCourseId)
  return {
    rawCourseId,
    catalogCourseId: parsed.catalogCourseId,
    scheduledCourseId: buildScheduledCourseId(
      parsed.catalogCourseId,
      parsed.section,
    ),
    section: parsed.section,
  }
}

export function catalogCourseIdOf(courseId: string): string {
  return normalizeCourseReference(courseId).catalogCourseId
}

export function courseSectionOf(
  courseId: string,
  section?: string | null,
): string | null {
  return normalizeCourseReference(courseId, section).section
}

export function scheduledCourseIdsShareCatalog(
  left: string,
  right: string,
): boolean {
  return catalogCourseIdOf(left) === catalogCourseIdOf(right)
}
