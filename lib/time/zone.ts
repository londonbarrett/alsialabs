/**
 * Server-side boundary between project wall-clock values and unambiguous
 * instants. Every function takes an explicit IANA zone: nothing here reads the
 * host `TZ`, uses local `Date` getters, or depends on where the process runs.
 */

function toInstant(value: Date | Temporal.Instant): Temporal.Instant {
  return value instanceof Date
    ? Temporal.Instant.fromEpochMilliseconds(value.getTime())
    : value
}

function toZonedDateTime(
  value: Date | Temporal.Instant,
  timeZone: string
): Temporal.ZonedDateTime {
  return toInstant(value).toZonedDateTimeISO(timeZone)
}

function parseTime(time: string | null): Temporal.PlainTime {
  // Empty strings are what an unchecked "all day" form control submits.
  return Temporal.PlainTime.from(time?.trim() || "00:00")
}

/** Wall-clock date/time in a zone to an instant; `null` marks invalid input. */
export function wallClockToInstant(
  dateKey: string,
  time: string | null,
  timeZone: string
): Temporal.Instant | null {
  try {
    return Temporal.PlainDate.from(dateKey)
      .toPlainDateTime(parseTime(time))
      .toZonedDateTime(timeZone, { disambiguation: "compatible" })
      .toInstant()
  } catch {
    return null
  }
}

/** Instant to the wall-clock date and `HH:mm` time of the given zone. */
export function instantToWallClock(
  instant: Date | Temporal.Instant,
  timeZone: string
): { date: string; time: string } {
  const zoned = toZonedDateTime(instant, timeZone)
  const pad = (value: number) => String(value).padStart(2, "0")

  return {
    date: zoned.toPlainDate().toString(),
    time: `${pad(zoned.hour)}:${pad(zoned.minute)}`,
  }
}

/** Calendar date (`YYYY-MM-DD`) of an instant in the given zone. */
export function zonedDateKey(
  instant: Date | Temporal.Instant,
  timeZone: string
): string {
  return toZonedDateTime(instant, timeZone).toPlainDate().toString()
}

/** Current instant as a zoned date-time in the given zone. */
export function zonedNow(timeZone: string): Temporal.ZonedDateTime {
  return Temporal.Now.zonedDateTimeISO(timeZone)
}

/** Midnight at the start of the instant's calendar day in the given zone. */
export function startOfZonedDay(
  instant: Date | Temporal.Instant,
  timeZone: string
): Temporal.ZonedDateTime {
  return atZonedTime(toZonedDateTime(instant, timeZone), null)
}

/** A zone's calendar day at a wall-clock time; `null` means midnight. */
export function atZonedTime(
  day: Temporal.ZonedDateTime,
  time: string | null
): Temporal.ZonedDateTime {
  const parsed = parseTime(time)

  return day.with(
    {
      hour: parsed.hour,
      minute: parsed.minute,
      second: 0,
      millisecond: 0,
      microsecond: 0,
      nanosecond: 0,
    },
    { disambiguation: "compatible" }
  )
}

/** Calendar-day arithmetic: keeps wall-clock time across DST changes. */
export function addZonedDays(
  day: Temporal.ZonedDateTime,
  days: number
): Temporal.ZonedDateTime {
  return day.add({ days })
}
