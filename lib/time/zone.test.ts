import { describe, expect, it } from "vitest"

import {
  addZonedDays,
  atZonedTime,
  instantToWallClock,
  startOfZonedDay,
  wallClockToInstant,
  zonedDateKey,
  zonedNow,
} from "./zone"

const bogotaInstant = Temporal.Instant.from("2026-11-25T14:00:00Z")

describe("wallClockToInstant", () => {
  it("resolves a Bogotá wall clock to its UTC instant", () => {
    const result = wallClockToInstant("2026-11-25", "09:00", "America/Bogota")

    expect(result?.equals(bogotaInstant)).toBe(true)
  })

  it("resolves the same wall clock in Madrid to a different winter instant", () => {
    const result = wallClockToInstant("2026-11-25", "09:00", "Europe/Madrid")

    expect(
      result?.equals(Temporal.Instant.from("2026-11-25T08:00:00Z"))
    ).toBe(true)
  })

  it("resolves a nonexistent spring-forward time forward under compatible disambiguation", () => {
    const result = wallClockToInstant(
      "2026-03-08",
      "02:30",
      "America/New_York"
    )

    expect(result).not.toBeNull()
    expect(instantToWallClock(result!, "America/New_York")).toEqual({
      date: "2026-03-08",
      time: "03:30",
    })
    expect(result!.toZonedDateTimeISO("America/New_York").offset).toBe("-04:00")
  })

  it("picks the earlier offset for an ambiguous fall-back time", () => {
    const result = wallClockToInstant(
      "2026-11-01",
      "01:30",
      "America/New_York"
    )

    expect(result?.toZonedDateTimeISO("America/New_York").offset).toBe("-04:00")
  })

  it("uses project-zone midnight when the form submits no time", () => {
    const result = wallClockToInstant("2026-11-25", null, "America/Bogota")

    expect(instantToWallClock(result!, "America/Bogota")).toEqual({
      date: "2026-11-25",
      time: "00:00",
    })
  })

  it("treats an empty form time like a missing time", () => {
    const result = wallClockToInstant("2026-11-25", "", "America/Bogota")

    expect(
      result?.equals(
        wallClockToInstant("2026-11-25", null, "America/Bogota")!
      )
    ).toBe(true)
  })

  it("returns null for an invalid date, time or zone instead of throwing", () => {
    expect(wallClockToInstant("not-a-date", "09:00", "UTC")).toBeNull()
    expect(wallClockToInstant("2026-11-25", "not-a-time", "UTC")).toBeNull()
    expect(wallClockToInstant("2026-11-25", "09:00", "Mars/Olympus")).toBeNull()
  })
})

describe("instantToWallClock", () => {
  it("round-trips an instant back to the Bogotá wall clock", () => {
    expect(instantToWallClock(bogotaInstant, "America/Bogota")).toEqual({
      date: "2026-11-25",
      time: "09:00",
    })
  })

  it("accepts a JS Date as well as a Temporal.Instant", () => {
    expect(
      instantToWallClock(new Date("2026-11-25T14:00:00Z"), "America/Bogota")
    ).toEqual({ date: "2026-11-25", time: "09:00" })
  })

  it("reads the same instant as the previous day in Bogotá", () => {
    const lateUtc = Temporal.Instant.from("2026-11-25T02:00:00Z")

    expect(instantToWallClock(lateUtc, "America/Bogota").date).toBe("2026-11-24")
    expect(instantToWallClock(lateUtc, "UTC").date).toBe("2026-11-25")
  })
})

describe("zonedDateKey", () => {
  it("derives the calendar date in the requested zone from a JS Date", () => {
    const instant = new Date("2026-11-25T02:00:00Z")

    expect(zonedDateKey(instant, "America/Bogota")).toBe("2026-11-24")
    expect(zonedDateKey(instant, "UTC")).toBe("2026-11-25")
  })

  it("accepts a Temporal.Instant too", () => {
    expect(
      zonedDateKey(
        Temporal.Instant.from("2026-11-25T02:00:00Z"),
        "America/Bogota"
      )
    ).toBe("2026-11-24")
  })
})

describe("zonedNow", () => {
  it("returns the current instant in the requested zone", () => {
    const before = Temporal.Now.instant().epochMilliseconds
    const now = zonedNow("America/Bogota")
    const after = Temporal.Now.instant().epochMilliseconds

    expect(now.timeZoneId).toBe("America/Bogota")
    expect(now.epochMilliseconds).toBeGreaterThanOrEqual(before)
    expect(now.epochMilliseconds).toBeLessThanOrEqual(after)
  })
})

describe("startOfZonedDay", () => {
  it("returns midnight in the requested zone, not the host zone", () => {
    const start = startOfZonedDay(
      new Date("2026-11-25T02:00:00Z"),
      "America/Bogota"
    )

    expect(start.timeZoneId).toBe("America/Bogota")
    expect(instantToWallClock(start.toInstant(), "America/Bogota")).toEqual({
      date: "2026-11-24",
      time: "00:00",
    })
  })
})

describe("atZonedTime", () => {
  const day = startOfZonedDay(
    new Date("2026-11-25T12:00:00Z"),
    "America/Bogota"
  )

  it("sets the wall-clock time while keeping the day's zone", () => {
    const result = atZonedTime(day, "14:30")

    expect(result.timeZoneId).toBe("America/Bogota")
    expect(instantToWallClock(result.toInstant(), "America/Bogota")).toEqual({
      date: "2026-11-25",
      time: "14:30",
    })
  })

  it("keeps midnight for a null or empty time", () => {
    expect(atZonedTime(day, null).toPlainTime().toString()).toBe("00:00:00")
    expect(atZonedTime(day, "").toPlainTime().toString()).toBe("00:00:00")
  })
})

describe("addZonedDays", () => {
  it("keeps wall-clock midnight across a daylight-saving change", () => {
    const start = startOfZonedDay(
      new Date("2026-11-01T12:00:00Z"),
      "America/New_York"
    )
    const result = addZonedDays(start, 2)

    expect(result.timeZoneId).toBe("America/New_York")
    expect(result.hour).toBe(0)
    expect(result.minute).toBe(0)
    expect(
      instantToWallClock(result.toInstant(), "America/New_York")
    ).toEqual({ date: "2026-11-03", time: "00:00" })
  })
})
