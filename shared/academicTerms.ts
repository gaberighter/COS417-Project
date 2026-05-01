const TERM_ORDER: Record<string, number> = {
  winter: 0,
  spring: 1,
  summer: 2,
  fall: 3,
  autumn: 3,
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase()
}

export function parseAcademicTerm(term: string): {
  year: number | null
  semesterOrder: number | null
} {
  const normalized = String(term ?? '').trim()
  if (!normalized) {
    return { year: null, semesterOrder: null }
  }

  const tokens = normalized
    .split(/[^A-Za-z0-9]+/)
    .map(normalizeToken)
    .filter(Boolean)

  const yearToken = tokens.find((token) => /^\d{4}$/.test(token))
  const semesterToken = tokens.find((token) => token in TERM_ORDER)

  return {
    year: yearToken ? Number(yearToken) : null,
    semesterOrder: semesterToken ? (TERM_ORDER[semesterToken] ?? null) : null,
  }
}

export function compareAcademicTermsDesc(left: string, right: string): number {
  const leftParsed = parseAcademicTerm(left)
  const rightParsed = parseAcademicTerm(right)

  if (leftParsed.year !== null && rightParsed.year !== null) {
    if (leftParsed.year !== rightParsed.year) {
      return rightParsed.year - leftParsed.year
    }

    if (
      leftParsed.semesterOrder !== null &&
      rightParsed.semesterOrder !== null &&
      leftParsed.semesterOrder !== rightParsed.semesterOrder
    ) {
      return rightParsed.semesterOrder - leftParsed.semesterOrder
    }
  } else if (leftParsed.year !== null || rightParsed.year !== null) {
    return leftParsed.year !== null ? -1 : 1
  }

  return right.localeCompare(left, undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}
