import { describe, expect, it } from "vitest"

import { sortAssignments } from "./assignments"

const row = (
  id: string,
  status: string,
  startDate: Date | null = null
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

  it("keeps equal rows in their input order", () => {
    const sorted = sortAssignments([
      row("first", "done"),
      row("second", "done"),
    ])

    expect(sorted.map((r) => r.id)).toEqual(["first", "second"])
  })
})
