import { describe, expect, it } from "vitest"

import type { TaskAssignmentDTO } from "@/actions/tasks/schemas"
import { assignmentCounts, shouldShowTask } from "./filter"

const NOW = new Date("2026-11-11T15:00:00")

const assignment = (status: string): TaskAssignmentDTO => ({
  id: `assignment-${status}`,
  taskId: "task-1",
  userId: "user-1",
  userName: null,
  userEmail: null,
  userImage: null,
  status: status as TaskAssignmentDTO["status"],
  comment: null,
  startDate: null,
  endDate: null,
})

describe("shouldShowTask", () => {
  it("shows a task with an open assignment even when its due date has passed", () => {
    expect(shouldShowTask({ assignments: [assignment("blocked")], endDate: new Date("2026-11-01T00:00:00") }, NOW)).toBe(true)
  })
  it("hides a task with a done assignment while its due date is still valid", () => {
    expect(shouldShowTask({ assignments: [assignment("done")], endDate: new Date("2026-12-01T00:00:00") }, NOW)).toBe(false)
  })
  it("shows an all-cancelled task until its due date passes", () => {
    expect(shouldShowTask({ assignments: [assignment("cancelled")], endDate: new Date("2026-12-01T00:00:00") }, NOW)).toBe(true)
    expect(shouldShowTask({ assignments: [assignment("cancelled")], endDate: new Date("2026-11-10T00:00:00") }, NOW)).toBe(false)
  })
  it("stays visible through the whole end day (end-of-day inclusive)", () => {
    expect(shouldShowTask({ assignments: [], endDate: new Date("2026-11-11T09:00:00") }, NOW)).toBe(true)
  })
  it("never expires when endDate is null", () => {
    expect(shouldShowTask({ assignments: [assignment("cancelled")], endDate: null }, NOW)).toBe(true)
    expect(shouldShowTask({ assignments: [], endDate: null }, NOW)).toBe(true)
  })
  it("hides an unassigned task whose due date has passed", () => {
    expect(shouldShowTask({ assignments: [], endDate: new Date("2026-11-10T00:00:00") }, NOW)).toBe(false)
  })
})

describe("assignmentCounts", () => {
  it("counts blocked and in_review inside open", () => {
    expect(assignmentCounts([assignment("todo"), assignment("blocked"), assignment("in_review"), assignment("done")]))
      .toEqual({ open: 3, blocked: 1, review: 1 })
  })
})
