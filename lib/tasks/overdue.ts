import { addZonedDays, startOfZonedDay } from "@/lib/time/zone"

/**
 * All-day work is due through its whole calendar day in the project's zone:
 * a midnight deadline only becomes overdue once that day ends there.
 *
 * Server-only: it depends on Temporal via `lib/time/zone`, so callers must
 * compute this before data crosses to the client (see actions/tasks/queries).
 */
export function isTaskOverdue(
  status: string,
  dueDate: Date | string | null | undefined,
  timeZone: string,
  allDay: boolean
): boolean {
  if (!dueDate || status === "done" || status === "cancelled") return false
  const d = dueDate instanceof Date ? dueDate : new Date(dueDate)
  if (Number.isNaN(d.getTime())) return false

  if (allDay) {
    const dayAfterEndMs = addZonedDays(
      startOfZonedDay(d, timeZone),
      1
    ).epochMilliseconds
    return Date.now() >= dayAfterEndMs
  }

  return d.getTime() < Date.now()
}
