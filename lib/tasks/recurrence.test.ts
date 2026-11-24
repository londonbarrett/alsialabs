import { describe, expect, it } from "vitest"

import { computeNextOccurrence, firstOccurrenceAnchor } from "./recurrence"

const daily = {
  recurrence: "daily" as const,
  interval: 1,
  daysOfWeek: null,
  startTime: "09:00",
}

describe("computeNextOccurrence", () => {
  it("returns null for a non-repeating task", () => {
    expect(
      computeNextOccurrence({ ...daily, recurrence: null }, new Date())
    ).toBeNull()
  })

  it("schedules at midnight when startTime is empty (all-day)", () => {
    const next = computeNextOccurrence(
      { ...daily, startTime: null },
      new Date(2026, 9, 30, 10, 0)
    )
    expect(next).toEqual(new Date(2026, 9, 31, 0, 0))
  })

  it("falls on the next day when today's start time already passed", () => {
    const after = new Date(2026, 9, 30, 10, 0)
    const next = computeNextOccurrence(daily, after)
    expect(next?.getDate()).toBe(31)
    expect(next?.getHours()).toBe(9)
    expect(next!.getTime()).toBeGreaterThan(after.getTime())
  })

  it("falls on today when the start time is still ahead", () => {
    const after = new Date(2026, 9, 30, 8, 0)
    const next = computeNextOccurrence(daily, after)
    expect(next?.getDate()).toBe(30)
    expect(next?.getHours()).toBe(9)
  })

  it("returns the next matching weekday for a weekly task", () => {
    // 2026-10-30 is a Friday.
    const after = new Date(2026, 9, 30, 12, 0)
    const next = computeNextOccurrence(
      {
        recurrence: "weekly",
        interval: 1,
        daysOfWeek: ["monday"],
        startTime: "09:00",
      },
      after
    )
    expect(next?.getDay()).toBe(1)
    expect(next?.getDate()).toBe(2)
  })
})

describe("firstOccurrenceAnchor", () => {
  const now = new Date(2026, 10, 23, 22, 22)

  it("keeps a future all-day start on its own day, inclusively", () => {
    // A stored all-day start carries its timezone offset (05:00Z in Bogotá),
    // so it must be normalized to midnight before the inclusive comparison.
    const start = new Date(2026, 10, 25, 5, 0)
    expect(
      firstOccurrenceAnchor({ startDate: start, startTime: null }, now)
    ).toEqual({ anchor: new Date(2026, 10, 25), inclusive: true })
  })

  it("keeps a future timed start at its scheduled time", () => {
    const start = new Date(2026, 10, 25, 9, 0)
    expect(
      firstOccurrenceAnchor({ startDate: start, startTime: "09:00" }, now)
    ).toEqual({ anchor: start, inclusive: true })
  })

  it("anchors on now, strictly, once the start date is reached", () => {
    const start = new Date(2026, 10, 20, 9, 0)
    expect(
      firstOccurrenceAnchor({ startDate: start, startTime: "09:00" }, now)
    ).toEqual({ anchor: now, inclusive: false })
  })
})

describe("computeNextOccurrence end date", () => {
  const dailyTask = {
    recurrence: "daily" as const,
    interval: 1,
    daysOfWeek: null,
    startTime: "09:00",
  }

  it("keeps a slot that lands inside the end date's day", () => {
    // 2026-10-26 is a Monday; the end date is Wednesday the 28th.
    const next = computeNextOccurrence(
      { ...dailyTask, endDate: new Date(2026, 9, 28) },
      new Date(2026, 9, 27, 12, 0)
    )

    expect(next).toEqual(new Date(2026, 9, 28, 9, 0))
  })

  it("treats the end date as inclusive through its whole day", () => {
    const next = computeNextOccurrence(
      { ...dailyTask, endDate: new Date(2026, 9, 28) },
      new Date(2026, 9, 28, 8, 0)
    )

    expect(next).toEqual(new Date(2026, 9, 28, 9, 0))
  })

  it("returns null once the next slot falls after the end date", () => {
    const next = computeNextOccurrence(
      { ...dailyTask, endDate: new Date(2026, 9, 28) },
      new Date(2026, 9, 28, 12, 0)
    )

    expect(next).toBeNull()
  })

  it("repeats without limit when no end date is set", () => {
    const next = computeNextOccurrence(
      { ...dailyTask, endDate: null },
      new Date(2026, 9, 28, 12, 0)
    )

    expect(next).toEqual(new Date(2026, 9, 29, 9, 0))
  })
})

describe("computeNextOccurrence start date", () => {
  const allDay = {
    recurrence: "daily" as const,
    interval: 1,
    daysOfWeek: null,
    startTime: null,
  }

  it("re-anchors on the start day when the trigger's anchor is earlier", () => {
    // Unarchive anchors on now, which can precede a future start date.
    const next = computeNextOccurrence(
      { ...allDay, startDate: new Date(2026, 10, 25, 5, 0) },
      new Date(2026, 10, 23, 19, 25)
    )

    expect(next).toEqual(new Date(2026, 10, 25))
  })

  it("keeps the start date's own slot for a timed task", () => {
    const start = new Date(2026, 10, 25, 9, 0)
    const next = computeNextOccurrence(
      { ...daily, startDate: start },
      new Date(2026, 10, 23, 19, 25),
      { inclusive: true }
    )

    expect(next).toEqual(start)
  })

  it("applies the end date to the re-anchored occurrence", () => {
    const next = computeNextOccurrence(
      {
        recurrence: "weekly",
        interval: 1,
        daysOfWeek: ["monday"],
        startTime: "09:00",
        startDate: new Date(2026, 10, 25, 9, 0), // Wednesday
        endDate: new Date(2026, 10, 27), // Friday — no Monday in range
      },
      new Date(2026, 10, 23, 8, 0)
    )

    expect(next).toBeNull()
  })
})
