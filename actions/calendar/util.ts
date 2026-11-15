import { parseISODate, startOfDay } from "@/lib/util/schedule"
import type { CalendarRangeDTO } from "./schemas"

const RANGE_DAYS = 90

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

  const defaultFrom = startOfDay(new Date())
  defaultFrom.setDate(defaultFrom.getDate() - RANGE_DAYS)

  const defaultTo = startOfDay(new Date())
  defaultTo.setDate(defaultTo.getDate() + RANGE_DAYS)
  defaultTo.setHours(23, 59, 59, 999)

  return { from: from ?? defaultFrom, to: to ?? defaultTo }
}
