import { describe, expect, it } from "vitest"

import { startOfDay } from "@/lib/util/schedule"
import { firstAssignmentWindow, sortAssignments } from "./assignments"

const row = (
  id: string,
  status: string,
  startDate: Date | string | null = null
) => ({ id, status, startDate })

describe("sortAssignments", () => {
  it("puts open occurrences ahead of closed ones", () => {
    const sorted = sortAssignments([
      row("closed", "done"),
      row("open", "todo"),
    ])

    expect(sorted.map((r) => r.id)).toEqual(["open", "closed"])
  })

  it("orders open occurrences by earliest start", () => {
    const sorted = sortAssignments([
      row("later", "todo", new Date("2026-11-10T09:00:00")),
      row("sooner", "todo", new Date("2026-11-03T09:00:00")),
      row("undated", "todo", null),
    ])

    expect(sorted.map((r) => r.id)).toEqual([
      "sooner",
      "later",
      "undated",
    ])
  })

  it("sorts raw string dates from the detail view", () => {
    const sorted = sortAssignments([
      row("later", "todo", "2026-11-10T09:00:00.000Z"),
      row("sooner", "todo", "2026-11-03T09:00:00.000Z"),
    ])

    expect(sorted.map((r) => r.id)).toEqual(["sooner", "later"])
  })

  it("keeps equal rows in their input order", () => {
    const sorted = sortAssignments([
      row("first", "done"),
      row("second", "done"),
    ])

    expect(sorted.map((r) => r.id)).toEqual(["first", "second"])
  })
})

describe("firstAssignmentWindow", () => {
  const repeating = {
    startDate: null as Date | null,
    endDate: null as Date | null,
    recurrence: "weekly" as const,
    interval: 1,
    daysOfWeek: ["monday"],
    startTime: "09:00",
    endTime: "11:00",
  }

  it("returns the task window for a non-repeating task", () => {
    const startDate = new Date(2026, 10, 3, 9)
    const endDate = new Date(2026, 10, 3, 11)

    expect(
      firstAssignmentWindow({
        ...repeating,
        recurrence: null,
        startDate,
        endDate,
      })
    ).toEqual({ startDate, endDate })
  })

  it("anchors a future start date at its first scheduled slot", () => {
    // Two weeks out, so the expectation holds no matter when the suite runs.
    const anchor = startOfDay(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))

    const window = firstAssignmentWindow({
      ...repeating,
      startDate: anchor,
    })

    expect(window.startDate).not.toBeNull()
    // First Monday on or after the anchor, at the occurrence time...
    expect(window.startDate!.getDay()).toBe(1)
    expect(window.startDate!.getHours()).toBe(9)
    expect(window.startDate!.getTime()).toBeGreaterThanOrEqual(
      anchor.getTime()
    )
    // ...and no earlier Monday would qualify.
    const previous = new Date(window.startDate!)
    previous.setDate(previous.getDate() - 7)
    expect(previous.getTime()).toBeLessThan(anchor.getTime())
  })

  it("never anchors in the past for today's or a missing start date", () => {
    const now = new Date()
    const daily = {
      ...repeating,
      recurrence: "daily" as const,
      daysOfWeek: [] as string[],
      startTime: "09:00",
    }

    for (const startDate of [startOfDay(now), null]) {
      const window = firstAssignmentWindow({ ...daily, startDate })
      expect(window.startDate).not.toBeNull()
      expect(window.startDate!.getTime()).toBeGreaterThanOrEqual(
        now.getTime() - 1000
      )
    }
  })
})
