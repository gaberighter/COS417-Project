function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function looksLikeOpaqueId(value: string): boolean {
  return /^[a-f0-9]{24}$/i.test(value)
}

function normalizeCourseIdText(value: string): string {
  const normalized = normalizeWhitespace(value)
  return looksLikeOpaqueId(normalized) ? normalized : normalized.toUpperCase()
}

function normalizeSectionText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }

  const normalized = normalizeWhitespace(String(value)).toUpperCase()
  return normalized.length > 0 ? normalized : null
}

function parseEmbeddedSection(normalizedCourseId: string): {
  catalogCourseId: string
  section: string | null
} {
  const match = normalizedCourseId.match(/^(.+\s+\S+)-([A-Z0-9]+)$/)
  if (!match) {
    return {
      catalogCourseId: normalizedCourseId,
      section: null,
    }
  }

  const catalogCourseId = match[1] ?? normalizedCourseId
  const section = match[2] ?? null
  return {
    catalogCourseId: normalizeCourseIdText(catalogCourseId),
    section: normalizeSectionText(section),
  }
}

export function buildScheduledCourseId(
  catalogCourseId: string,
  section: string | null,
): string {
  const normalizedSection = normalizeSectionText(section)

  return normalizedSection === null
    ? normalizeCourseIdText(catalogCourseId)
    : `${normalizeCourseIdText(catalogCourseId)}-${normalizedSection}`
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

export function assignSyntheticSectionsToCourseReferences<
  T extends {
    term: string
    catalogCourseId: string
    scheduledCourseId: string
    section: string | null
  },
>(records: T[]): T[] {
  const groups = new Map<string, T[]>()

  for (const record of records) {
    const key = `${record.term}::${record.catalogCourseId}`
    const list = groups.get(key) ?? []
    list.push(record)
    groups.set(key, list)
  }

  for (const group of groups.values()) {
    if (group.length <= 1) {
      continue
    }

    const usedSections = new Set(
      group
        .map((record) => normalizeSectionText(record.section))
        .filter((section): section is string => section !== null),
    )

    let nextSectionNumber = 1
    const nextAvailableSection = (): string => {
      while (usedSections.has(String(nextSectionNumber))) {
        nextSectionNumber += 1
      }

      const assigned = String(nextSectionNumber)
      usedSections.add(assigned)
      nextSectionNumber += 1
      return assigned
    }

    for (const record of group) {
      if (normalizeSectionText(record.section) !== null) {
        record.scheduledCourseId = buildScheduledCourseId(
          record.catalogCourseId,
          normalizeSectionText(record.section),
        )
        continue
      }

      const syntheticSection = nextAvailableSection()
      record.section = syntheticSection
      record.scheduledCourseId = buildScheduledCourseId(
        record.catalogCourseId,
        syntheticSection,
      )
    }
  }

  return records
}
