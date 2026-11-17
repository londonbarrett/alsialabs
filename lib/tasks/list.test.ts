import { describe, expect, it } from "vitest"

import type {
  TaskAssignmentDTO,
  TaskWithAssignmentsDTO,
} from "@/actions/tasks/schemas"
import {
  mergeClosedRows,
  selectTasks,
  sortClosedRows,
  visibleAssignments,
} from "./list"

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
  closedCount: 0,
  ...overrides,
})

describe("visibleAssignments", () => {
  it("repeating: shows only open rows when the task has any open assignment", () => {
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
    expect(visibleAssignments([open, closed], "daily")).toEqual([open])
  })
  it("repeating: shows every row when the task has no open assignment", () => {
    const rows = [
      makeAssignment({ id: "a1", userId: "u1", status: "done" }),
      makeAssignment({ id: "a2", userId: "u2", status: "cancelled" }),
    ]
    expect(visibleAssignments(rows, "weekly")).toBe(rows)
  })
  it("non-repeating: keeps open and closed rows side by side", () => {
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
    const rows = [open, closed]
    expect(visibleAssignments(rows, null)).toBe(rows)
  })
  it("non-repeating: keeps every row when none is open", () => {
    const rows = [
      makeAssignment({ id: "a1", userId: "u1", status: "done" }),
      makeAssignment({ id: "a2", userId: "u1", status: "cancelled" }),
    ]
    expect(visibleAssignments(rows, null)).toBe(rows)
  })
})

describe("sortClosedRows", () => {
  it("orders by startDate descending — newest first", () => {
    const oldest = makeAssignment({
      id: "a-old",
      startDate: new Date("2026-11-01T09:00:00"),
      endDate: new Date("2026-11-01T10:00:00"),
    })
    const newest = makeAssignment({
      id: "a-new",
      startDate: new Date("2026-11-05T09:00:00"),
      endDate: new Date("2026-11-05T10:00:00"),
    })
    const middle = makeAssignment({
      id: "a-mid",
      startDate: new Date("2026-11-03T09:00:00"),
      endDate: new Date("2026-11-03T10:00:00"),
    })
    const sorted = sortClosedRows([oldest, newest, middle])
    expect(sorted.map((row) => row.id)).toEqual([
      "a-new",
      "a-mid",
      "a-old",
    ])
  })

  it("sorts rows without a startDate last, in any input position", () => {
    const noStart = makeAssignment({ id: "a-null" })
    const dated = makeAssignment({
      id: "a-dated",
      startDate: new Date("2026-11-01T09:00:00"),
    })
    const otherNoStart = makeAssignment({ id: "a-null-2" })

    const sorted = sortClosedRows([noStart, dated, otherNoStart])
    expect(sorted.map((row) => row.id)).toEqual([
      "a-dated",
      "a-null",
      "a-null-2",
    ])
    expect(
      sortClosedRows([dated, noStart]).map((row) => row.id)
    ).toEqual(["a-dated", "a-null"])
  })

  it("keeps ties in input order (stable)", () => {
    // Same instant, three ids: stability is what makes a re-render of
    // the merged region jitter-free.
    const at = "2026-11-02T09:00:00"
    const first = makeAssignment({ id: "a-first", startDate: new Date(at) })
    const second = makeAssignment({
      id: "a-second",
      startDate: new Date(at),
    })
    const third = makeAssignment({ id: "a-third", startDate: new Date(at) })

    const sorted = sortClosedRows([first, second, third])
    expect(sorted.map((row) => row.id)).toEqual([
      "a-first",
      "a-second",
      "a-third",
    ])
    // Reversing the input reverses the ties — the comparator itself
    // contributes no ordering.
    expect(
      sortClosedRows([third, second, first]).map((row) => row.id)
    ).toEqual(["a-third", "a-second", "a-first"])
  })

  it("does not mutate its input", () => {
    const rows = [
      makeAssignment({
        id: "a-old",
        startDate: new Date("2026-11-01T09:00:00"),
      }),
      makeAssignment({
        id: "a-new",
        startDate: new Date("2026-11-05T09:00:00"),
      }),
    ]
    sortClosedRows(rows)
    expect(rows.map((row) => row.id)).toEqual(["a-old", "a-new"])
  })
})

describe("mergeClosedRows", () => {
  const closed = (id: string, startDate: string | null) =>
    makeAssignment({
      id,
      status: "done",
      startDate: startDate ? new Date(startDate) : null,
      endDate: startDate ? new Date(startDate) : null,
    })

  it("dedupes by id, keeping the store row ahead of the fetched copy", () => {
    const storeRow = closed("a1", "2026-11-05T09:00:00")
    const fetchedCopy = { ...storeRow, comment: "fetched" }
    const fetchedOnly = closed("a2", "2026-11-04T09:00:00")

    const merged = mergeClosedRows([storeRow], [fetchedCopy, fetchedOnly])
    expect(merged.map((row) => row.id)).toEqual(["a1", "a2"])
    // The first occurrence wins: the store row is the rendered copy.
    expect(merged[0]?.comment).toBeNull()
  })

  it("orders the merged region newest-first regardless of fetch order", () => {
    // Two overlapping pages as the panel receives them (server order
    // is createdAt DESC per page; the merge must not inherit it).
    const pageOne = [
      closed("a3", "2026-11-03T09:00:00"),
      closed("a2", "2026-11-02T09:00:00"),
    ]
    const pageTwo = [
      closed("a4", "2026-11-04T09:00:00"),
      closed("a1", "2026-11-01T09:00:00"),
    ]

    const merged = mergeClosedRows([], [...pageOne, ...pageTwo])
    expect(merged.map((row) => row.id)).toEqual([
      "a4",
      "a3",
      "a2",
      "a1",
    ])
  })

  it("keeps store rows the pages never return and nulls last", () => {
    const storeOnly = closed("a-store", null)
    const fetched = closed("a-fetched", "2026-11-02T09:00:00")

    const merged = mergeClosedRows([storeOnly], [fetched])
    expect(merged.map((row) => row.id)).toEqual([
      "a-fetched",
      "a-store",
    ])
  })

  it("returns a fresh array", () => {
    const storeRows = [closed("a1", "2026-11-05T09:00:00")]
    const fetched: TaskAssignmentDTO[] = []
    const merged = mergeClosedRows(storeRows, fetched)
    expect(merged).not.toBe(storeRows)
    expect(merged).not.toBe(fetched)
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
