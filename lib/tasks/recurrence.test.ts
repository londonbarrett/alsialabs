import { describe, expect, it } from "vitest"

import { computeNextOccurrence } from "./recurrence"

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

  it("returns null when startTime is empty", () => {
    expect(
      computeNextOccurrence(
        { ...daily, startTime: null },
        new Date(2026, 9, 30, 10, 0)
      )
    ).toBeNull()
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
