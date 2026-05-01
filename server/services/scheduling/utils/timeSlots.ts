import type { DayPattern, TimeSlot } from '../types'
import { schedulingConfig } from '../config'

function parseTime(value: string): number {
  const [hoursText, minutesText] = value.split(':')
  const hours = Number(hoursText)
  const minutes = Number(minutesText)
  return hours * 60 + minutes
}

function formatTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

function uniqueMeetingDayCount(days: DayPattern): number {
  return new Set(days.split('')).size
}

function roundToNearestFive(totalMinutes: number): number {
  return Math.max(25, Math.round(totalMinutes / 5) * 5)
}

function patternDuration(days: DayPattern, creditHours = 3): number {
  const meetingsPerWeek = uniqueMeetingDayCount(days)
  const weeklyInstructionMinutes = Math.max(50, creditHours * 50)
  return roundToNearestFive(weeklyInstructionMinutes / meetingsPerWeek)
}

const SUPPORTED_PATTERNS: DayPattern[] = [
  'MWF',
  'TR',
  'MW',
  'MTWF',
  'MWRF',
  'M',
  'W',
  'T',
  'R',
]

export function normalizeClockTime(value: string): string {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) {
    return trimmed
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return trimmed
  }

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

function uniqueNormalizedTimes(values: string[]): string[] {
  return [...new Set(values.map(normalizeClockTime).filter(Boolean))]
}

function startTimesForPattern(
  days: DayPattern,
  requestedTimes: string[] = [],
): string[] {
  const configuredTypicalTimes =
    schedulingConfig.typicalStartTimesByPattern[days] ?? []

  return uniqueNormalizedTimes([...configuredTypicalTimes, ...requestedTimes])
}

function sharedDays(left: DayPattern, right: DayPattern): string[] {
  return left.split('').filter((day) => right.includes(day))
}

/**
 * Generates the standard set of start and end times for the college timetable.
 *
 * @param creditHours - Course credit hours used for duration adjustments.
 * @returns All valid term slots across the supported day patterns.
 */
export function generateAllSlots(
  creditHours = 3,
  requestedPatterns: DayPattern[] = [],
  requestedTimes: string[] = [],
): TimeSlot[] {
  const slots: TimeSlot[] = []
  const patterns = uniqueNormalizedPatterns(requestedPatterns)
  const activePatterns = patterns.length > 0 ? patterns : SUPPORTED_PATTERNS

  for (const days of activePatterns) {
    for (const startTime of startTimesForPattern(days, requestedTimes)) {
      slots.push({
        days,
        startTime,
        endTime: formatTime(
          parseTime(startTime) + patternDuration(days, creditHours),
        ),
      })
    }
  }

  return slots
}

function uniqueNormalizedPatterns(values: DayPattern[]): DayPattern[] {
  return [...new Set(values)].filter((value): value is DayPattern =>
    SUPPORTED_PATTERNS.includes(value),
  )
}

/**
 * Computes a slot end time from the configured meeting pattern.
 *
 * @param startTime - Slot start in HH:MM format.
 * @param days - Meeting pattern for the class.
 * @param creditHours - Course credit hours; higher values stretch slot length.
 * @returns The computed end time in HH:MM format.
 */
export function computeEndTime(
  startTime: string,
  days: DayPattern,
  creditHours: number,
): string {
  return formatTime(
    parseTime(normalizeClockTime(startTime)) +
      patternDuration(days, creditHours),
  )
}

/**
 * Determines whether two time slots overlap on any shared day.
 *
 * @param left - First slot to compare.
 * @param right - Second slot to compare.
 * @returns True when the slots share a day and overlap in time.
 */
export function slotsOverlap(left: TimeSlot, right: TimeSlot): boolean {
  if (sharedDays(left.days, right.days).length === 0) {
    return false
  }

  const leftStart = parseTime(left.startTime)
  const leftEnd = parseTime(left.endTime)
  const rightStart = parseTime(right.startTime)
  const rightEnd = parseTime(right.endTime)

  return leftStart < rightEnd && rightStart < leftEnd
}

/**
 * Determines whether slot B starts immediately after slot A ends on the same days.
 *
 * @param left - The earlier slot.
 * @param right - The later slot.
 * @returns True when the two slots are directly back-to-back.
 */
export function isBackToBack(left: TimeSlot, right: TimeSlot): boolean {
  return left.days === right.days && left.endTime === right.startTime
}
