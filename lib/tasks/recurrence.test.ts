import { describe, expect, it } from "vitest"

import { instantToWallClock } from "@/lib/time/zone"
import { computeNextOccurrence, firstOccurrenceAnchor } from "./recurrence"

const zone = "America/Bogota"

const daily = {
  recurrence: "daily" as const,
  interval: 1,
  daysOfWeek: null,
  startTime: "09:00",
}

const weeklyMonday = {
  recurrence: "weekly" as const,
  interval: 1,
  daysOfWeek: ["monday"],
  startTime: "09:00",
}

const offsetAt = (instant: Date, timeZone: string): string =>
  Temporal.Instant.fromEpochMilliseconds(instant.getTime())
    .toZonedDateTimeISO(timeZone).offset

describe("computeNextOccurrence", () => {
  it("returns null for a non-repeating task", () => {
    expect(
      computeNextOccurrence({ ...daily, recurrence: null }, new Date(), zone)
    ).toBeNull()
  })

  it("schedules at project-zone midnight when startTime is empty (all-day)", () => {
    // 2026-09-30T15:00Z is 10:00 in Bogotá, so the next all-day slot is
    // midnight on 1 October there — 05:00Z, not host-local midnight.
    const next = computeNextOccurrence(
      { ...daily, startTime: null },
      new Date("2026-09-30T15:00:00Z"),
      zone
    )

    expect(next).toEqual(new Date("2026-10-01T05:00:00Z"))
  })

  it("falls on the next project-zone day when today's start time already passed", () => {
    const after = new Date("2026-09-30T15:00:00Z") // 10:00 in Bogotá
    const next = computeNextOccurrence(daily, after, zone)

    expect(next).toEqual(new Date("2026-10-01T14:00:00Z"))
    expect(next!.getTime()).toBeGreaterThan(after.getTime())
  })

  it("falls on today when the start time is still ahead", () => {
    const next = computeNextOccurrence(
      daily,
      new Date("2026-09-30T13:00:00Z"), // 08:00 in Bogotá
      zone
    )

    expect(next).toEqual(new Date("2026-09-30T14:00:00Z"))
  })

  it("returns the next matching weekday in the project zone", () => {
    // 2026-10-30T17:00Z is Friday 12:00 in Bogotá.
    const next = computeNextOccurrence(
      weeklyMonday,
      new Date("2026-10-30T17:00:00Z"),
      zone
    )

    expect(instantToWallClock(next!, zone)).toEqual({
      date: "2026-11-02",
      time: "09:00",
    })
  })

  it("keeps the same wall-clock hour across the March DST change in New York but a fixed offset in Bogotá", () => {
    // Monday 2026-03-02 09:00 EST -> Monday 2026-03-09 09:00 EDT: one calendar
    // week at the same wall-clock hour, but only 23 real hours apart.
    const from = new Date("2026-03-02T14:00:00Z")
    const newYork = computeNextOccurrence(weeklyMonday, from, "America/New_York")
    const bogota = computeNextOccurrence(weeklyMonday, from, zone)

    expect(newYork).toEqual(new Date("2026-03-09T13:00:00Z"))
    expect(instantToWallClock(newYork!, "America/New_York")).toEqual({
      date: "2026-03-09",
      time: "09:00",
    })
    expect(offsetAt(from, "America/New_York")).toBe("-05:00")
    expect(offsetAt(newYork!, "America/New_York")).toBe("-04:00")

    expect(bogota).toEqual(new Date("2026-03-09T14:00:00Z"))
    expect(instantToWallClock(bogota!, zone)).toEqual({
      date: "2026-03-09",
      time: "09:00",
    })
    expect(offsetAt(from, zone)).toBe("-05:00")
    expect(offsetAt(bogota!, zone)).toBe("-05:00")
  })
})

