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
