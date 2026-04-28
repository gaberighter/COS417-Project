import type { DayPattern, TimeSlot } from '../types'

const START_TIMES = [
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '11:00',
  '11:45',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '16:00',
  '16:10',
  '17:00',
  '17:30',
  '18:00',
  '19:00',
  '19:30',
] as const

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

function patternDuration(days: DayPattern, creditHours = 3): number {
  const baseDuration = (() => {
    switch (days) {
      case 'TR':
        return 75
      case 'MW':
        return 110
      case 'MWF':
      case 'MTWF':
        return 50
      default:
        return 50
    }
  })()

  if (creditHours <= 1) {
    return Math.max(25, Math.floor(baseDuration / 2))
  }

  if (creditHours >= 4) {
    return baseDuration + 25
  }

  return baseDuration
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
export function generateAllSlots(creditHours = 3): TimeSlot[] {
  const patterns: DayPattern[] = ['MWF', 'TR', 'MW', 'MTWF']
  const slots: TimeSlot[] = []

  for (const days of patterns) {
    for (const startTime of START_TIMES) {
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
  return formatTime(parseTime(startTime) + patternDuration(days, creditHours))
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