describe("firstOccurrenceAnchor", () => {
  // 2026-11-24T03:22Z is 22:22 in Bogotá on 23 November.
  const now = new Date("2026-11-24T03:22:00Z")

  it("keeps a future all-day start on its own project-zone day, inclusively", () => {
    // The stored all-day start carries its zone offset (05:00Z in Bogotá), so
    // it must be normalized to project-zone midnight before the comparison.
    const start = new Date("2026-11-25T05:00:00Z")
    expect(
      firstOccurrenceAnchor({ startDate: start, startTime: null }, zone, now)
    ).toEqual({ anchor: start, inclusive: true })
  })

  it("keeps a future timed start at its scheduled instant", () => {
    const start = new Date("2026-11-25T14:00:00Z") // 09:00 in Bogotá
    expect(
      firstOccurrenceAnchor({ startDate: start, startTime: "09:00" }, zone, now)
    ).toEqual({ anchor: start, inclusive: true })
  })

  it("anchors on now, strictly, once the start date is reached", () => {
    const start = new Date("2026-11-20T14:00:00Z")
    expect(
      firstOccurrenceAnchor({ startDate: start, startTime: "09:00" }, zone, now)
    ).toEqual({ anchor: now, inclusive: false })
  })

  it("normalizes an all-day anchor to project-zone midnight instead of host midnight", () => {
    const start = new Date("2026-11-26T05:00:00Z")
    const { anchor, inclusive } = firstOccurrenceAnchor(
      { startDate: start, startTime: null },
      zone,
      now
    )

    expect(anchor).toEqual(start)
    expect(instantToWallClock(anchor, zone)).toEqual({
      date: "2026-11-26",
      time: "00:00",
    })
    expect(inclusive).toBe(true)
  })
})

describe("computeNextOccurrence end date", () => {
  it("keeps a slot that lands inside the end date's project-zone day", () => {
    const next = computeNextOccurrence(
      { ...daily, endDate: new Date("2026-10-28T05:00:00Z") }, // midnight 28 Oct in Bogotá
      new Date("2026-10-27T17:00:00Z"), // 12:00 on the 27th
      zone
    )

    expect(next).toEqual(new Date("2026-10-28T14:00:00Z"))
  })

  it("treats the end date as inclusive through its whole day", () => {
    const next = computeNextOccurrence(
      { ...daily, endDate: new Date("2026-10-28T05:00:00Z") },
      new Date("2026-10-28T13:00:00Z"), // 08:00 on the 28th
      zone
    )

    expect(next).toEqual(new Date("2026-10-28T14:00:00Z"))
  })

  it("returns null once the next slot falls after the end date", () => {
    const next = computeNextOccurrence(
      { ...daily, endDate: new Date("2026-10-28T05:00:00Z") },
      new Date("2026-10-28T17:00:00Z"), // 12:00 on the 28th
      zone
    )

    expect(next).toBeNull()
  })

  it("repeats without limit when no end date is set", () => {
    const next = computeNextOccurrence(
      { ...daily, endDate: null },
      new Date("2026-10-28T17:00:00Z"),
      zone
    )

    expect(next).toEqual(new Date("2026-10-29T14:00:00Z"))
  })
})

describe("computeNextOccurrence start date", () => {
  const allDay = { ...daily, startTime: null }

  it("re-anchors on the start day when the trigger's anchor is earlier", () => {
    // Unarchive anchors on now, which can precede a future start date.
    const next = computeNextOccurrence(
      { ...allDay, startDate: new Date("2026-11-25T05:00:00Z") },
      new Date("2026-11-23T19:25:00Z"),
      zone
    )

    expect(next).toEqual(new Date("2026-11-25T05:00:00Z"))
  })

  it("keeps the start date's own slot for a timed task", () => {
    const start = new Date("2026-11-25T14:00:00Z")
    const next = computeNextOccurrence(
      { ...daily, startDate: start },
      new Date("2026-11-23T19:25:00Z"),
      zone,
      { inclusive: true }
    )

    expect(next).toEqual(start)
  })

  it("applies the end date to the re-anchored occurrence", () => {
    const next = computeNextOccurrence(
      {
        ...weeklyMonday,
        startDate: new Date("2026-11-25T14:00:00Z"), // Wednesday
        endDate: new Date("2026-11-27T05:00:00Z"), // Friday — no Monday in range
      },
      new Date("2026-11-23T13:00:00Z"),
      zone
    )

    expect(next).toBeNull()
  })
})
