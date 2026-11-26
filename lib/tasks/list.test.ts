import { describe, expect, it } from "vitest"

import type {
  TaskAssignmentDTO,
  TaskWithAssignmentsDTO,
} from "@/actions/tasks/schemas"
import type { TaskAssigneeIdentity } from "@/lib/types"
import { assignmentCounts } from "./filter"
import {
  assigneeIdentities,
  freshlyClosedRows,
  mergeClosedRows,
  selectTasks,
  sortClosedRows,
  visibleAssignments,
} from "./list"

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
  cost: "0",
  startDate: null,
  endDate: null,
  timeZone: "America/Bogota",
  startTime: null,
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
  cost: "0",
  startDate: null,
  endDate: null,
  recurrence: null,
  interval: 1,
  daysOfWeek: null,
  startTime: null,
  endTime: null,
  archived: false,
  createdAt: new Date("2026-11-01T00:00:00"),
  updatedAt: new Date("2026-11-01T00:00:00"),
  assignments: [],
  assigneeIds: [],
  commentCount: 0,
  closedCount: 0,
  totalCost: 0,
  overdue: false,
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

describe("assigneeIdentities", () => {
  const identity = (
    userId: string,
    userName: string | null = null
  ): TaskAssigneeIdentity => ({
    userId,
    userName,
    userEmail: `${userId}@test.local`,
    userImage: null,
  })

  it("shows roster members without any assignment row — an archived task never reads Unassigned", () => {
    const shown = [identity("u1", "One")]
    const identities = assigneeIdentities(
      ["u1", "u2"],
      shown,
      shown,
      [identity("u1", "One"), identity("u2", "Two")]
    )
    expect(identities.map((i) => i.userId)).toEqual(["u1", "u2"])
    expect(identities[1].userName).toBe("Two")
  })

  it("excludes an assignment row whose user is not in the roster", () => {
    // The task_assignee roster — not open/closed assignment rows — decides
    // who the column shows; a stale row for a removed member is dropped.
    const stale = identity("u-removed", "Removed")
    const current = identity("u1", "One")
    expect(
      assigneeIdentities(["u1"], [stale, current], [stale, current], [])
    ).toEqual([current])
  })

  it("resolves an id from loaded rows before the project members", () => {
    const loaded = identity("u1", "From row")
    expect(
      assigneeIdentities(["u1"], [], [loaded], [identity("u1", "From members")])
    ).toEqual([loaded])
  })

  it("keeps an unresolvable id as an anonymous entry — a fallback avatar, never a drop", () => {
    expect(assigneeIdentities(["ghost"], [], [], [])).toEqual([
      {
        userId: "ghost",
        userName: null,
        userEmail: null,
        userImage: null,
      },
    ])
  })

  it("orders shown rows first, then the rest of the roster, without duplicates", () => {
    const first = identity("u1", "One")
    const second = identity("u2", "Two")
    const third = identity("u3", "Three")
    const identities = assigneeIdentities(
      ["u3", "u1", "u2", "u1"],
      [first, second, first],
      [first, second, third],
      []
    )
    expect(identities.map((i) => i.userId)).toEqual(["u1", "u2", "u3"])
  })

  it("returns no identities when the roster is empty, even when rows are shown", () => {
    // An empty roster means nobody is assigned; the assignment rows that
    // happen to exist belong to removed users and must not surface as
    // avatars (the table renders its Unassigned label for this case).
    const row = identity("u1", "One")
    expect(assigneeIdentities([], [row], [row], [row])).toEqual([])
  })

  it("never surfaces an id outside the roster, even with an empty fallback", () => {
    const stale = identity("u-removed", "Removed")
    expect(
      assigneeIdentities(["u1"], [stale], [stale], [stale]).map(
        (i) => i.userId
      )
    ).toEqual(["u1"])
  })

  it("shows a roster id that has no row anywhere as an anonymous entry", () => {
    const other = identity("u-other", "Other")
    const identities = assigneeIdentities(["ghost"], [other], [other], [other])
    expect(identities).toEqual([
      {
        userId: "ghost",
        userName: null,
        userEmail: null,
        userImage: null,
      },
    ])
  })

  it("renders a roster-matching task exactly as its rows", () => {
    const rows = [identity("u1", "One"), identity("u2", "Two")]
    expect(assigneeIdentities(["u1", "u2"], rows, rows, [])).toEqual(rows)
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
    const first = makeAssignment({
      id: "a-first",
      startDate: new Date(at),
    })
    const second = makeAssignment({
      id: "a-second",
      startDate: new Date(at),
    })
    const third = makeAssignment({
      id: "a-third",
      startDate: new Date(at),
    })

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

    const merged = mergeClosedRows(
      [storeRow],
      [fetchedCopy, fetchedOnly]
    )
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

describe("freshlyClosedRows", () => {
  const terminal = (id: string): TaskAssignmentDTO =>
    makeAssignment({ id, status: "done" })

  it("returns rows that went open→terminal this render and are not displayed", () => {
    const justClosed = terminal("a1")
    const other = terminal("a2")

    const fresh = freshlyClosedRows(
      new Set(["a1", "a3"]),
      [justClosed, other],
      new Set()
    )
    expect(fresh.map((row) => row.id)).toEqual(["a1"])
    expect(fresh[0]).toBe(justClosed)
  })

  it("does not return rows already displayed (absorbed earlier or fetched)", () => {
    const fresh = freshlyClosedRows(
      new Set(["a1"]),
      [terminal("a1"), terminal("a2")],
      new Set(["a1"])
    )
    expect(fresh).toEqual([])
  })

  it("does not return rows that were never open (mixed tasks' old history)", () => {
    const fresh = freshlyClosedRows(
      new Set(["a1"]),
      [terminal("a-old")],
      new Set()
    )
    expect(fresh).toEqual([])
  })

  it("returns nothing for empty inputs", () => {
    expect(freshlyClosedRows(new Set(), [], new Set())).toEqual([])
    expect(freshlyClosedRows(new Set(["a1"]), [], new Set())).toEqual(
      []
    )
    expect(
      freshlyClosedRows(new Set(), [terminal("a1")], new Set())
    ).toEqual([])
    expect(
      freshlyClosedRows(new Set(), [terminal("a1")], new Set(["a1"]))
    ).toEqual([])
  })
})

describe("selectTasks", () => {
  it("open lists non-archived tasks by endDate descending, nulls last", () => {
    const soon = makeTask({
      id: "soon",
      archived: false,
      endDate: new Date("2026-11-15T00:00:00"),
      assignments: [makeAssignment({ status: "done" })],
    })
    const later = makeTask({
      id: "later",
      archived: false,
      endDate: new Date("2026-11-20T00:00:00"),
    })
    const noDue = makeTask({
      id: "no-due",
      archived: false,
      endDate: null,
    })
    const archived = makeTask({
      id: "archived",
      archived: true,
      endDate: new Date("2026-11-01T00:00:00"),
    })

    expect(
      selectTasks([archived, later, noDue, soon], "open").map(
        (t) => t.id
      )
    ).toEqual(["later", "soon", "no-due"])
  })

  it("archived lists only archived tasks by endDate descending, nulls last", () => {
    const archivedLate = makeTask({
      id: "archived-late",
      archived: true,
      endDate: new Date("2026-11-25T00:00:00"),
    })
    const archivedNoDue = makeTask({
      id: "archived-no-due",
      archived: true,
      endDate: null,
    })
    const archivedEarly = makeTask({
      id: "archived-early",
      archived: true,
      endDate: new Date("2026-11-05T00:00:00"),
    })
    const open = makeTask({
      id: "open",
      archived: false,
      endDate: new Date("2026-11-01T00:00:00"),
    })

    expect(
      selectTasks(
        [archivedLate, open, archivedNoDue, archivedEarly],
        "archived"
      ).map((t) => t.id)
    ).toEqual(["archived-late", "archived-early", "archived-no-due"])
  })
})

describe("assignmentCounts", () => {
  it("still counts a status mix", () => {
    const rows = ["todo", "blocked", "in_review", "done"].map(
      (status) =>
        makeAssignment({
          status: status as TaskAssignmentDTO["status"],
        })
    )
    expect(assignmentCounts(rows)).toEqual({
      open: 3,
      blocked: 1,
      review: 1,
    })
  })
})
