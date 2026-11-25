import { describe, expect, it } from "vitest"

import {
  instantToWallClock,
  wallClockToInstant,
  zonedDateKey,
} from "@/lib/time/zone"
import {
  atTime,
  firstAssignmentWindow,
  sortAssignments,
} from "./assignments"
import { computeNextOccurrence, firstOccurrenceAnchor } from "./recurrence"

const zone = "America/Bogota"

/** Project-zone wall clock -> the instant it represents. */
const at = (dateKey: string, time: string | null): Date =>
  new Date(wallClockToInstant(dateKey, time, zone)!.epochMilliseconds)

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
      row("later", "todo", new Date("2026-11-10T14:00:00Z")),
      row("sooner", "todo", new Date("2026-11-03T14:00:00Z")),
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
      row("later", "todo", "2026-11-10T14:00:00.000Z"),
      row("sooner", "todo", "2026-11-03T14:00:00.000Z"),
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

describe("atTime", () => {
  it("applies a wall-clock time in the project zone", () => {
    // 2026-11-25T12:00Z is 07:00 in Bogotá; 09:00 there is 14:00Z.
    expect(atTime(new Date("2026-11-25T12:00:00Z"), "09:00", zone)).toEqual(
      new Date("2026-11-25T14:00:00Z")
    )
  })

  it("preserves the project-zone day at midnight when no time is given", () => {
    // 2026-11-25T20:00Z is 15:00 in Bogotá; midnight of that day is 05:00Z.
    expect(atTime(new Date("2026-11-25T20:00:00Z"), null, zone)).toEqual(
      new Date("2026-11-25T05:00:00Z")
    )
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
    const startDate = new Date("2026-11-03T14:00:00Z")
    const endDate = new Date("2026-11-03T16:00:00Z")

    expect(
      firstAssignmentWindow(
        { ...repeating, recurrence: null, startDate, endDate },
        zone
      )
    ).toEqual({ startDate, endDate })
  })

  it("anchors a future start date at its first scheduled slot", () => {
    const futureKey = Temporal.Now.zonedDateTimeISO(zone)
      .add({ days: 14 })
      .toPlainDate().toString()
    const anchor = at(futureKey, null)

    const window = firstAssignmentWindow({ ...repeating, startDate: anchor }, zone)

    expect(window.startDate).not.toBeNull()
    const slot = instantToWallClock(window.startDate!, zone)
    expect(slot.time).toBe("09:00")
    expect(slot.date >= futureKey).toBe(true)
    expect(
      Temporal.Instant.fromEpochMilliseconds(window.startDate!.getTime())
        .toZonedDateTimeISO(zone).dayOfWeek
    ).toBe(1)
    expect(window.startDate!.getTime()).toBeGreaterThanOrEqual(
      anchor.getTime()
    )
    // No earlier Monday would qualify.
    expect(window.startDate!.getTime() - 7 * 24 * 60 * 60 * 1000).toBeLessThan(
      anchor.getTime()
    )
  })

  it("never anchors in the past for today's or a missing start date", () => {
    const now = new Date()
    const todayKey = zonedDateKey(now, zone)
    const daily = {
      ...repeating,
      recurrence: "daily" as const,
      daysOfWeek: [] as string[],
      startTime: "09:00",
    }

    for (const startDate of [at(todayKey, null), null]) {
      const window = firstAssignmentWindow({ ...daily, startDate }, zone)
      expect(window.startDate).not.toBeNull()
      expect(window.startDate!.getTime()).toBeGreaterThanOrEqual(
        now.getTime() - 1000
      )
    }
  })

  it("anchors an all-day task in Bogotá at project-zone midnight", () => {
    const futureKey = Temporal.Now.zonedDateTimeISO(zone)
      .add({ days: 14 })
      .toPlainDate().toString()
    const anchor = at(futureKey, null)

    const window = firstAssignmentWindow(
      {
        ...repeating,
        recurrence: "daily" as const,
        daysOfWeek: [] as string[],
        startTime: null,
        endTime: null,
        startDate: anchor,
      },
      zone
    )

    expect(window.startDate).toEqual(anchor)
    expect(instantToWallClock(window.startDate!, zone)).toEqual({
      date: futureKey,
      time: "00:00",
    })
    expect(window.endDate).toEqual(anchor)
  })

  it("anchors an all-day task without a future start on today, not tomorrow", () => {
    const now = new Date()
    const todayKey = zonedDateKey(now, zone)
    const dailyAllDay = {
      ...repeating,
      recurrence: "daily" as const,
      daysOfWeek: [] as string[],
      startTime: null,
      endTime: null,
    }

    for (const startDate of [at(todayKey, null), null]) {
      const window = firstAssignmentWindow({ ...dailyAllDay, startDate }, zone)

      expect(instantToWallClock(window.startDate!, zone)).toEqual({
        date: todayKey,
        time: "00:00",
      })
      expect(window.endDate).toEqual(window.startDate)
    }
  })

  it("falls back to the task window when no occurrence is in range", () => {
    const startDate = at("2026-11-25", "09:00") // Wednesday
    const endDate = at("2026-11-27", null) // Friday — no Monday in range

    expect(
      firstAssignmentWindow({ ...repeating, startDate, endDate }, zone)
    ).toEqual({ startDate, endDate })
  })

  it("keeps a past-ended daily schedule's window instead of null dates", () => {
    const today = Temporal.Now.zonedDateTimeISO(zone)
    const pastKey = (days: number) =>
      today.subtract({ days }).toPlainDate().toString()
    const startDate = at(pastKey(5), "09:00")
    const endDate = at(pastKey(3), "17:00")

    const window = firstAssignmentWindow(
      {
        ...repeating,
        recurrence: "daily" as const,
        daysOfWeek: [] as string[],
        startDate,
        endDate,
      },
      zone
    )

    // An assignee on this task gets real dates, never the null-dated window
    // that caused the original incident; the action guard sees a valid pair.
    expect(window).toEqual({ startDate, endDate })
    expect(window.startDate).not.toBeNull()
    expect(window.endDate).not.toBeNull()
  })

  it("still reports no window without any start date", () => {
    expect(
      firstAssignmentWindow(
        { ...repeating, startDate: null, endDate: at("2026-11-27", null) },
        zone
      )
    ).toEqual({ startDate: null, endDate: null })
  })

  it("gives the same date as the spawn path for the same task", () => {
    const task = {
      ...repeating,
      recurrence: "daily" as const,
      daysOfWeek: [] as string[],
      startTime: null,
      endTime: null,
      startDate: at("2026-11-25", null),
      endDate: at("2026-11-27", null),
    }
    const { anchor, inclusive } = firstOccurrenceAnchor(task, zone)

    expect(firstAssignmentWindow(task, zone).startDate).toEqual(
      computeNextOccurrence(task, anchor, zone, { inclusive })
    )
  })
})
