import {
  parseISODate,
  startOfWeek,
  type ScheduleConfig,
} from "@/lib/util/schedule"
import { endOfDay, startOfDay } from "./date"

const WEEKDAY_TO_JS: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 0,
}

const DAY_MS = 86_400_000

function addDays(date: Date, days: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days
  )
}

function weekdayOffset(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1
}

/**
 * Expands a recurring schedule into concrete occurrence dates that fall
 * within `[rangeStart, rangeEnd]` (both inclusive). Occurrences keep the
 * schedule's time when present, otherwise they land at midnight.
 */
export function occurrencesInRange(
  schedule: ScheduleConfig,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  const windowStart = schedule.startDate
    ? parseISODate(schedule.startDate)
    : startOfDay(rangeStart)
  const windowEnd = schedule.endDate
    ? endOfDay(parseISODate(schedule.endDate))
    : endOfDay(rangeEnd)

  const from =
    windowStart.getTime() > startOfDay(rangeStart).getTime()
      ? startOfDay(windowStart)
      : startOfDay(rangeStart)
  const to =
    windowEnd.getTime() < endOfDay(rangeEnd).getTime()
      ? windowEnd
      : endOfDay(rangeEnd)

  const occurrences: Date[] = []
  if (to.getTime() < from.getTime()) return occurrences

  const applyTime = (date: Date): Date => {
    if (!schedule.time) return startOfDay(date)
    const [hours, minutes] = schedule.time.split(":").map(Number)
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hours || 0,
      minutes || 0
    )
  }

  const interval = Math.max(1, schedule.interval)

  if (schedule.recurrence === "daily") {
    for (
      let date = from;
      date.getTime() <= to.getTime();
      date = addDays(date, interval)
    ) {
      const occurrence = applyTime(date)
      if (
        occurrence.getTime() >= from.getTime() &&
        occurrence.getTime() <= to.getTime()
      ) {
        occurrences.push(occurrence)
      }
    }
    return occurrences
  }

  const jsDays =
    schedule.daysOfWeek.length > 0
      ? [...new Set(schedule.daysOfWeek)]
          .map((d) => WEEKDAY_TO_JS[d])
          .filter((d) => d !== undefined)
          .sort((a, b) => a - b)
      : [windowStart.getDay()]

  const anchor = startOfWeek(startOfDay(windowStart))
  for (
    let week = startOfWeek(from);
    week.getTime() <= to.getTime();
    week = addDays(week, 7)
  ) {
    const weekIndex = Math.round(
      (week.getTime() - anchor.getTime()) / (7 * DAY_MS)
    )
    if (weekIndex < 0 || weekIndex % interval !== 0) continue
    for (const jsDay of jsDays) {
      const occurrence = applyTime(addDays(week, weekdayOffset(jsDay)))
      if (
        occurrence.getTime() >= from.getTime() &&
        occurrence.getTime() <= to.getTime()
      ) {
        occurrences.push(occurrence)
      }
    }
  }
  return occurrences
}
