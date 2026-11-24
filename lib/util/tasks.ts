import { endOfDay } from "@/lib/util/schedule"

/**
 * A timestamp with no time-of-day — the signature of an all-day task.
 * Matches the calendar's heuristic for flagging all-day events.
 */
export function isAllDayDate(date: Date): boolean {
  return date.getHours() === 0 && date.getMinutes() === 0
}

/**
 * An all-day assignment's window is a single timestamp. View rows hand dates
 * back as raw driver strings, so this accepts both strings and Dates; the
 * midnight-hour heuristic is not reliable once a timezone offset is involved.
 */
export function isAllDayWindow(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined
): boolean {
  const time = (value: Date | string | null | undefined): number => {
    if (!value) return Number.NaN
    return value instanceof Date ? value.getTime() : Date.parse(value)
  }
  const startMs = time(start)
  return !Number.isNaN(startMs) && startMs === time(end)
}

/**
 * All-day work is due through its whole calendar day: a midnight deadline
 * only becomes overdue once that day ends, not from its first minute.
 */
export function isTaskOverdue(
  status: string,
  dueDate: Date | string | null | undefined
): boolean {
  if (!dueDate || status === "done" || status === "cancelled")
    return false
  const d = dueDate instanceof Date ? dueDate : new Date(dueDate)
  if (Number.isNaN(d.getTime())) return false
  const deadline = isAllDayDate(d) ? endOfDay(d) : d
  return deadline.getTime() < Date.now()
}

/**
 * Due-date cell label. Callers that know the task is all-day pass `allDay`
 * explicitly: an all-day slot can read back as 05:00 depending on the
 * server's timezone, so the midnight heuristic alone is not reliable.
 */
export function formatDueDate(
  date: Date,
  locale: string,
  allDay?: boolean
): string {
  const isAllDay = allDay ?? isAllDayDate(date)
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    ...(isAllDay ? {} : { hour: "numeric", minute: "2-digit" }),
  }).format(date)
}

/** Assignment-row label: all-day occurrences show only their date. */
export function formatAssignmentDueDate(
  date: Date,
  locale: string,
  allDay: boolean
): string {
  return formatDueDate(date, locale, allDay)
}
