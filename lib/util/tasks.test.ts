import { describe, expect, it } from "vitest"

import {
  formatAssignmentDueDate,
  formatDueDate,
  isAllDayDate,
  isAllDayWindow,
  isTaskOverdue,
} from "./tasks"

describe("isAllDayDate", () => {
  it("flags midnight timestamps and nothing else", () => {
    expect(isAllDayDate(new Date(2026, 10, 20, 0, 0))).toBe(true)
    expect(isAllDayDate(new Date(2026, 10, 20, 9, 30))).toBe(false)
    expect(isAllDayDate(new Date(2026, 10, 20, 0, 30))).toBe(false)
  })
})

describe("isAllDayWindow", () => {
  it("recognizes a single-timestamp window from raw driver strings", () => {
    expect(
      isAllDayWindow(
        "2026-11-25T05:00:00.000Z",
        "2026-11-25T05:00:00.000Z"
      )
    ).toBe(true)
    expect(
      isAllDayWindow(
        new Date(2026, 10, 25, 5, 0),
        new Date(2026, 10, 25, 5, 0)
      )
    ).toBe(true)
  })

  it("rejects timed windows and missing dates", () => {
    expect(
      isAllDayWindow(
        new Date(2026, 10, 25, 9, 0),
        new Date(2026, 10, 25, 11, 0)
      )
    ).toBe(false)
    expect(isAllDayWindow(null, null)).toBe(false)
  })
})

describe("isTaskOverdue", () => {
  it("ignores missing dates and terminal statuses", () => {
    expect(isTaskOverdue("todo", null)).toBe(false)
    expect(isTaskOverdue("done", new Date(2026, 0, 1, 12))).toBe(false)
    expect(isTaskOverdue("cancelled", new Date(2026, 0, 1, 12))).toBe(
      false
    )
    expect(isTaskOverdue("todo", "not a date")).toBe(false)
  })

  it("is overdue from the deadline itself for timed due dates", () => {
    const past = new Date(2026, 0, 1, 12)
    expect(isTaskOverdue("todo", past)).toBe(true)

    const future = new Date(Date.now() + 60 * 60 * 1000)
    expect(isTaskOverdue("todo", future)).toBe(false)
  })

  it("holds an all-day due date overdue until its day ends", () => {
    const todayMidnight = new Date()
    todayMidnight.setHours(0, 0, 0, 0)
    expect(isTaskOverdue("todo", todayMidnight)).toBe(false)

    const yesterday = new Date(todayMidnight)
    yesterday.setDate(yesterday.getDate() - 1)
    expect(isTaskOverdue("todo", yesterday)).toBe(true)
  })
})

describe("formatDueDate", () => {
  it("drops the time-of-day for all-day timestamps", () => {
    const label = formatDueDate(new Date(2026, 10, 20, 0, 0), "en-US")
    expect(label).not.toContain(":")
    expect(label).toContain("20")
  })

  it("keeps the time for timed timestamps", () => {
    const label = formatDueDate(new Date(2026, 10, 20, 9, 30), "en-US")
    expect(label).toContain(":")
    expect(label).toContain("20")
  })

  it("honors an explicit all-day flag over the midnight heuristic", () => {
    // An all-day slot can read back as 05:00 depending on the server's
    // timezone, so callers that know the task is all-day must be able to say so.
    const label = formatDueDate(
      new Date(2026, 10, 25, 5, 0),
      "en-US",
      true
    )
    expect(label).not.toContain(":")
    expect(label).toContain("25")
  })
})

describe("formatAssignmentDueDate", () => {
  it("drops the time for an all-day occurrence whatever its stored hour", () => {
    const label = formatAssignmentDueDate(
      new Date(2026, 10, 25, 5, 0),
      "es-ES",
      true
    )
    expect(label).not.toContain(":")
    expect(label).toContain("25 nov")
  })

  it("shows the occurrence's due time for timed work", () => {
    const label = formatAssignmentDueDate(
      new Date(2026, 10, 20, 17, 0),
      "es-ES",
      false
    )
    expect(label).toContain(":")
    expect(label).toContain("17:00")
  })

  it("formats with the requested locale", () => {
    const date = new Date(2026, 10, 20, 17, 0)
    expect(formatAssignmentDueDate(date, "es-ES", false)).toContain("20 nov")
  })
})
