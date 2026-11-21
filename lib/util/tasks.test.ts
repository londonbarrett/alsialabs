import { describe, expect, it } from "vitest"

import {
  formatAssignmentDueDate,
  formatDueDate,
  isAllDayDate,
  isTaskOverdue,
} from "./tasks"

describe("isAllDayDate", () => {
  it("flags midnight timestamps and nothing else", () => {
    expect(isAllDayDate(new Date(2026, 10, 20, 0, 0))).toBe(true)
    expect(isAllDayDate(new Date(2026, 10, 20, 9, 30))).toBe(false)
    expect(isAllDayDate(new Date(2026, 10, 20, 0, 30))).toBe(false)
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
})

describe("formatAssignmentDueDate", () => {
  it("keeps the time even for a midnight timestamp — rows are occurrences, not all-day headers", () => {
    const label = formatAssignmentDueDate(
      new Date(2026, 10, 20, 0, 0),
      "en-US"
    )
    expect(label).toContain(":")
    expect(label).toContain("20")
  })

  it("shows the occurrence's due time", () => {
    const label = formatAssignmentDueDate(
      new Date(2026, 10, 20, 17, 0),
      "es-ES"
    )
    expect(label).toContain(":")
    expect(label).toContain("17:00")
  })

  it("formats with the requested locale", () => {
    const date = new Date(2026, 10, 20, 17, 0)
    expect(formatAssignmentDueDate(date, "es-ES")).toContain("20 nov")
  })
})
