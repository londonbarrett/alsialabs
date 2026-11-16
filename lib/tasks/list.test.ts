import { describe, expect, it } from "vitest"

import type {
  TaskAssignmentDTO,
  TaskWithAssignmentsDTO,
} from "@/actions/tasks/schemas"
import { selectTasks, visibleAssignments } from "./list"

const NOW = new Date("2026-11-11T15:00:00")

const makeAssignment = (
  overrides: Partial<TaskAssignmentDTO> = {}
): TaskAssignmentDTO => ({
  id: "a1",
  taskId: "t1",
  userId: "u1",
  userName: null,
  userEmail: null,
  userImage: null,
  status: "todo",
  comment: null,
  startDate: null,
  endDate: null,
  ...overrides,
})

const makeTask = (
  overrides: Partial<TaskWithAssignmentsDTO> = {}
): TaskWithAssignmentsDTO => ({
  id: "task-1",
  projectId: "p1",
  name: "Task one",
  description: null,
  priority: null,
  startDate: null,
  endDate: null,
  recurrence: null,
  interval: 1,
  daysOfWeek: null,
  startTime: null,
  endTime: null,
  createdAt: new Date("2026-11-01T00:00:00"),
  updatedAt: new Date("2026-11-01T00:00:00"),
  assignments: [],
  commentCount: 0,
  ...overrides,
})

describe("visibleAssignments", () => {
  it("shows only open rows when the task has any open assignment", () => {
    const open = makeAssignment({
      id: "a1",
      userId: "u1",
      status: "todo",
    })
    const closed = makeAssignment({
      id: "a2",
      userId: "u2",
      status: "done",
    })
    expect(visibleAssignments([open, closed])).toEqual([open])
  })
  it("shows every row when the task has no open assignment", () => {
    const rows = [
      makeAssignment({ id: "a1", userId: "u1", status: "done" }),
      makeAssignment({ id: "a2", userId: "u2", status: "cancelled" }),
    ]
    expect(visibleAssignments(rows)).toBe(rows)
  })
})

describe("selectTasks", () => {
  it("unfinished filters to shouldShowTask and orders by due date ascending, nulls last", () => {
    const later = makeTask({
      id: "t-later",
      endDate: new Date("2026-11-20T00:00:00"),
      assignments: [makeAssignment({ status: "blocked" })],
    })
    const hidden = makeTask({
      id: "t-hidden",
      endDate: new Date("2026-11-12T00:00:00"),
      assignments: [makeAssignment({ status: "done" })],
    })
    const noDue = makeTask({
      id: "t-no-due",
      endDate: null,
      assignments: [makeAssignment({ status: "in_progress" })],
    })
    const soon = makeTask({
      id: "t-soon",
      endDate: new Date("2026-11-15T00:00:00"),
      assignments: [makeAssignment({ status: "todo" })],
    })

    const result = selectTasks(
      [later, hidden, noDue, soon],
      "unfinished",
      NOW
    )
    expect(result.map((t) => t.id)).toEqual([
      "t-soon",
      "t-later",
      "t-no-due",
    ])
  })

  it("finished filters to the complement and orders by due date descending, nulls last", () => {
    const doneEarly = makeTask({
      id: "t-done-early",
      endDate: new Date("2026-11-05T00:00:00"),
      assignments: [makeAssignment({ status: "done" })],
    })
    const stillOpen = makeTask({
      id: "t-still-open",
      endDate: new Date("2026-11-10T00:00:00"),
      assignments: [makeAssignment({ status: "todo" })],
    })
    const doneNoDue = makeTask({
      id: "t-done-no-due",
      endDate: null,
      assignments: [makeAssignment({ status: "done" })],
    })
    const doneLate = makeTask({
      id: "t-done-late",
      endDate: new Date("2026-11-25T00:00:00"),
      assignments: [makeAssignment({ status: "done" })],
    })

    const result = selectTasks(
      [doneEarly, stillOpen, doneNoDue, doneLate],
      "finished",
      NOW
    )
    expect(result.map((t) => t.id)).toEqual([
      "t-done-late",
      "t-done-early",
      "t-done-no-due",
    ])
  })

  it("both lists unfinished tasks before finished ones", () => {
    const finishedEarly = makeTask({
      id: "f-earlier",
      endDate: new Date("2026-11-05T00:00:00"),
      assignments: [makeAssignment({ status: "done" })],
    })
    const unfinishedLater = makeTask({
      id: "u-later",
      endDate: new Date("2026-11-20T00:00:00"),
      assignments: [makeAssignment({ status: "todo" })],
    })
    const finishedLater = makeTask({
      id: "f-later",
      endDate: new Date("2026-11-25T00:00:00"),
      assignments: [makeAssignment({ status: "done" })],
    })
    const unfinishedNoDue = makeTask({
      id: "u-no-due",
      endDate: null,
      assignments: [makeAssignment({ status: "blocked" })],
    })
    const unfinishedSoon = makeTask({
      id: "u-soon",
      endDate: new Date("2026-11-15T00:00:00"),
      assignments: [makeAssignment({ status: "in_review" })],
    })

    const result = selectTasks(
      [
        finishedEarly,
        unfinishedLater,
        finishedLater,
        unfinishedNoDue,
        unfinishedSoon,
      ],
      "both",
      NOW
    )
    expect(result.map((t) => t.id)).toEqual([
      "u-soon",
      "u-later",
      "u-no-due",
      "f-later",
      "f-earlier",
    ])
  })
})
