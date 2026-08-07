export type RoutineRecurrence = "daily" | "weekly"

export interface ScheduleConfig {
  recurrence: RoutineRecurrence
  interval: number
  daysOfWeek: string[]
  time: string | null
}

const WEEKDAY_TO_JS: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 0,
}

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year || 0, (month || 1) - 1, day || 1)
}

export function startOfWeek(date: Date): Date {
  const day = date.getDay()
  const diff = (day + 6) % 7
  return startOfDay(
    new Date(date.getFullYear(), date.getMonth(), date.getDate() - diff)
  )
}

function addDays(date: Date, days: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days
  )
}

function applyTime(date: Date, time: string | null): Date {
  if (!time) return date
  const [hours, minutes] = time.split(":").map(Number)
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours || 0,
    minutes || 0
  )
}

function weekdayOffset(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1
}

export function computeScheduledFor(
  from: Date,
  schedule: ScheduleConfig
): Date | null {
  if (!schedule.time) return null

  switch (schedule.recurrence) {
    case "daily": {
      const anchor = startOfDay(from)
      for (let k = 0; k <= schedule.interval; k++) {
        const candidate = applyTime(
          addDays(anchor, k * schedule.interval),
          schedule.time
        )
        if (candidate.getTime() > from.getTime()) return candidate
      }
      return applyTime(
        addDays(anchor, schedule.interval),
        schedule.time
      )
    }

    case "weekly": {
      const days =
        schedule.daysOfWeek.length > 0
          ? [...new Set(schedule.daysOfWeek)]
              .map((d) => WEEKDAY_TO_JS[d])
              .filter((d) => d !== undefined)
              .sort((a, b) => a - b)
          : [from.getDay()]
      const monday = startOfWeek(from)
      let best: Date | null = null
      for (let k = 0; k <= schedule.interval; k++) {
        if (k % schedule.interval !== 0) continue
        for (const jsDay of days) {
          const candidate = applyTime(
            addDays(monday, k * 7 + weekdayOffset(jsDay)),
            schedule.time
          )
          if (candidate.getTime() > from.getTime()) {
            if (!best || candidate.getTime() < best.getTime()) {
              best = candidate
            }
          }
        }
      }
      if (best) return best
      return applyTime(
        addDays(from, schedule.interval * 7),
        schedule.time
      )
    }

    default:
      return null
  }
}
