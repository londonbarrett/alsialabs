import { endOfDay, parseISODate, startOfDay } from "@/lib/util/schedule"
import type { CalendarRangeDTO } from "./schemas"

const RANGE_DAYS = 90
/**
 * Grid days are host-local, but an assignment is placed on the date it has in
 * its own project's zone. A one-day buffer on each side keeps an event whose
 * project-zone date differs from the host-zone date inside the query. The
 * bounds remain instants — SQL still compares them as instants, never as
 * wall-clock strings.
 */
const DAY_BUFFER = 1

function shiftDays(date: Date, days: number): Date {
  const shifted = new Date(date)
  shifted.setDate(shifted.getDate() + days)
  return shifted
}

function parseRangeDate(value?: string): Date | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = parseISODate(value)
  if (Number.isNaN(date.getTime())) return null
  return startOfDay(date)
}

export function resolveCalendarRange(range?: CalendarRangeDTO): {
  from: Date
  to: Date
} {
  const from = parseRangeDate(range?.from)
  const to = parseRangeDate(range?.to)

  const today = startOfDay(new Date())
  const defaultFrom = shiftDays(today, -(RANGE_DAYS + DAY_BUFFER))
  const defaultTo = endOfDay(shiftDays(today, RANGE_DAYS + DAY_BUFFER))

  return {
    from: from ? shiftDays(from, -DAY_BUFFER) : defaultFrom,
    to: to ? endOfDay(shiftDays(to, DAY_BUFFER)) : defaultTo,
  }
}
