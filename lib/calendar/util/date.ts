export const DAY_MS = 86_400_000

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function endOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  )
}

export function addDays(date: Date, days: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days
  )
}

export function addMonths(date: Date, months: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth() + months,
    date.getDate()
  )
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7)
}

export function startOfWeek(date: Date, weekStartsOn = 0): Date {
  const day = date.getDay()
  const diff = (day - weekStartsOn + 7) % 7
  return addDays(startOfDay(date), -diff)
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isSameMonth(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth()
  )
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

export function maxOf(a: Date, b: Date): Date {
  return a.getTime() > b.getTime() ? a : b
}

export function minOf(a: Date, b: Date): Date {
  return a.getTime() < b.getTime() ? a : b
}

export function isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime()
}

export function isAfter(a: Date, b: Date): boolean {
  return a.getTime() > b.getTime()
}

export function clampDate(date: Date, min: Date, max: Date): Date {
  return maxOf(minOf(date, max), min)
}

export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function getFirstDayOfWeek(locale: string, fallback = 1): number {
  const normalized = locale.trim().toLowerCase()
  return (
    WEEK_START_BY_LOCALE[normalized] ??
    WEEK_START_BY_LANG[normalized.slice(0, 2)] ??
    fallback
  )
}

// Static tables (not Intl.Locale.weekInfo) so SSR and client always agree.
// Sunday = 0, Monday = 1, ..., Saturday = 6.
const WEEK_START_BY_LANG: Record<string, number> = {
  en: 0,
  ja: 0,
  ko: 0,
  zh: 0,
  th: 0,
  id: 0,
  mt: 0,
  he: 0,
  ar: 6,
  es: 1,
  ca: 1,
  de: 1,
  fr: 1,
  it: 1,
  pt: 1,
  nl: 1,
  pl: 1,
  ru: 1,
  uk: 1,
  sv: 1,
  no: 1,
  da: 1,
  fi: 1,
  cs: 1,
  hu: 1,
  ro: 1,
  tr: 1,
  vi: 1,
  el: 1,
}

const WEEK_START_BY_LOCALE: Record<string, number> = {
  "en-gb": 1,
  "en-au": 1,
  "en-nz": 1,
  "en-ie": 1,
  "en-za": 1,
  "en-ph": 0,
  "es-us": 0,
}

/** All dates of the month laid out as weeks (leading/trailing days included). */
export function monthGrid(
  year: number,
  month: number,
  weekStartsOn = 0
): Date[][] {
  const first = new Date(year, month, 1)
  const start = startOfWeek(first, weekStartsOn)
  const last = new Date(year, month + 1, 0)
  const weeks: Date[][] = []
  let cursor = start
  while (cursor.getTime() <= last.getTime()) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)))
    cursor = addDays(cursor, 7)
  }
  return weeks
}

export function getMonthLabel(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(date)
}

export function getWeekLabel(
  start: Date,
  end: Date,
  locale: string
): string {
  const sameYear = start.getFullYear() === end.getFullYear()
  const startFmt = new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })
  const endFmt = new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  return `${startFmt.format(start)} – ${endFmt.format(end)}`
}

export function getDayLabel(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

export function getWeekdayLabels(
  locale: string,
  weekStartsOn = 0,
  style: Intl.DateTimeFormatOptions["weekday"] = "short"
): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: style })
  const sunday = new Date(2021, 9, 3) // a known Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(sunday, (i + weekStartsOn) % 7)
    return formatter.format(day)
  })
}

export function formatHour(hour: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    hour12: true,
  }).format(new Date(2021, 0, 1, hour, 0))
}

export function formatTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
