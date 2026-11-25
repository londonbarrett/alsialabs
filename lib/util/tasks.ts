/**
 * An all-day assignment's window is a single timestamp. View rows hand dates
 * back as raw driver strings, so this accepts both strings and Dates; it only
 * compares instants and never infers all-day from an hour.
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

/** Due-date cell label, rendered in the project's zone. */
export function formatDueDate(
  date: Date,
  locale: string,
  timeZone: string,
  startTime: string | null
): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    ...(startTime === null ? {} : { hour: "numeric", minute: "2-digit" }),
    timeZone,
  }).format(date)
}

/** Assignment-row label: all-day occurrences show only their date. */
export function formatAssignmentDueDate(
  date: Date,
  locale: string,
  timeZone: string,
  startTime: string | null
): string {
  return formatDueDate(date, locale, timeZone, startTime)
}

/**
 * Client-side wall-clock → instant conversion for the brief moment before the
 * server reseeds an optimistic task row. The server-only zone boundary is
 * authoritative; this helper deliberately uses only `Intl.DateTimeFormat`
 * because Temporal is not available in every browser and there is no polyfill.
 */
type WallParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function zonedParts(instant: Date, timeZone: string): WallParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0")

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  }
}

/** The wall-clock fields read as UTC — used to measure a zone's offset. */
function asUtcMs(parts: WallParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )
}

function offsetMsAt(ms: number, timeZone: string): number {
  // Seconds precision: formatToParts has no milliseconds, so drop them from
  // the instant before comparing it with the formatted wall clock.
  return asUtcMs(zonedParts(new Date(ms), timeZone)) - Math.floor(ms / 1000) * 1000
}

export function resolveOptimisticWindow(
  dateKey: string | null | undefined,
  time: string | null | undefined,
  timeZone: string,
  fallbackNow = false
): Date | null {
  if (!dateKey) return fallbackNow ? new Date() : null

  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  const clock = /^(\d{2}):(\d{2})$/.exec(time?.trim() || "00:00")
  if (!day || !clock) return null

  const target = Date.UTC(
    Number(day[1]),
    Number(day[2]) - 1,
    Number(day[3]),
    Number(clock[1]),
    Number(clock[2])
  )
  // Reject impossible calendar days instead of letting Date.UTC roll them over.
  if (new Date(target).toISOString().slice(0, 10) !== dateKey) return null

  // Measure the zone's offset at the target wall clock and on both sides of
  // it: a DST transition can put the naive instant (or a first guess based on
  // it) on the wrong side. One iteration is enough to see both offsets.
  const halfDay = 12 * 60 * 60 * 1000
  const offsets = [
    offsetMsAt(target, timeZone),
    offsetMsAt(target - halfDay, timeZone),
    offsetMsAt(target + halfDay, timeZone),
  ]
  const candidates = [...new Set(offsets)].map((offset) => ({
    instant: target - offset,
    wall: asUtcMs(zonedParts(new Date(target - offset), timeZone)),
  }))

  // An ambiguous wall clock has two valid instants: `compatible` takes the
  // earlier one. A nonexistent one (spring forward) has none: shift forward.
  const matching = candidates
    .filter((candidate) => candidate.wall === target)
    .map((candidate) => candidate.instant)
  if (matching.length > 0) return new Date(Math.min(...matching))

  const next = candidates
    .filter((candidate) => candidate.wall > target)
    .map((candidate) => candidate.instant)
  return new Date(Math.min(...next))
}
