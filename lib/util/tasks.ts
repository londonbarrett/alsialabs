import { endOfDay } from "@/lib/util/schedule"

/**
 * A timestamp with no time-of-day — the signature of an all-day task.
 * Matches the calendar's heuristic for flagging all-day events.
 */
export function isAllDayDate(date: Date): boolean {
  return date.getHours() === 0 && date.getMinutes() === 0
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

/** Due-date cell label: all-day timestamps drop the time-of-day. */
export function formatDueDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    ...(isAllDayDate(date)
      ? {}
      : { hour: "numeric", minute: "2-digit" }),
  }).format(date)
}
