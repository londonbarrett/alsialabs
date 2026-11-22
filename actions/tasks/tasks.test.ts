import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({ auth: vi.fn(), hasPermission: vi.fn() }))
vi.mock("@/actions/projects/util", () => ({
  resolveProjectAccess: vi.fn(),
}))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}))

const state = vi.hoisted(() => ({
  mock: null as unknown as {
    resetMocks(): void
    calls: { sql: string; params: unknown[] }[]
    onSelect(table: unknown): {
      respond(data: unknown): unknown
      respondOnce(data: unknown): { respond(data: unknown): unknown }
      respondWith(
        fn: (sql: string, params: unknown[]) => unknown
      ): unknown
    }
    onInsert(table: unknown): {
      respond(data: unknown): unknown
      respondWith(
        fn: (sql: string, params: unknown[]) => unknown
      ): unknown
    }
    onUpdate(table: unknown): {
      respond(data: unknown): unknown
      respondWith(
        fn: (sql: string, params: unknown[]) => unknown
      ): unknown
      throw(error: Error): unknown
    }
    onDelete(table: unknown): {
      respond(data: unknown): unknown
      respondWith(
        fn: (sql: string, params: unknown[]) => unknown
      ): unknown
    }
  },
}))

vi.mock("@/lib/drizzle/client", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js")
  const { mockDatabase } = await import("vitest-drizzle-mock")
  const schema = await import("@/lib/drizzle/schema")
  const db = drizzle.mock({ schema })
  state.mock = mockDatabase(db)
  return { db }
})

import * as schema from "@/lib/drizzle/schema"
import { auth } from "@/lib/auth"
import { resolveProjectAccess } from "@/actions/projects/util"
import type { ProjectRole } from "@/lib/types"
import { sumCosts } from "@/lib/tasks/cost"
import queries from "@/actions/tasks/queries"
import { assertTaskMutable } from "@/actions/tasks/util"
import { defaultIsSuccess } from "@/lib/util/action-result"
import {
  archiveTask,
  createComment,
  createTask,
  deleteComment,
  deleteTask,
  getTaskAssignmentHistory,
  getTaskComments,
  getTasks,
  unarchiveTask,
  updateAssignmentComment,
  updateAssignmentStatus,
  updateComment,
  updateTask,
  updateTaskPriority,
} from "@/actions/tasks"
import { updateAssignmentCost } from "@/actions/tasks/actions"

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>
const mockResolveAccess = vi.mocked(resolveProjectAccess)

const PROJECT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const TASK_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const ASSIGNMENT_ID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const USER_ID = "user-1"
const OTHER_ID = "user-2"
const THIRD_ID = "user-3"
const COMMENT_ID = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

function grantAccess(role: ProjectRole = "owner") {
  mockResolveAccess.mockResolvedValue({
    hasAccess: true,
    role,
  })
}

function makeTaskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    projectId: PROJECT_ID,
    name: "Fix the roof",
    description: null,
    cost: "0",
    status: "todo",
    priority: null,
    routineId: null,
    dueDate: null,
    startDate: new Date("2026-10-30T09:00:00"),
    endDate: new Date("2026-10-30T11:00:00"),
    recurrence: null,
    interval: 1,
    daysOfWeek: null,
    startTime: null,
    endTime: null,
    archived: false,
    assigneeId: null,
    createdAt: new Date("2026-10-30T08:00:00"),
    updatedAt: new Date("2026-10-30T08:00:00"),
    ...overrides,
  }
}

function makeAssignmentRow(overrides: Record<string, unknown> = {}) {
  return {
    assignmentId: ASSIGNMENT_ID,
    taskId: TASK_ID,
    userId: USER_ID,
    status: "todo",
    comment: null,
    cost: "0",
    startDate: new Date("2026-10-30T09:00:00"),
    endDate: new Date("2026-10-30T11:00:00"),
    userName: "Ada",
    userEmail: "ada@test.local",
    userImage: null,
    ...overrides,
  }
}

const validTask = {
  projectId: PROJECT_ID,
  name: "Fix the roof",
  description: "",
  priority: null,
  assigneeIds: [] as string[],
  startDate: "2026-10-30T09:00:00",
  endDate: "2026-10-30T11:00:00",
  recurrence: null,
  interval: 1,
  daysOfWeek: [] as string[],
  startTime: "",
  endTime: "",
}

function rosterIs(...userIds: string[]) {
  state.mock
    .onSelect(schema.taskAssigneesTable)
    .respond(userIds.map((userId) => ({ taskId: TASK_ID, userId })))
}

beforeEach(() => {
  vi.clearAllMocks()
  state.mock.resetMocks()
  state.mock.onSelect(schema.taskAssigneesTable).respond([])
  state.mock.onInsert(schema.taskAssigneesTable).respond([])
  state.mock.onDelete(schema.taskAssigneesTable).respond([])
  mockAuth.mockResolvedValue({
    user: { id: USER_ID, role: "user", name: "Test" },
    expires: new Date().toISOString(),
  } as never)
  grantAccess("owner")
})

describe("input validation", () => {
  it("rejects a non-uuid projectId before the action runs", async () => {
    const result = await getTasks({ projectId: "not-a-uuid" })

    expect(result.validationErrors).toBeDefined()
    expect(result.data).toBeUndefined()
    expect(result.serverError).toBeUndefined()
  })

  it("applies the task window refinements to createTask input", async () => {
    const result = await createTask({
      ...validTask,
      endDate: "2026-10-29T11:00:00",
    })

    expect(result.validationErrors).toBeDefined()
    expect(result.data).toBeUndefined()
    expect(result.serverError).toBeUndefined()
  })
})

describe("getTasks", () => {
  it("returns tasks with their assignments", async () => {
    state.mock.onSelect(schema.tasksTable).respond([makeTaskRow()])
    state.mock
      .onSelect(schema.taskAssignmentLatestView)
      .respond([makeAssignmentRow()])
    state.mock.onSelect(schema.taskCommentsTable).respond([])
    state.mock
      .onSelect(schema.taskAssignmentsTable)
      .respond([{ taskId: TASK_ID, cnt: 3 }])

    const result = await getTasks({ projectId: PROJECT_ID })

    expect(result.serverError).toBeUndefined()
    expect(result.data?.[0]?.assignments).toHaveLength(1)
    expect(result.data?.[0]?.assignments[0]?.userId).toBe(USER_ID)
    // The status cell's total comes from the terminal-row count query,
    // not from the loaded (recurrence-aware) rows.
    expect(result.data?.[0]?.closedCount).toBe(3)
  })

  it("sums every assignment's cost into totalCost including cancelled rows", async () => {
    // The aggregate has no status filter: cancelled/hidden rows still count.
    const everyAssignment = [
      { taskId: TASK_ID, cost: "50", status: "todo" },
      { taskId: TASK_ID, cost: "70", status: "done" },
      { taskId: TASK_ID, cost: "30", status: "cancelled" },
    ]
    const expected = sumCosts(everyAssignment)
    state.mock.onSelect(schema.tasksTable).respond([makeTaskRow()])
    state.mock
      .onSelect(schema.taskAssignmentLatestView)
      .respond([makeAssignmentRow()])
    state.mock.onSelect(schema.taskCommentsTable).respond([])
    state.mock
      .onSelect(schema.taskAssignmentsTable)
      .respondWith((sql) =>
        sql.includes("sum(")
          ? [{ taskId: TASK_ID, total: expected }]
          : [{ taskId: TASK_ID, cnt: 3 }]
      )
    const before = state.mock.calls.length

    const result = await getTasks({ projectId: PROJECT_ID })

    expect(result.serverError).toBeUndefined()
    expect(result.data?.[0]?.totalCost).toBe(150)
    const costSql =
      state.mock.calls
        .slice(before)
        .find((c) => c.sql.includes("sum("))?.sql ?? ""
    expect(costSql).not.toContain("status")
  })

  it("carries the archived flag and the assignee roster", async () => {
    state.mock
      .onSelect(schema.tasksTable)
      .respond([makeTaskRow({ archived: true })])
    state.mock.onSelect(schema.taskAssignmentDetailView).respond([])
    state.mock.onSelect(schema.taskCommentsTable).respond([])
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])
    state.mock.onSelect(schema.taskAssigneesTable).respond([
      { taskId: TASK_ID, userId: USER_ID },
      { taskId: TASK_ID, userId: OTHER_ID },
    ])

    const result = await getTasks({ projectId: PROJECT_ID })

    expect(result.serverError).toBeUndefined()
    expect(result.data?.[0]).toMatchObject({
      archived: true,
      assigneeIds: [USER_ID, OTHER_ID],
    })
  })

  it("reads the full assignment history from the detail view for non-repeating tasks", async () => {
    const before = state.mock.calls.length
    state.mock.onSelect(schema.tasksTable).respond([makeTaskRow()])
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respond([
        makeAssignmentRow(),
        makeAssignmentRow({ assignmentId: "other", status: "done" }),
      ])
    state.mock.onSelect(schema.taskCommentsTable).respond([])
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])

    const result = await getTasks({ projectId: PROJECT_ID })

    expect(result.serverError).toBeUndefined()
    expect(result.data?.[0]?.assignments).toHaveLength(2)
    expect(result.data?.[0]?.closedCount).toBe(0)
    const viewSql = state.mock.calls
      .slice(before)
      .map((call) => call.sql)
      .join(" ")
    expect(viewSql).toContain('"task_assignment_detail"')
    expect(viewSql).not.toContain('"task_assignment_latest"')
  })

  it("reads one row per assignee from the latest view for repeating tasks", async () => {
    const before = state.mock.calls.length
    state.mock
      .onSelect(schema.tasksTable)
      .respond([makeTaskRow({ recurrence: "daily" })])
    state.mock
      .onSelect(schema.taskAssignmentLatestView)
      .respond([makeAssignmentRow()])
    state.mock.onSelect(schema.taskCommentsTable).respond([])
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])

    const result = await getTasks({ projectId: PROJECT_ID })

    expect(result.serverError).toBeUndefined()
    expect(result.data?.[0]?.assignments).toHaveLength(1)
    const viewSql = state.mock.calls
      .slice(before)
      .map((call) => call.sql)
      .join(" ")
    expect(viewSql).toContain('"task_assignment_latest"')
    expect(viewSql).not.toContain('"task_assignment_detail"')
  })

  it("forbids a collaborator from the project task list", async () => {
    grantAccess("collaborator")
    const result = await getTasks({ projectId: PROJECT_ID })
    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })
})

describe("createTask", () => {
  it("creates a task and returns its assignments", async () => {
    const assignment = makeAssignmentRow()
    state.mock.onSelect(schema.tasksTable).respond([makeTaskRow()])
    state.mock
      .onSelect(schema.taskAssignmentLatestView)
      .respond([assignment])
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])
    state.mock.onInsert(schema.tasksTable).respond([makeTaskRow()])

    const result = await createTask(validTask)

    expect(result.serverError).toBeUndefined()
    expect(result.data?.id).toBe(TASK_ID)
    expect(result.data?.closedCount).toBe(0)
  })

  it("createTask result includes totalCost from the loaded task", async () => {
    state.mock.onSelect(schema.tasksTable).respond([makeTaskRow()])
    state.mock.onSelect(schema.taskAssignmentLatestView).respond([])
    state.mock
      .onSelect(schema.taskAssignmentsTable)
      .respondWith((sql) =>
        sql.includes("sum(") ? [{ taskId: TASK_ID, total: 150 }] : []
      )
    state.mock.onInsert(schema.tasksTable).respond([makeTaskRow()])

    const result = await createTask(validTask)

    expect(result.serverError).toBeUndefined()
    expect(result.data?.totalCost).toBe(150)
  })

  it("inserts one membership row per unique assignee before their assignments", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: USER_ID }])
    state.mock
      .onSelect(schema.projectMembershipTable)
      .respond([{ userId: OTHER_ID }])
    state.mock.onSelect(schema.tasksTable).respond([makeTaskRow()])
    state.mock.onSelect(schema.taskAssignmentLatestView).respond([])
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])
    state.mock.onInsert(schema.tasksTable).respond([makeTaskRow()])
    state.mock
      .onInsert(schema.taskAssignmentsTable)
      .respond([{ id: "new-assignment" }])
    const before = state.mock.calls.length

    const result = await createTask({
      ...validTask,
      assigneeIds: [OTHER_ID, OTHER_ID],
    })

    expect(result.serverError).toBeUndefined()
    const sqls = state.mock.calls.slice(before).map((c) => c.sql)
    const membershipAt = sqls.findIndex((q) =>
      q.includes('insert into "task_assignee"')
    )
    const assignmentAt = sqls.findIndex((q) =>
      q.includes('insert into "task_assignment"')
    )
    expect(membershipAt).toBeGreaterThanOrEqual(0)
    expect(assignmentAt).toBeGreaterThan(membershipAt)
    const membership = state.mock.calls
      .slice(before)
      .filter((c) => c.sql.includes('insert into "task_assignee"'))
    expect(membership).toHaveLength(1)
    expect(
      membership[0].params.filter((p) => p === OTHER_ID)
    ).toHaveLength(1)
  })

  it("copies the task's default cost onto assignments created with the task", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: USER_ID }])
    state.mock
      .onSelect(schema.projectMembershipTable)
      .respond([{ userId: USER_ID }])
    state.mock.onSelect(schema.tasksTable).respond([makeTaskRow()])
    state.mock.onSelect(schema.taskAssignmentDetailView).respond([])
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])
    state.mock
      .onInsert(schema.tasksTable)
      .respond([makeTaskRow({ cost: "120" })])
    state.mock
      .onInsert(schema.taskAssignmentsTable)
      .respond([{ id: "new-assignment" }])
    const before = state.mock.calls.length

    const result = await createTask({
      ...validTask,
      cost: "120",
      assigneeIds: [USER_ID],
    })

    expect(result.serverError).toBeUndefined()
    const inserts = state.mock.calls
      .slice(before)
      .filter((c) => c.sql.includes('insert into "task_assignment"'))
    expect(inserts).toHaveLength(1)
    expect(inserts[0].params).toContain("120")
  })

  it("rejects an assignee outside the project", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: "owner-1" }])
    state.mock.onSelect(schema.projectMembershipTable).respond([])

    const result = await createTask({
      ...validTask,
      assigneeIds: [OTHER_ID],
    })

    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })

  it("forbids a collaborator", async () => {
    grantAccess("collaborator")
    const result = await createTask(validTask)
    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })
})

describe("updateTask", () => {
  it("diffs against membership and closes only the removed member's open row", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: USER_ID }])
    state.mock
      .onSelect(schema.projectMembershipTable)
      .respond([{ userId: "user-3" }])
    state.mock.onUpdate(schema.tasksTable).respond([makeTaskRow()])
    rosterIs(USER_ID)
    let openSql = ""
    // One table, three shapes: the open-assignments diff read, the
    // terminal-count read and the cost-total aggregate — routed by SQL.
    state.mock
      .onSelect(schema.taskAssignmentsTable)
      .respondWith((sql) => {
        if (sql.includes("count(") || sql.includes("sum(")) return []
        openSql = sql
        return [{ id: "open-assignment", userId: USER_ID }]
      })
    let updateParams: unknown[] = []
    state.mock
      .onUpdate(schema.taskAssignmentsTable)
      .respondWith((_sql, params) => {
        updateParams = params
        return []
      })
    let insertParams: unknown[] = []
    state.mock
      .onInsert(schema.taskAssignmentsTable)
      .respondWith((_sql, params) => {
        insertParams = params
        return [{ id: "new-assignment" }]
      })
    state.mock.onSelect(schema.tasksTable).respond([makeTaskRow()])
    state.mock.onSelect(schema.taskAssignmentLatestView).respond([])

    const result = await updateTask({
      ...validTask,
      taskId: TASK_ID,
      assigneeIds: ["user-3"],
    })

    expect(result.serverError).toBeUndefined()
    // Only open rows are closed; the query filters terminal ones out.
    expect(openSql).toContain("not in")
    expect(updateParams).toContain("open-assignment")
    expect(updateParams).toContain("cancelled")
    expect(insertParams).toContain("user-3")
  })

  it("closes removed rows with the requested disposition", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: USER_ID }])
    state.mock
      .onSelect(schema.projectMembershipTable)
      .respond([{ userId: USER_ID }])
    state.mock.onUpdate(schema.tasksTable).respond([makeTaskRow()])
    rosterIs(USER_ID)
    state.mock
      .onSelect(schema.taskAssignmentsTable)
      .respond([{ id: "open-assignment", userId: USER_ID }])
    let updateParams: unknown[] = []
    state.mock
      .onUpdate(schema.taskAssignmentsTable)
      .respondWith((_sql, params) => {
        updateParams = params
        return []
      })
    state.mock.onSelect(schema.tasksTable).respond([makeTaskRow()])
    state.mock.onSelect(schema.taskAssignmentLatestView).respond([])

    const result = await updateTask({
      ...validTask,
      taskId: TASK_ID,
      assigneeIds: [],
      unassignAs: { [USER_ID]: "done" },
    })

    expect(result.serverError).toBeUndefined()
    expect(updateParams).toContain("done")
    expect(updateParams).toContain("open-assignment")
  })

  it("groups removals by disposition, one update per group", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: USER_ID }])
    state.mock
      .onSelect(schema.projectMembershipTable)
      .respond([{ userId: USER_ID }])
    state.mock.onUpdate(schema.tasksTable).respond([makeTaskRow()])
    rosterIs(USER_ID, OTHER_ID)
    state.mock.onSelect(schema.taskAssignmentsTable).respond([
      { id: "open-assignment", userId: USER_ID },
      { id: "other-assignment", userId: OTHER_ID },
    ])
    const updateCalls: unknown[][] = []
    state.mock
      .onUpdate(schema.taskAssignmentsTable)
      .respondWith((_sql, params) => {
        updateCalls.push(params)
        return []
      })
    state.mock.onSelect(schema.tasksTable).respond([makeTaskRow()])
    state.mock.onSelect(schema.taskAssignmentLatestView).respond([])

    const result = await updateTask({
      ...validTask,
      taskId: TASK_ID,
      assigneeIds: [],
      unassignAs: {
        [USER_ID]: "done",
        [OTHER_ID]: "cancelled",
      },
    })

    expect(result.serverError).toBeUndefined()
    // Two open rows, two dispositions → exactly two UPDATEs, each id
    // closed with its own status.
    expect(updateCalls).toHaveLength(2)
    const doneCall = updateCalls.find((params) =>
      params.includes("open-assignment")
    )
    const cancelledCall = updateCalls.find((params) =>
      params.includes("other-assignment")
    )
    expect(doneCall).toContain("done")
    expect(cancelledCall).toContain("cancelled")
  })

  it("closes removed rows as cancelled when no disposition is sent", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: USER_ID }])
    state.mock
      .onSelect(schema.projectMembershipTable)
      .respond([{ userId: USER_ID }])
    state.mock.onUpdate(schema.tasksTable).respond([makeTaskRow()])
    rosterIs(USER_ID)
    state.mock
      .onSelect(schema.taskAssignmentsTable)
      .respond([{ id: "open-assignment", userId: USER_ID }])
    let updateParams: unknown[] = []
    state.mock
      .onUpdate(schema.taskAssignmentsTable)
      .respondWith((_sql, params) => {
        updateParams = params
        return []
      })
    state.mock.onSelect(schema.tasksTable).respond([makeTaskRow()])
    state.mock.onSelect(schema.taskAssignmentLatestView).respond([])

    const result = await updateTask({
      ...validTask,
      taskId: TASK_ID,
      assigneeIds: [],
    })

    expect(result.serverError).toBeUndefined()
    expect(updateParams).toContain("cancelled")
  })

  it("performs no insert when only removing", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: USER_ID }])
    state.mock
      .onSelect(schema.projectMembershipTable)
      .respond([{ userId: USER_ID }])
    state.mock.onUpdate(schema.tasksTable).respond([makeTaskRow()])
    rosterIs(USER_ID)
    state.mock
      .onSelect(schema.taskAssignmentsTable)
      .respond([{ id: "open-assignment", userId: USER_ID }])
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
    let insertCount = 0
    state.mock
      .onInsert(schema.taskAssignmentsTable)
      .respondWith(() => {
        insertCount += 1
        return [{ id: "new-assignment" }]
      })
    state.mock.onSelect(schema.tasksTable).respond([makeTaskRow()])
    state.mock.onSelect(schema.taskAssignmentLatestView).respond([])

    const result = await updateTask({
      ...validTask,
      taskId: TASK_ID,
      assigneeIds: [],
      unassignAs: { [USER_ID]: "cancelled" },
    })

    expect(result.serverError).toBeUndefined()
    expect(insertCount).toBe(0)
  })

  it("collapses duplicate assignee ids into a single insert", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: USER_ID }])
    state.mock
      .onSelect(schema.projectMembershipTable)
      .respond([{ userId: USER_ID }])
    state.mock.onUpdate(schema.tasksTable).respond([makeTaskRow()])
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])
    let insertParams: unknown[] = []
    state.mock
      .onInsert(schema.taskAssignmentsTable)
      .respondWith((_sql, params) => {
        insertParams = params
        return [{ id: "new-assignment" }]
      })
    state.mock.onSelect(schema.tasksTable).respond([makeTaskRow()])
    state.mock.onSelect(schema.taskAssignmentLatestView).respond([])

    const result = await updateTask({
      ...validTask,
      taskId: TASK_ID,
      assigneeIds: [USER_ID, USER_ID],
    })

    expect(result.serverError).toBeUndefined()
    const occurrences =
      JSON.stringify(insertParams).split(USER_ID).length - 1
    expect(occurrences).toBe(1)
  })

  describe("membership sync", () => {
    const FUTURE_END = "2099-01-01T00:00:00"
    const futureRepeating = (overrides: Record<string, unknown> = {}) =>
      makeTaskRow({
        recurrence: "daily",
        startTime: "09:00",
        endTime: "11:00",
        startDate: new Date("2026-10-30T09:00:00"),
        endDate: new Date(FUTURE_END),
        ...overrides,
      })
    const repeatingInput = (endDate = FUTURE_END) => ({
      ...validTask,
      taskId: TASK_ID,
      recurrence: "daily" as const,
      startTime: "09:00",
      endTime: "11:00",
      endDate,
    })

    let callsBefore = 0
    beforeEach(() => {
      callsBefore = state.mock.calls.length
      state.mock
        .onSelect(schema.projectsTable)
        .respond([{ primaryOwnerId: USER_ID }])
      state.mock
        .onSelect(schema.projectMembershipTable)
        .respond([{ userId: USER_ID }, { userId: OTHER_ID }])
      state.mock.onSelect(schema.taskAssignmentsTable).respond([])
      state.mock.onSelect(schema.taskAssignmentLatestView).respond([])
      state.mock
        .onInsert(schema.taskAssignmentsTable)
        .respond([{ id: "new-assignment" }])
    })

    const callsMatching = (fragment: string) =>
      state.mock.calls
        .slice(callsBefore)
        .filter((c) => c.sql.includes(fragment))

    it("a new member of a repeating task gets membership plus a range-checked open row", async () => {
      state.mock
        .onUpdate(schema.tasksTable)
        .respond([futureRepeating()])
      state.mock.onSelect(schema.tasksTable).respond([futureRepeating()])
      state.mock
        .onSelect(schema.taskAssigneesTable)
        .respondWith((sql) =>
          sql.includes("inner join")
            ? [{ userId: OTHER_ID }]
            : []
        )

      const result = await updateTask({
        ...repeatingInput(),
        assigneeIds: [OTHER_ID],
      })

      expect(result.serverError).toBeUndefined()
      const membership = callsMatching('insert into "task_assignee"')
      expect(membership).toHaveLength(1)
      expect(membership[0].params).toContain(OTHER_ID)
      const opened = callsMatching('insert into "task_assignment"')
      expect(opened).toHaveLength(1)
      expect(opened[0].params).toContain(OTHER_ID)
      expect(opened[0].params).toContain("todo")
    })

    it("a new member of a repeating task past its end date gets membership only", async () => {
      const ended = futureRepeating({
        endDate: new Date("2020-01-01T00:00:00"),
      })
      state.mock.onUpdate(schema.tasksTable).respond([ended])
      state.mock.onSelect(schema.tasksTable).respond([ended])
      state.mock
        .onSelect(schema.taskAssigneesTable)
        .respondWith((sql) =>
          sql.includes("inner join")
            ? [{ userId: OTHER_ID }]
            : []
        )

      const result = await updateTask({
        ...repeatingInput("2020-01-01T00:00:00"),
        startDate: "2019-01-01T00:00:00",
        assigneeIds: [OTHER_ID],
      })

      expect(result.serverError).toBeUndefined()
      expect(callsMatching('insert into "task_assignee"')).toHaveLength(1)
      expect(callsMatching('insert into "task_assignment"')).toHaveLength(0)
    })

    it("a new member of a non-repeating task gets membership plus a firstAssignmentWindow row", async () => {
      const row = makeTaskRow({
        startDate: new Date("2020-01-01T09:00:00"),
        endDate: new Date("2020-01-01T11:00:00"),
      })
      state.mock.onUpdate(schema.tasksTable).respond([row])
      state.mock.onSelect(schema.tasksTable).respond([row])
      state.mock.onSelect(schema.taskAssigneesTable).respond([])

      const result = await updateTask({
        ...validTask,
        taskId: TASK_ID,
        assigneeIds: [OTHER_ID],
      })

      expect(result.serverError).toBeUndefined()
      expect(callsMatching('insert into "task_assignee"')).toHaveLength(1)
      const opened = callsMatching('insert into "task_assignment"')
      expect(opened).toHaveLength(1)
      expect(opened[0].params).toContain(OTHER_ID)
      expect(opened[0].params).toContain("todo")
    })

    it("a removed member loses membership and their open row closes with unassignAs", async () => {
      state.mock.onUpdate(schema.tasksTable).respond([makeTaskRow()])
      state.mock.onSelect(schema.tasksTable).respond([makeTaskRow()])
      rosterIs(OTHER_ID)
      state.mock
        .onSelect(schema.taskAssignmentsTable)
        .respond([{ id: "open-other", userId: OTHER_ID }])
      state.mock.onUpdate(schema.taskAssignmentsTable).respond([])

      const result = await updateTask({
        ...validTask,
        taskId: TASK_ID,
        assigneeIds: [],
        unassignAs: { [OTHER_ID]: "done" },
      })

      expect(result.serverError).toBeUndefined()
      const deletes = callsMatching('delete from "task_assignee"')
      expect(deletes).toHaveLength(1)
      expect(deletes[0].params).toContain(OTHER_ID)
      expect(deletes[0].params).toContain(TASK_ID)
      const closes = callsMatching('update "task_assignment"')
      expect(closes).toHaveLength(1)
      expect(closes[0].params).toContain("done")
      expect(closes[0].params).toContain("open-other")
      expect(callsMatching('delete from "task_assignment"')).toHaveLength(0)
    })

    it("a removed member with no open row only loses membership", async () => {
      state.mock.onUpdate(schema.tasksTable).respond([makeTaskRow()])
      state.mock.onSelect(schema.tasksTable).respond([makeTaskRow()])
      rosterIs(OTHER_ID)

      const result = await updateTask({
        ...validTask,
        taskId: TASK_ID,
        assigneeIds: [],
      })

      expect(result.serverError).toBeUndefined()
      expect(callsMatching('delete from "task_assignee"')).toHaveLength(1)
      expect(callsMatching('update "task_assignment"')).toHaveLength(0)
    })

    it("an existing member with no open row gets no insert on a plain save", async () => {
      state.mock.onUpdate(schema.tasksTable).respond([makeTaskRow()])
      state.mock.onSelect(schema.tasksTable).respond([makeTaskRow()])
      rosterIs(OTHER_ID)

      const result = await updateTask({
        ...validTask,
        taskId: TASK_ID,
        assigneeIds: [OTHER_ID],
      })

      expect(result.serverError).toBeUndefined()
      expect(callsMatching('insert into "task_assignment"')).toHaveLength(0)
      expect(callsMatching('insert into "task_assignee"')).toHaveLength(0)
      expect(callsMatching('delete from "task_assignee"')).toHaveLength(0)
    })
  })

  describe("date-edit spawn", () => {
    // The spawn anchors on the later of the start date and now, so the clock
    // is frozen to keep every fixture deterministic.
    const FROZEN_NOW = new Date("2026-11-20T08:00:00")

    let callsBefore = 0
    beforeEach(() => {
      callsBefore = state.mock.calls.length
      vi.useFakeTimers({ toFake: ["Date"] })
      vi.setSystemTime(FROZEN_NOW)
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    function insertedTimes(params: unknown[]): number[] {
      return params
        .filter((p): p is string => typeof p === "string")
        .map((p) => Date.parse(p))
        .filter((t) => !Number.isNaN(t))
    }

    const assignmentInserts = (since = callsBefore) =>
      state.mock.calls
        .slice(since)
        .filter((c) => c.sql.includes('insert into "task_assignment"'))

    /**
     * The pre-read and the helper's task read both come from the SELECT
     * responder (the previous row); the UPDATE responder carries the window
     * the caller just saved. `previous.recurrence` and `previous.endDate`
     * are what trigger (b) gates on.
     */
    function dateEditFixtures(previous: Record<string, unknown>) {
      state.mock
        .onSelect(schema.projectsTable)
        .respond([{ primaryOwnerId: USER_ID }])
      state.mock
        .onSelect(schema.projectMembershipTable)
        .respond([{ userId: USER_ID }])
      state.mock
        .onUpdate(schema.tasksTable)
        .respond([
          makeTaskRow({
            ...previous,
            endDate: new Date("2099-01-01T00:00:00"),
          }),
        ])
      state.mock.onSelect(schema.tasksTable).respond([makeTaskRow(previous)])
      state.mock.onSelect(schema.taskAssignmentLatestView).respond([])
      state.mock.onSelect(schema.taskAssignmentDetailView).respond([])
    }

    it("a due-date change on a repeating task spawns for an active member with no open row, anchored on now when the start date is long past", async () => {
      dateEditFixtures({
        recurrence: "daily",
        startTime: "09:00",
        endTime: "11:00",
        startDate: new Date("2026-11-16T09:00:00"),
        endDate: new Date("2026-11-30T23:59:59"),
      })
      rosterIs(USER_ID)
      state.mock.onSelect(schema.taskAssignmentsTable).respond([])
      state.mock
        .onInsert(schema.taskAssignmentsTable)
        .respond([{ id: "spawned-1" }])

      const result = await updateTask({
        ...validTask,
        taskId: TASK_ID,
        assigneeIds: [USER_ID],
        recurrence: "daily",
        startTime: "09:00",
        endTime: "11:00",
        startDate: "2026-11-16T09:00:00",
        endDate: "2099-01-01T00:00:00",
      })

      expect(result.serverError).toBeUndefined()
      const inserts = assignmentInserts()
      expect(inserts).toHaveLength(1)
      expect(inserts[0].params).toContain(USER_ID)
      expect(inserts[0].params).toContain("todo")
      // The start date (11-16) is in the past: the anchor is now, so the
      // occurrence is the next slot on or after now — never a backdated one.
      const dates = insertedTimes(inserts[0].params)
      expect(dates).toContain(new Date("2026-11-20T09:00:00").getTime())
      expect(dates).toContain(new Date("2026-11-20T11:00:00").getTime())
      expect(dates).not.toContain(new Date("2026-11-17T09:00:00").getTime())
    })

    it("a spawned assignment inherits the task's edited cost, not a stale default", async () => {
      // The helper re-reads the task inside its transaction; the updated row
      // carries the new default, so the successor snapshots "200".
      dateEditFixtures({
        recurrence: "daily",
        startTime: "09:00",
        endTime: "11:00",
        startDate: new Date("2026-11-16T09:00:00"),
        endDate: new Date("2026-11-30T23:59:59"),
        cost: "200",
      })
      rosterIs(USER_ID)
      state.mock.onSelect(schema.taskAssignmentsTable).respond([])
      state.mock
        .onInsert(schema.taskAssignmentsTable)
        .respond([{ id: "spawned-1" }])

      const result = await updateTask({
        ...validTask,
        taskId: TASK_ID,
        cost: "200",
        assigneeIds: [USER_ID],
        recurrence: "daily",
        startTime: "09:00",
        endTime: "11:00",
        startDate: "2026-11-16T09:00:00",
        endDate: "2099-01-01T00:00:00",
      })

      expect(result.serverError).toBeUndefined()
      const [insert] = assignmentInserts()
      expect(insert.params).toContain("200")
    })

    it("a future start date anchors the spawn inclusively, so an occurrence on that date is kept", async () => {
      dateEditFixtures({
        recurrence: "daily",
        startTime: "09:00",
        endTime: "11:00",
        startDate: new Date("2026-11-16T09:00:00"),
        endDate: new Date("2026-11-30T23:59:59"),
      })
      rosterIs(USER_ID)
      state.mock.onSelect(schema.taskAssignmentsTable).respond([])
      state.mock
        .onInsert(schema.taskAssignmentsTable)
        .respond([{ id: "spawned-1" }])

      const result = await updateTask({
        ...validTask,
        taskId: TASK_ID,
        assigneeIds: [USER_ID],
        recurrence: "daily",
        startTime: "09:00",
        endTime: "11:00",
        startDate: "2026-11-25T09:00:00",
        endDate: "2099-01-01T00:00:00",
      })

      expect(result.serverError).toBeUndefined()
      const [insert] = assignmentInserts()
      const dates = insertedTimes(insert.params)
      expect(dates).toContain(new Date("2026-11-25T09:00:00").getTime())
      expect(dates).toContain(new Date("2026-11-25T11:00:00").getTime())
    })

    it("a plain save after unarchive never reopens work: the archived due date round-trips unchanged", async () => {
      // Seconds and milliseconds on the clock: a raw-clock due date would not
      // survive the form's minute-precision round trip.
      vi.setSystemTime(new Date("2026-11-20T08:00:11.456"))
      const toFormValue = (date: Date) => {
        const pad = (n: number) => `${n}`.padStart(2, "0")
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
      }

      // Archive preserves the original due date and time — a timed task and
      // an all-day task each keep what they had.
      for (const original of [
        new Date("2026-12-31T17:30:00"),
        new Date("2026-12-31T00:00:00"),
      ]) {
        const stored = original
        const baseline = state.mock.calls.length
        dateEditFixtures({
          recurrence: "daily",
          startTime: "09:00",
          endTime: "11:00",
          startDate: new Date("2026-11-02T09:00:00"),
          endDate: stored,
        })
        rosterIs(USER_ID)
        state.mock.onSelect(schema.taskAssignmentsTable).respond([])
        state.mock
          .onInsert(schema.taskAssignmentsTable)
          .respond([{ id: "should-not-happen" }])

        const result = await updateTask({
          ...validTask,
          taskId: TASK_ID,
          name: "Renamed",
          assigneeIds: [USER_ID],
          recurrence: "daily",
          startTime: "09:00",
          endTime: "11:00",
          startDate: "2026-11-02T09:00:00",
          endDate: toFormValue(stored),
        })

        expect(result.serverError).toBeUndefined()
        expect(assignmentInserts(baseline)).toHaveLength(0)
      }
    })

    it("a due-date change skips a member with an open row, a removed assignee, an unchanged date, a non-repeating task, and an out-of-range occurrence", async () => {
      const repeating = {
        recurrence: "daily",
        startTime: "09:00",
        endTime: "11:00",
        startDate: new Date("2026-11-16T09:00:00"),
        endDate: new Date("2026-11-30T23:59:59"),
      }
      const repeatingInput = {
        recurrence: "daily" as const,
        startTime: "09:00",
        endTime: "11:00",
        startDate: "2026-11-16T09:00:00",
        endDate: "2099-01-01T00:00:00",
      }
      const cases: {
        name: string
        previous: Record<string, unknown>
        input: Record<string, unknown>
        roster: string[]
        openRows: Record<string, unknown>[]
      }[] = [
        {
          name: "a member with an open row",
          previous: repeating,
          input: { ...repeatingInput, assigneeIds: [USER_ID] },
          roster: [USER_ID],
          openRows: [{ id: ASSIGNMENT_ID, userId: USER_ID }],
        },
        {
          name: "a removed assignee",
          previous: repeating,
          input: { ...repeatingInput, assigneeIds: [] },
          roster: [],
          openRows: [],
        },
        {
          name: "an unchanged date",
          previous: repeating,
          input: {
            ...repeatingInput,
            endDate: "2026-11-30T23:59:59",
            assigneeIds: [USER_ID],
          },
          roster: [USER_ID],
          openRows: [],
        },
        {
          name: "a non-repeating task",
          previous: {
            startDate: new Date("2026-11-16T09:00:00"),
            endDate: new Date("2026-11-30T23:59:59"),
          },
          input: {
            startDate: "2026-11-16T09:00:00",
            endDate: "2026-11-16T11:00:00",
            assigneeIds: [USER_ID],
          },
          roster: [USER_ID],
          openRows: [],
        },
        {
          name: "an out-of-range occurrence",
          previous: {
            ...repeating,
            endDate: new Date("2026-11-10T23:59:59"),
          },
          input: { ...repeatingInput, assigneeIds: [USER_ID] },
          roster: [USER_ID],
          openRows: [],
        },
      ]

      for (const testCase of cases) {
        const baseline = state.mock.calls.length
        dateEditFixtures(testCase.previous)
        rosterIs(...testCase.roster)
        state.mock
          .onSelect(schema.taskAssignmentsTable)
          .respond(testCase.openRows)
        state.mock
          .onInsert(schema.taskAssignmentsTable)
          .respond([{ id: "should-not-happen" }])

        const result = await updateTask({
          ...validTask,
          taskId: TASK_ID,
          ...testCase.input,
        })

        expect(result.serverError, testCase.name).toBeUndefined()
        expect(assignmentInserts(baseline), testCase.name).toHaveLength(0)
      }
    })
  })

  it("edits an archived task without filtering its row on archived", async () => {
    const baseline = state.mock.calls.length
    const archived = makeTaskRow({ archived: true })
    state.mock.onSelect(schema.tasksTable).respond([archived])
    state.mock.onUpdate(schema.tasksTable).respond([archived])
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])
    state.mock.onSelect(schema.taskAssignmentDetailView).respond([])

    const result = await updateTask({ ...validTask, taskId: TASK_ID })

    expect(result.serverError).toBeUndefined()
    const update = state.mock.calls
      .slice(baseline)
      .find((c) => c.sql.includes('update "task" set'))
    expect(update?.sql).not.toMatch(/"task"\."archived"/)
    expect(update?.sql).not.toMatch(/"archived" =/)
  })

  it("forbids a collaborator", async () => {
    grantAccess("collaborator")
    const result = await updateTask({ ...validTask, taskId: TASK_ID })
    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })
})

describe("updateAssignmentStatus", () => {
  function mockAssignmentRow(status = "todo", userId = USER_ID) {
    state.mock
      .onSelect(schema.taskAssignmentsTable)
      .respond([{ id: ASSIGNMENT_ID, userId, status }])
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respond([makeAssignmentRow({ status: "in_progress" })])
  }

  it("lets a manager set done on any assignment", async () => {
    state.mock
      .onSelect(schema.taskAssignmentsTable)
      .respond([
        { id: ASSIGNMENT_ID, userId: OTHER_ID, status: "todo" },
      ])
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respond([makeAssignmentRow({ status: "done" })])

    const result = await updateAssignmentStatus({
      projectId: PROJECT_ID,
      assignmentId: ASSIGNMENT_ID,
      status: "done",
    })

    expect(result.serverError).toBeUndefined()
    expect(result.data?.assignment.status).toBe("done")
  })

  it("lets an assignee move their open assignment", async () => {
    mockAssignmentRow("todo", USER_ID)
    grantAccess("collaborator")

    const result = await updateAssignmentStatus({
      projectId: PROJECT_ID,
      assignmentId: ASSIGNMENT_ID,
      status: "in_progress",
    })

    expect(result.serverError).toBeUndefined()
  })

  it("forbids a collaborator from setting done", async () => {
    mockAssignmentRow("todo", USER_ID)
    grantAccess("collaborator")

    const result = await updateAssignmentStatus({
      projectId: PROJECT_ID,
      assignmentId: ASSIGNMENT_ID,
      status: "done",
    })

    expect(result.serverError).toEqual({ code: "VALIDATION_FAILED" })
  })

  it("locks a terminal assignment for a collaborator", async () => {
    mockAssignmentRow("done", USER_ID)
    grantAccess("collaborator")

    const result = await updateAssignmentStatus({
      projectId: PROJECT_ID,
      assignmentId: ASSIGNMENT_ID,
      status: "in_progress",
    })

    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })

  it("closing the latest assignment still spawns its successor with the closing row's date as anchor", async () => {
    // The helper re-reads the task in-tx: recurring, in range through
    // 2026-11-30, so the successor lands the day after the closing row.
    state.mock.onSelect(schema.tasksTable).respond([
      makeTaskRow({
        recurrence: "daily",
        interval: 1,
        daysOfWeek: null,
        startTime: "09:00",
        endTime: "11:00",
        endDate: new Date("2026-11-30T23:59:59"),
        archived: false,
      }),
    ])
    rosterIs(USER_ID)
    state.mock.onSelect(schema.taskAssignmentsTable).respondWith((sql) => {
      if (sql.includes("exists")) return []
      if (sql.includes("not in")) return []
      return [
        {
          id: ASSIGNMENT_ID,
          userId: USER_ID,
          status: "todo",
          endDate: new Date("2026-10-30T11:00:00"),
          taskId: TASK_ID,
          recurrence: "daily",
          interval: 1,
          daysOfWeek: null,
          startTime: "09:00",
          endTime: "11:00",
          archived: false,
        },
      ]
    })
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
    state.mock
      .onInsert(schema.taskAssignmentsTable)
      .respond([{ id: "next-assignment" }])
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respondWith((_sql, params) =>
        params[0] === ASSIGNMENT_ID
          ? [makeAssignmentRow({ status: "done" })]
          : [
              makeAssignmentRow({
                assignmentId: "next-assignment",
                status: "todo",
              }),
            ]
      )

    const baseline = state.mock.calls.length
    const result = await updateAssignmentStatus({
      projectId: PROJECT_ID,
      assignmentId: ASSIGNMENT_ID,
      status: "done",
    })

    expect(result.serverError).toBeUndefined()
    expect(result.data?.nextAssignment?.id).toBe("next-assignment")
    // anchor = row.endDate (2026-10-30T11:00) → next daily slot after it.
    const inserts = state.mock.calls
      .slice(baseline)
      .filter((c) => c.sql.includes('insert into "task_assignment"'))
    expect(inserts).toHaveLength(1)
    const dates = inserts[0].params
      .filter((p): p is string => typeof p === "string")
      .map((p) => Date.parse(p))
      .filter((t) => !Number.isNaN(t))
    expect(dates).toContain(new Date("2026-10-31T09:00:00").getTime())
    expect(dates).toContain(new Date("2026-10-31T11:00:00").getTime())
  })

  it("spawns nothing for a non-repeating task", async () => {
    state.mock.onSelect(schema.taskAssignmentsTable).respond([
      {
        id: ASSIGNMENT_ID,
        userId: USER_ID,
        status: "todo",
        endDate: new Date("2026-10-30T11:00:00"),
        taskId: TASK_ID,
        recurrence: null,
        interval: 1,
        daysOfWeek: null,
        startTime: null,
        endTime: null,
      },
    ])
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respond([makeAssignmentRow({ status: "done" })])

    const result = await updateAssignmentStatus({
      projectId: PROJECT_ID,
      assignmentId: ASSIGNMENT_ID,
      status: "done",
    })

    expect(result.data?.nextAssignment).toBeNull()
  })

  it("does not spawn a second occurrence when re-completing a done assignment", async () => {
    state.mock.onSelect(schema.taskAssignmentsTable).respond([
      {
        id: ASSIGNMENT_ID,
        userId: USER_ID,
        status: "done",
        endDate: new Date("2026-10-30T11:00:00"),
        taskId: TASK_ID,
        recurrence: "daily",
        interval: 1,
        daysOfWeek: null,
        startTime: "09:00",
        endTime: "11:00",
      },
    ])
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respond([makeAssignmentRow({ status: "done" })])

    const result = await updateAssignmentStatus({
      projectId: PROJECT_ID,
      assignmentId: ASSIGNMENT_ID,
      status: "done",
    })

    expect(result.data?.nextAssignment).toBeNull()
  })

  it("does not spawn when a later-dated assignment exists for the assignee", async () => {
    state.mock.onSelect(schema.tasksTable).respond([
      makeTaskRow({
        recurrence: "daily",
        interval: 1,
        daysOfWeek: null,
        startTime: "09:00",
        endTime: "11:00",
        endDate: new Date("2026-11-30T23:59:59"),
      }),
    ])
    rosterIs(USER_ID)
    state.mock.onSelect(schema.taskAssignmentsTable).respondWith((sql) => {
      if (sql.includes("exists")) return [{ id: "later-row" }]
      if (sql.includes("not in")) return []
      return [
        { id: ASSIGNMENT_ID, userId: USER_ID, status: "todo", endDate: new Date("2026-11-10T11:00:00"),
          taskId: TASK_ID, recurrence: "daily", interval: 1, daysOfWeek: null,
          startTime: "09:00", endTime: "11:00" },
      ]
    })
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
    state.mock.onSelect(schema.taskAssignmentDetailView)
      .respond([makeAssignmentRow({ status: "done" })])

    const result = await updateAssignmentStatus({
      projectId: PROJECT_ID, assignmentId: ASSIGNMENT_ID, status: "done",
    })
    expect(result.serverError).toBeUndefined()
    expect(result.data?.nextAssignment).toBeNull()
  })

  it("treats a null closing due date as oldest, so any dated row blocks the spawn", async () => {
    state.mock.onSelect(schema.tasksTable).respond([
      makeTaskRow({
        recurrence: "daily",
        interval: 1,
        daysOfWeek: null,
        startTime: "09:00",
        endTime: "11:00",
        endDate: new Date("2099-01-01T00:00:00"),
      }),
    ])
    rosterIs(USER_ID)
    state.mock.onSelect(schema.taskAssignmentsTable).respondWith((sql) => {
      if (sql.includes("exists")) return [{ id: "dated-row" }]
      if (sql.includes("not in")) return []
      return [
        { id: ASSIGNMENT_ID, userId: USER_ID, status: "todo", endDate: null,
          taskId: TASK_ID, recurrence: "daily", interval: 1, daysOfWeek: null,
          startTime: "09:00", endTime: "11:00" },
      ]
    })
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
    state.mock.onSelect(schema.taskAssignmentDetailView)
      .respond([makeAssignmentRow({ status: "done" })])

    const result = await updateAssignmentStatus({
      projectId: PROJECT_ID, assignmentId: ASSIGNMENT_ID, status: "done",
    })
    expect(result.data?.nextAssignment).toBeNull()
  })

  it("a second active member with no open row is healed on close, while a member with an open row is untouched", async () => {
    state.mock.onSelect(schema.tasksTable).respond([
      makeTaskRow({
        recurrence: "daily",
        interval: 1,
        daysOfWeek: null,
        startTime: "09:00",
        endTime: "11:00",
        endDate: new Date("2026-11-30T23:59:59"),
        archived: false,
      }),
    ])
    rosterIs(USER_ID, OTHER_ID, THIRD_ID)
    // Post-close state: THIRD_ID still holds an open row; USER_ID's row is
    // the one being closed and OTHER_ID has none.
    state.mock.onSelect(schema.taskAssignmentsTable).respondWith((sql) => {
      if (sql.includes("exists")) return []
      if (sql.includes("not in")) return [{ id: "open-third", userId: THIRD_ID }]
      return [
        { id: ASSIGNMENT_ID, userId: USER_ID, status: "todo",
          endDate: new Date("2026-10-30T11:00:00"),
          taskId: TASK_ID, recurrence: "daily", interval: 1, daysOfWeek: null,
          startTime: "09:00", endTime: "11:00", archived: false },
      ]
    })
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
    state.mock
      .onInsert(schema.taskAssignmentsTable)
      .respond([{ id: "successor" }, { id: "healed-other" }])
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respondWith((_sql, params) =>
        params[0] === ASSIGNMENT_ID
          ? [makeAssignmentRow({ status: "done" })]
          : [
              makeAssignmentRow({
                assignmentId: String(params[0]),
                userId: params[0] === "successor" ? USER_ID : OTHER_ID,
                status: "todo",
              }),
            ]
      )

    const baseline = state.mock.calls.length
    const result = await updateAssignmentStatus({
      projectId: PROJECT_ID,
      assignmentId: ASSIGNMENT_ID,
      status: "done",
    })

    expect(result.serverError).toBeUndefined()
    // One statement carries both rows: the closing assignee's successor and
    // the healed member — never the member who already has an open row.
    const inserts = state.mock.calls
      .slice(baseline)
      .filter((c) => c.sql.includes('insert into "task_assignment"'))
    expect(inserts).toHaveLength(1)
    expect(inserts[0].params).toContain(USER_ID)
    expect(inserts[0].params).toContain(OTHER_ID)
    expect(inserts[0].params).not.toContain(THIRD_ID)
    // nextAssignment is the closing assignee's successor only.
    expect(result.data?.nextAssignment?.id).toBe("successor")
    expect(result.data?.nextAssignment?.userId).toBe(USER_ID)
  })

  it("spawnedCostTotal sums the successor and every healed member's cost", async () => {
    state.mock.onSelect(schema.tasksTable).respond([
      makeTaskRow({
        recurrence: "daily",
        interval: 1,
        daysOfWeek: null,
        startTime: "09:00",
        endTime: "11:00",
        endDate: new Date("2026-11-30T23:59:59"),
        archived: false,
      }),
    ])
    rosterIs(USER_ID, OTHER_ID)
    state.mock.onSelect(schema.taskAssignmentsTable).respondWith((sql) => {
      if (sql.includes("exists")) return []
      if (sql.includes("not in")) return []
      return [
        { id: ASSIGNMENT_ID, userId: USER_ID, status: "todo",
          endDate: new Date("2026-10-30T11:00:00"),
          taskId: TASK_ID, recurrence: "daily", interval: 1, daysOfWeek: null,
          startTime: "09:00", endTime: "11:00", archived: false },
      ]
    })
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
    state.mock.onInsert(schema.taskAssignmentsTable).respond([
      { id: "successor" }, { id: "healed-other" },
    ])
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respondWith((_sql, params) =>
        params[0] === ASSIGNMENT_ID
          ? [makeAssignmentRow({ status: "done" })]
          : [
              makeAssignmentRow({
                assignmentId: String(params[0]),
                userId: params[0] === "successor" ? USER_ID : OTHER_ID,
                cost: params[0] === "successor" ? "120" : "80",
                status: "todo",
              }),
            ]
      )

    const result = await updateAssignmentStatus({
      projectId: PROJECT_ID, assignmentId: ASSIGNMENT_ID, status: "done",
    })

    expect(result.serverError).toBeUndefined()
    // Both spawned rows count, even though nextAssignment reports one.
    expect(result.data?.spawnedCostTotal).toBe(200)
    expect(result.data?.nextAssignment?.id).toBe("successor")
    expect(result.data?.nextAssignment?.cost).toBe("120")
  })

  it("closing an assignment on an archived task succeeds but spawns nothing", async () => {
    const baseline = state.mock.calls.length
    state.mock.onSelect(schema.taskAssignmentsTable).respond([
      { id: ASSIGNMENT_ID, userId: USER_ID, status: "todo", archived: true,
        endDate: new Date("2026-10-30T11:00:00"),
        taskId: TASK_ID, recurrence: "daily", interval: 1, daysOfWeek: null,
        startTime: "09:00", endTime: "11:00" },
    ])
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respond([makeAssignmentRow({ status: "done" })])
    state.mock
      .onInsert(schema.taskAssignmentsTable)
      .respond([{ id: "should-not-happen" }])

    const result = await updateAssignmentStatus({
      projectId: PROJECT_ID,
      assignmentId: ASSIGNMENT_ID,
      status: "done",
    })

    expect(result.serverError).toBeUndefined()
    expect(result.data?.nextAssignment).toBeNull()
    const calls = state.mock.calls.slice(baseline)
    expect(
      calls.some((c) => c.sql.includes('update "task_assignment"'))
    ).toBe(true)
    expect(
      calls.some((c) => c.sql.includes('insert into "task_assignment"'))
    ).toBe(false)
  })

  it("returns NOT_FOUND for an assignment outside the project", async () => {
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])

    const result = await updateAssignmentStatus({
      projectId: PROJECT_ID,
      assignmentId: ASSIGNMENT_ID,
      status: "in_progress",
    })

    expect(result.serverError).toEqual({ code: "NOT_FOUND" })
  })

  it("rejects reopening a closed assignment on a repeating task", async () => {
    state.mock.onSelect(schema.taskAssignmentsTable).respond([
      { id: ASSIGNMENT_ID, userId: USER_ID, status: "done", endDate: new Date("2026-11-10T11:00:00"),
        taskId: TASK_ID, recurrence: "daily", interval: 1, daysOfWeek: null,
        startTime: "09:00", endTime: "11:00" },
    ])
    const result = await updateAssignmentStatus({
      projectId: PROJECT_ID, assignmentId: ASSIGNMENT_ID, status: "todo",
    })
    expect(result.serverError).toEqual({ code: "VALIDATION_FAILED" })
  })

  it("lets a manager reopen a closed assignment on a non-repeating task", async () => {
    state.mock.onSelect(schema.taskAssignmentsTable).respond([
      { id: ASSIGNMENT_ID, userId: USER_ID, status: "cancelled", endDate: new Date("2026-11-10T11:00:00"),
        taskId: TASK_ID, recurrence: null, interval: 1, daysOfWeek: null,
        startTime: null, endTime: null },
    ])
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
    state.mock.onSelect(schema.taskAssignmentDetailView)
      .respond([makeAssignmentRow({ status: "todo" })])
    const result = await updateAssignmentStatus({
      projectId: PROJECT_ID, assignmentId: ASSIGNMENT_ID, status: "todo",
    })
    expect(result.serverError).toBeUndefined()
    expect(result.data?.assignment.status).toBe("todo")
    expect(result.data?.nextAssignment).toBeNull()
  })

  it("maps a reopen that races an existing open row to VALIDATION_FAILED", async () => {
    state.mock.onSelect(schema.taskAssignmentsTable).respond([
      { id: ASSIGNMENT_ID, userId: USER_ID, status: "done", endDate: new Date("2026-11-10T11:00:00"),
        taskId: TASK_ID, recurrence: null, interval: 1, daysOfWeek: null,
        startTime: null, endTime: null },
    ])
    state.mock.onUpdate(schema.taskAssignmentsTable)
      .throw(Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" }))
    const result = await updateAssignmentStatus({
      projectId: PROJECT_ID, assignmentId: ASSIGNMENT_ID, status: "todo",
    })
    expect(result.serverError).toEqual({ code: "VALIDATION_FAILED" })
  })
})

describe("updateAssignmentCost (recost)", () => {
  const recostInput = {
    projectId: PROJECT_ID,
    assignmentId: ASSIGNMENT_ID,
    cost: "150",
  }

  function mockScopedAssignment() {
    state.mock.onSelect(schema.taskAssignmentsTable).respond([
      {
        id: ASSIGNMENT_ID,
        userId: USER_ID,
        status: "todo",
        endDate: new Date("2026-10-30T11:00:00"),
        taskId: TASK_ID,
      },
    ])
  }

  function mockRecostView(cost: string) {
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respond([makeAssignmentRow({ cost })])
  }

  function recostUpdates(since: number) {
    return state.mock.calls
      .slice(since)
      .filter((c) => c.sql.includes('update "task_assignment"'))
  }

  it("recost: an owner recosts an assignment and the DTO carries the new cost", async () => {
    mockScopedAssignment()
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
    mockRecostView("150")
    const before = state.mock.calls.length

    const result = await updateAssignmentCost(recostInput)

    expect(result.serverError).toBeUndefined()
    expect(result.data?.id).toBe(ASSIGNMENT_ID)
    expect(result.data?.cost).toBe("150")
    const updates = recostUpdates(before)
    expect(updates).toHaveLength(1)
    expect(updates[0].params).toContain("150")
  })

  it("recost: a collaborator is forbidden", async () => {
    grantAccess("collaborator")
    const before = state.mock.calls.length

    const result = await updateAssignmentCost(recostInput)

    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
    expect(recostUpdates(before)).toHaveLength(0)
  })

  it("recost: an assignment outside the project is rejected without an update", async () => {
    // The scoped read returns nothing: the assignment is not in projectId.
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])
    const before = state.mock.calls.length

    const result = await updateAssignmentCost(recostInput)

    expect(["FORBIDDEN", "NOT_FOUND"]).toContain(result.serverError?.code)
    expect(recostUpdates(before)).toHaveLength(0)

    // The rejection is only a valid authorization boundary if the read was
    // scoped to the input project: dropping `eq(tasksTable.projectId,
    // projectId)` would still reject here but allow a real cross-project id.
    const scopedSelect = state.mock.calls
      .slice(before)
      .find((c) => c.sql.includes('from "task_assignment"'))
    expect(scopedSelect?.sql).toContain("project_id")
    expect(scopedSelect?.params).toContain(ASSIGNMENT_ID)
    expect(scopedSelect?.params).toContain(PROJECT_ID)
  })

  it("recost: a cleared cost returns and stores zero", async () => {
    mockScopedAssignment()
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
    mockRecostView("0")
    const before = state.mock.calls.length

    const result = await updateAssignmentCost({ ...recostInput, cost: "" })

    expect(result.serverError).toBeUndefined()
    expect(result.data?.cost).toBe("0")
    const updates = recostUpdates(before)
    expect(updates).toHaveLength(1)
    expect(updates[0].params).toContain("0")
  })
})

describe("updateAssignmentComment", () => {
  it("lets a manager edit another assignee's note", async () => {
    state.mock
      .onSelect(schema.taskAssignmentsTable)
      .respond([{ userId: OTHER_ID, status: "todo" }])
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respond([makeAssignmentRow({ comment: "note" })])

    const result = await updateAssignmentComment({
      projectId: PROJECT_ID,
      assignmentId: ASSIGNMENT_ID,
      comment: " note ",
    })

    expect(result.serverError).toBeUndefined()
    expect(result.data?.comment).toBe("note")
  })

  it("forbids a collaborator from editing another assignee's note", async () => {
    state.mock
      .onSelect(schema.taskAssignmentsTable)
      .respond([{ userId: OTHER_ID, status: "todo" }])
    grantAccess("collaborator")

    const result = await updateAssignmentComment({
      projectId: PROJECT_ID,
      assignmentId: ASSIGNMENT_ID,
      comment: "note",
    })

    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })

  it("forbids a collaborator from editing their own note", async () => {
    state.mock
      .onSelect(schema.taskAssignmentsTable)
      .respond([{ userId: USER_ID, status: "todo" }])
    grantAccess("collaborator")

    const result = await updateAssignmentComment({
      projectId: PROJECT_ID,
      assignmentId: ASSIGNMENT_ID,
      comment: "note",
    })

    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })
})

describe("guards", () => {
  it("forbids a collaborator from deleting a task", async () => {
    grantAccess("collaborator")
    const result = await deleteTask({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
    })
    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })

  it("forbids a collaborator from changing priority", async () => {
    grantAccess("collaborator")
    const result = await updateTaskPriority({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      priority: "urgent",
    })
    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })
})

describe("archiveTask", () => {
  // Recorded calls accumulate across tests in this file (resetMocks only
  // clears responders), so assertions read from this test's baseline.
  let callsBefore = 0
  beforeEach(() => {
    callsBefore = state.mock.calls.length
  })
  function archiveCalls() {
    return state.mock.calls.slice(callsBefore)
  }

  it("archives a repeating task, preserves its dates and times, closes all open rows and spawns nothing", async () => {
    // task row: recurrence "weekly", archived false, endDate in the future;
    // two open assignments for two members; task_assignee rows for both.
    state.mock.onSelect(schema.tasksTable).respond([
      makeTaskRow({
        recurrence: "weekly",
        archived: false,
        endDate: new Date("2099-01-01T00:00:00"),
      }),
    ])
    state.mock
      .onUpdate(schema.tasksTable)
      .respond([makeTaskRow({ archived: true })])
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])

    const result = await archiveTask({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      closeAs: "cancelled",
    })

    expect(defaultIsSuccess(result)).toBe(true)
    const updates = archiveCalls().filter((c) =>
      c.sql.includes('update "task"')
    )
    expect(updates.some((c) => c.sql.includes("archived"))).toBe(true)
    expect(
      archiveCalls().some((c) =>
        c.sql.includes('insert into "task_assignment"')
      )
    ).toBe(false)
    expect(
      archiveCalls().some((c) =>
        c.sql.includes('delete from "task_assignee"')
      )
    ).toBe(false)

    // The task UPDATE writes only `archived` — no date or time column is
    // touched, so the original schedule (including the 2099 due date) stays.
    const taskUpdate = updates.find((c) => c.sql.includes('"archived"'))
    expect(taskUpdate).toBeDefined()
    const setClause = taskUpdate!.sql.slice(
      0,
      taskUpdate!.sql.indexOf(" where ")
    )
    const columns = [...setClause.matchAll(/"([a-z_]+)" = \$/g)].map(
      (m) => m[1]
    )
    expect(columns).toContain("archived")
    for (const col of ["start_date", "end_date", "start_time", "end_time"]) {
      expect(columns).not.toContain(col)
    }

    // Both open rows close with the chosen disposition, in place.
    const closes = archiveCalls().filter((c) =>
      c.sql.includes('update "task_assignment"')
    )
    expect(closes.length).toBeGreaterThan(0)
    expect(closes.every((c) => c.params.includes("cancelled"))).toBe(true)
    expect(
      archiveCalls().some((c) =>
        c.sql.includes('delete from "task_assignment"')
      )
    ).toBe(false)
  })

  it("only archives a task that is still live", async () => {
    state.mock
      .onSelect(schema.tasksTable)
      .respond([makeTaskRow({ archived: false })])
    state.mock
      .onUpdate(schema.tasksTable)
      .respond([makeTaskRow({ archived: true })])
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])

    await archiveTask({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      closeAs: "done",
    })

    const taskUpdate = archiveCalls().find((c) =>
      c.sql.includes('update "task" set')
    )
    expect(taskUpdate?.sql).toMatch(/and "task"\."archived" = \$\d+\)$/)
    expect(taskUpdate?.params.at(-1)).toBe(false)
  })

  it("rejects archive for a collaborator", async () => {
    grantAccess("collaborator")
    const result = await archiveTask({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      closeAs: "cancelled",
    })
    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })

  it("rejects archiving a task that is already archived", async () => {
    state.mock
      .onSelect(schema.tasksTable)
      .respond([makeTaskRow({ archived: true })])

    const result = await archiveTask({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      closeAs: "done",
    })

    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
    expect(
      archiveCalls().some((c) => c.sql.includes('update "task"'))
    ).toBe(false)
  })
})

describe("unarchiveTask", () => {
  // The action anchors the spawn on `now`; freezing the clock keeps the
  // in-range/out-of-range fixtures deterministic at any hour of the day.
  const FROZEN_NOW = new Date("2026-11-19T08:00:00")
  const TODAY_END = new Date("2026-11-19T23:59:59")

  let callsBefore = 0
  beforeEach(() => {
    callsBefore = state.mock.calls.length
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(FROZEN_NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function unarchiveCalls() {
    return state.mock.calls.slice(callsBefore)
  }

  function inserts() {
    return unarchiveCalls().filter((c) =>
      c.sql.includes('insert into "task_assignment"')
    )
  }

  /**
   * The row reads archived on the action's pre-check and unarchived from the
   * helper's read inside the transaction — pinning that the action is not
   * rejected for an archived task while rule 0 still
   * sees the post-write state.
   */
  function taskUnarchives(overrides: Record<string, unknown>) {
    const task = makeTaskRow(overrides)
    state.mock
      .onSelect(schema.tasksTable)
      .respondOnce([task])
      .respond([{ ...task, archived: false }])
    state.mock.onUpdate(schema.tasksTable).respond([task])
  }

  const inRangeRepeating = {
    recurrence: "weekly",
    interval: 1,
    daysOfWeek: null,
    startTime: "09:00",
    endTime: "11:00",
    endDate: TODAY_END,
    archived: true,
  }

  it("unarchiving a repeating in-range task spawns for every active assignee without an open row", async () => {
    // archived task, recurrence weekly, endDate today, two task_assignee rows, no open rows
    taskUnarchives(inRangeRepeating)
    rosterIs(USER_ID, OTHER_ID)
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])
    state.mock
      .onInsert(schema.taskAssignmentsTable)
      .respond([{ id: "spawned-1" }, { id: "spawned-2" }])
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respondWith((_sql, params) => [
        makeAssignmentRow({
          assignmentId: String(params[0]),
          userId: params[0] === "spawned-1" ? USER_ID : OTHER_ID,
        }),
      ])

    const result = await unarchiveTask({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
    })

    expect(defaultIsSuccess(result)).toBe(true)
    expect(result.data?.spawned).toHaveLength(2)
    expect(result.data?.spawned.map((a) => a.userId)).toEqual(
      expect.arrayContaining([USER_ID, OTHER_ID])
    )
    expect(inserts()).toHaveLength(1)
    const [insert] = inserts()
    expect(insert.params).toContain(USER_ID)
    expect(insert.params).toContain(OTHER_ID)

    // The write itself: archived flips to false; no closes, no roster changes.
    const update = unarchiveCalls().find((c) =>
      c.sql.includes('update "task"')
    )
    expect(update?.params).toContain(false)
    expect(
      unarchiveCalls().some((c) => c.sql.includes('update "task_assignment"'))
    ).toBe(false)
    expect(
      unarchiveCalls().some((c) => c.sql.includes('delete from "task_assignee"'))
    ).toBe(false)
  })

  it("unarchiving out of range spawns nothing", async () => {
    // endDate in the past → spawned: []
    taskUnarchives({
      recurrence: "weekly",
      interval: 1,
      daysOfWeek: null,
      startTime: "09:00",
      endTime: "11:00",
      endDate: new Date("2026-11-10T23:59:59"),
      archived: true,
    })
    rosterIs(USER_ID, OTHER_ID)
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])

    const result = await unarchiveTask({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
    })

    expect(defaultIsSuccess(result)).toBe(true)
    expect(result.data?.spawned).toEqual([])
    expect(inserts()).toHaveLength(0)
  })

  it("unarchiving a non-repeating task spawns nothing", async () => {
    // recurrence: null → the helper returns [] before consulting the roster
    taskUnarchives({ recurrence: null, archived: true })

    const result = await unarchiveTask({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
    })

    expect(defaultIsSuccess(result)).toBe(true)
    expect(result.data?.spawned).toEqual([])
    expect(inserts()).toHaveLength(0)
  })

  it("rejects unarchiving a task that is not archived, and never spawns", async () => {
    state.mock
      .onSelect(schema.tasksTable)
      .respond([makeTaskRow({ ...inRangeRepeating, archived: false })])
    rosterIs(USER_ID)
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])

    const result = await unarchiveTask({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
    })

    expect(result.serverError).toEqual({ code: "VALIDATION_FAILED" })
    expect(inserts()).toHaveLength(0)
    expect(
      unarchiveCalls().some((c) => c.sql.includes('update "task"'))
    ).toBe(false)
  })

  it("flips only an archived row and reports NOT_FOUND when nothing flipped", async () => {
    // Read as archived, then gone by the time the write runs.
    state.mock
      .onSelect(schema.tasksTable)
      .respond([makeTaskRow({ ...inRangeRepeating })])
    state.mock.onUpdate(schema.tasksTable).respond([])

    const result = await unarchiveTask({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
    })

    expect(result.serverError).toEqual({ code: "NOT_FOUND" })
    expect(inserts()).toHaveLength(0)
    const update = unarchiveCalls().find((c) =>
      c.sql.includes('update "task" set')
    )
    expect(update?.sql).toMatch(/and "task"\."archived" = \$\d+\)/)
    expect(update?.params).toContain(true)
  })

  it("a member removed from the project is never spawned for", async () => {
    // task_assignee row absent for OTHER_ID → only USER_ID spawned
    taskUnarchives(inRangeRepeating)
    rosterIs(USER_ID)
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])
    state.mock
      .onInsert(schema.taskAssignmentsTable)
      .respond([{ id: "spawned-1" }])
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respond([
        makeAssignmentRow({ assignmentId: "spawned-1", userId: USER_ID }),
      ])

    const result = await unarchiveTask({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
    })

    expect(defaultIsSuccess(result)).toBe(true)
    expect(result.data?.spawned).toHaveLength(1)
    expect(result.data?.spawned[0]?.userId).toBe(USER_ID)
    const [insert] = inserts()
    expect(insert.params).toContain(USER_ID)
    expect(insert.params).not.toContain(OTHER_ID)
  })
})

describe("archived tasks", () => {
  it("edits an archived task like a live one", async () => {
    const archived = makeTaskRow({ archived: true })
    state.mock.onSelect(schema.tasksTable).respond([archived])
    state.mock.onSelect(schema.taskAssignmentsTable).respond([
      { id: ASSIGNMENT_ID, userId: USER_ID, status: "todo", archived: true },
    ])
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respond([makeAssignmentRow()])
    state.mock.onUpdate(schema.tasksTable).respond([archived])
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])

    for (const [name, action] of [
      ["updateTask", () => updateTask({ ...validTask, taskId: TASK_ID })],
      ["updateAssignmentStatus", () => updateAssignmentStatus({ projectId: PROJECT_ID, assignmentId: ASSIGNMENT_ID, status: "in_progress" })],
      ["updateAssignmentComment", () => updateAssignmentComment({ projectId: PROJECT_ID, assignmentId: ASSIGNMENT_ID, comment: "hi" })],
      ["updateTaskPriority", () => updateTaskPriority({ projectId: PROJECT_ID, taskId: TASK_ID, priority: "high" })],
    ] as const) {
      expect((await action()).serverError, name).toBeUndefined()
    }
  })

  it("only rejects a second archive; unarchive and delete still succeed", async () => {
    state.mock.onSelect(schema.tasksTable).respond([
      makeTaskRow({ archived: true }),
    ])
    state.mock.onUpdate(schema.tasksTable).respond([
      makeTaskRow({ archived: false }),
    ])
    state.mock.onDelete(schema.tasksTable).respond([])

    const archived = await archiveTask({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      closeAs: "done",
    })
    expect(archived.serverError).toEqual({ code: "FORBIDDEN" })

    const unarchived = await unarchiveTask({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
    })
    expect(unarchived.serverError).toBeUndefined()

    const deleted = await deleteTask({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
    })
    expect(deleted.serverError).toBeUndefined()
  })

  it("adding an assignee to an archived non-repeating task writes membership but opens nothing", async () => {
    const archived = makeTaskRow({ archived: true })
    state.mock.onUpdate(schema.tasksTable).respond([archived])
    state.mock.onSelect(schema.tasksTable).respond([archived])
    state.mock.onSelect(schema.taskAssigneesTable).respond([])
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: USER_ID }])
    state.mock
      .onSelect(schema.projectMembershipTable)
      .respond([{ userId: USER_ID }, { userId: OTHER_ID }])
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])
    state.mock.onSelect(schema.taskAssignmentDetailView).respond([])
    const baseline = state.mock.calls.length

    const result = await updateTask({
      ...validTask,
      taskId: TASK_ID,
      assigneeIds: [OTHER_ID],
    })

    expect(result.serverError).toBeUndefined()
    const calls = state.mock.calls.slice(baseline)
    const membership = calls.filter((c) =>
      c.sql.includes('insert into "task_assignee"')
    )
    expect(membership).toHaveLength(1)
    expect(membership[0].params).toContain(OTHER_ID)
    expect(
      calls.some((c) => c.sql.includes('insert into "task_assignment"'))
    ).toBe(false)
  })
})

describe("archived comments", () => {
  const authored = {
    id: COMMENT_ID,
    taskId: TASK_ID,
    authorId: USER_ID,
    authorName: "Test",
    authorImage: null,
    content: "hi",
    createdAt: new Date("2026-10-30T08:00:00"),
    updatedAt: new Date("2026-10-30T08:00:00"),
  }

  beforeEach(() => {
    state.mock
      .onSelect(schema.tasksTable)
      .respond([makeTaskRow({ archived: true })])
  })

  it("reads and writes an archived task's comments like a live one", async () => {
    state.mock.onSelect(schema.taskCommentsTable).respond([authored])
    state.mock.onInsert(schema.taskCommentsTable).respond([authored])
    state.mock.onUpdate(schema.taskCommentsTable).respond([])
    state.mock.onDelete(schema.taskCommentsTable).respond([])
    state.mock
      .onSelect(schema.usersTable)
      .respond([{ name: "Test", image: null }])

    const read = await getTaskComments({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
    })
    expect(read.serverError).toBeUndefined()

    for (const [name, write] of [
      ["createComment", () => createComment({ projectId: PROJECT_ID, taskId: TASK_ID, content: "hi" })],
      ["updateComment", () => updateComment({ projectId: PROJECT_ID, taskId: TASK_ID, commentId: COMMENT_ID, content: "hi" })],
      ["deleteComment", () => deleteComment({ projectId: PROJECT_ID, taskId: TASK_ID, commentId: COMMENT_ID })],
    ] as const) {
      expect((await write()).serverError, name).toBeUndefined()
    }
  })

  it("keeps a collaborator without an open assignment out of an archived task's comments", async () => {
    grantAccess("collaborator")
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])

    const read = await getTaskComments({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
    })
    expect(read.serverError).toEqual({ code: "FORBIDDEN" })
  })
})

describe("assertTaskMutable", () => {
  it("is the double-archive guard: FORBIDDEN for an archived task, a live one passes", () => {
    expect(() => assertTaskMutable({ archived: true })).toThrow("FORBIDDEN")
    expect(() => assertTaskMutable({ archived: false })).not.toThrow()
  })

  it("throws NOT_FOUND for a missing row", () => {
    expect(() => assertTaskMutable(undefined)).toThrow("NOT_FOUND")
  })
})

describe("getTaskAssignmentHistory", () => {
  it("pages closed assignments and reports hasMore", async () => {
    grantAccess("owner")
    state.mock.onSelect(schema.taskAssignmentDetailView).respond(
      Array.from({ length: 11 }, (_, i) =>
        makeAssignmentRow({
          assignmentId: `h${i}`,
          status: i % 2 ? "cancelled" : "done",
        })
      )
    )
    const result = await getTaskAssignmentHistory({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      limit: 10,
      offset: 0,
    })
    expect(result.data?.assignments).toHaveLength(10)
    expect(result.data?.hasMore).toBe(true)
    // ordering lives in SQL: the history select orders by created_at
    expect(state.mock.calls.at(-1)?.sql).toContain("created_at")
  })

  it("coerces view date strings and reports hasMore false when the page fits", async () => {
    grantAccess("owner")
    state.mock.onSelect(schema.taskAssignmentDetailView).respond([
      makeAssignmentRow({
        assignmentId: "h0",
        status: "done",
        startDate: "2026-10-30T09:00:00",
        endDate: "2026-10-30T11:00:00",
      }),
      makeAssignmentRow({ assignmentId: "h1", status: "cancelled" }),
    ])
    const result = await getTaskAssignmentHistory({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      limit: 10,
      offset: 0,
    })
    expect(result.data?.hasMore).toBe(false)
    expect(result.data?.assignments[0]?.startDate).toBeInstanceOf(Date)
  })

  it("forbids a caller without project access", async () => {
    mockResolveAccess.mockResolvedValue({ hasAccess: false, role: null })
    const result = await getTaskAssignmentHistory({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      limit: 10,
      offset: 0,
    })
    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })

  it("constrains the history select to the requested project", async () => {
    grantAccess("owner")
    state.mock.onSelect(schema.taskAssignmentDetailView).respond([
      makeAssignmentRow({ assignmentId: "h0", status: "done" }),
    ])
    await getTaskAssignmentHistory({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      limit: 10,
      offset: 0,
    })
    const historyCall = state.mock.calls.at(-1)
    const where = (historyCall?.sql ?? "").slice(
      (historyCall?.sql ?? "").indexOf("where")
    )
    expect(where).toMatch(/"task_id" = \$\d+/)
    expect(where).toMatch(/"project_id" = \$\d+/)
    expect(historyCall?.params).toContain(TASK_ID)
    expect(historyCall?.params).toContain(PROJECT_ID)
  })
})

describe("spawnEligibleAssignments", () => {
  const ANCHOR = new Date("2026-11-16T08:00:00")
  const INSERT = 'insert into "task_assignment"'

  function repeatingTask(overrides: Record<string, unknown> = {}) {
    return makeTaskRow({
      recurrence: "daily",
      startTime: "09:00",
      endTime: "11:00",
      endDate: new Date("2026-11-30T23:00:00"),
      ...overrides,
    })
  }

  function rosterOf(...userIds: string[]) {
    state.mock
      .onSelect(schema.taskAssigneesTable)
      .respond(userIds.map((userId) => ({ userId })))
  }

  let callsBefore = 0

  beforeEach(() => {
    callsBefore = state.mock.calls.length
  })

  function inserts() {
    return state.mock.calls
      .slice(callsBefore)
      .filter((c) => c.sql.includes(INSERT))
  }

  it("never spawns for an archived task (rule 0)", async () => {
    state.mock
      .onSelect(schema.tasksTable)
      .respond([repeatingTask({ archived: true, recurrence: "weekly" })])
    rosterOf(USER_ID)
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])

    expect(
      await queries.spawnEligibleAssignments(TASK_ID, { anchor: ANCHOR })
    ).toEqual([])
    expect(inserts()).toHaveLength(0)
  })

  it("never spawns for a non-repeating task", async () => {
    state.mock
      .onSelect(schema.tasksTable)
      .respond([repeatingTask({ recurrence: null })])
    rosterOf(USER_ID)
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])

    expect(
      await queries.spawnEligibleAssignments(TASK_ID, { anchor: ANCHOR })
    ).toEqual([])
    expect(inserts()).toHaveLength(0)
  })

  it("never spawns for a task that does not exist", async () => {
    state.mock.onSelect(schema.tasksTable).respond([])

    expect(
      await queries.spawnEligibleAssignments(TASK_ID, { anchor: ANCHOR })
    ).toEqual([])
    expect(inserts()).toHaveLength(0)
  })

  it("requires an active member and no open row", async () => {
    state.mock.onSelect(schema.tasksTable).respond([repeatingTask()])
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])

    expect(
      await queries.spawnEligibleAssignments(TASK_ID, { anchor: ANCHOR })
    ).toEqual([])

    rosterOf(USER_ID)
    state.mock
      .onSelect(schema.taskAssignmentsTable)
      .respond([{ id: ASSIGNMENT_ID, userId: USER_ID }])

    expect(
      await queries.spawnEligibleAssignments(TASK_ID, { anchor: ANCHOR })
    ).toEqual([])
    expect(inserts()).toHaveLength(0)
  })

  it("skips candidates whose next occurrence is out of range", async () => {
    state.mock
      .onSelect(schema.tasksTable)
      .respond([repeatingTask({ endDate: new Date("2026-11-10T23:00:00") })])
    rosterOf(USER_ID)
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])

    expect(
      await queries.spawnEligibleAssignments(TASK_ID, { anchor: ANCHOR })
    ).toEqual([])
    expect(inserts()).toHaveLength(0)
  })

  it("inserts one open assignment for an eligible member with the computed window", async () => {
    state.mock.onSelect(schema.tasksTable).respond([repeatingTask()])
    rosterOf(USER_ID)
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])
    state.mock
      .onInsert(schema.taskAssignmentsTable)
      .respond([{ id: "spawned-1" }])

    const ids = await queries.spawnEligibleAssignments(TASK_ID, {
      anchor: ANCHOR,
    })

    expect(ids).toEqual(["spawned-1"])
    expect(inserts()).toHaveLength(1)
    const [insert] = inserts()
    expect(insert.params).toContain("todo")
    expect(insert.params).toContain(USER_ID)
    expect(insert.params).toContain(TASK_ID)
    const dates = insert.params
      .filter((p): p is string => typeof p === "string")
      .map((p) => Date.parse(p))
      .filter((t) => !Number.isNaN(t))
    expect(dates).toContain(new Date("2026-11-16T09:00:00").getTime())
    expect(dates).toContain(new Date("2026-11-16T11:00:00").getTime())
  })

  it("treats the project's primary owner as an active member without a membership row", async () => {
    // The owner has no project_membership row; only task_assignee lists them.
    state.mock.onSelect(schema.tasksTable).respond([repeatingTask()])
    rosterOf(USER_ID)
    state.mock.onSelect(schema.projectMembershipTable).respond([])
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])
    state.mock
      .onInsert(schema.taskAssignmentsTable)
      .respond([{ id: "spawned-owner" }])

    const ids = await queries.spawnEligibleAssignments(TASK_ID, {
      anchor: ANCHOR,
    })

    expect(ids).toEqual(["spawned-owner"])
    expect(inserts()).toHaveLength(1)
    expect(inserts()[0].params).toContain(USER_ID)

    // The eligibility read must accept the owner without a membership row:
    // a left join to membership, OR-ed with the project's primary owner.
    const rosterRead = state.mock.calls
      .slice(callsBefore)
      .find((c) => c.sql.includes('from "task_assignee"'))
    expect(rosterRead?.sql).toContain('left join "project_membership"')
    expect(rosterRead?.sql).toContain(
      '"project"."primary_owner_id" = "task_assignee"."user_id"'
    )
    expect(rosterRead?.sql).not.toContain('inner join "project_membership"')
  })

  it("keeps the closing assignee's later-dated guard", async () => {
    state.mock.onSelect(schema.tasksTable).respond([repeatingTask()])
    rosterOf(USER_ID, OTHER_ID)
    state.mock.onSelect(schema.taskAssignmentsTable).respondWith(
      (sql, params) =>
        sql.includes("exists") && params.includes(USER_ID)
          ? [{ id: "later-row" }]
          : []
    )
    state.mock
      .onInsert(schema.taskAssignmentsTable)
      .respond([{ id: "spawned-other" }])

    const ids = await queries.spawnEligibleAssignments(TASK_ID, {
      anchor: ANCHOR,
      closing: {
        userId: USER_ID,
        endDate: new Date("2026-11-16T10:00:00"),
      },
    })

    expect(ids).toEqual(["spawned-other"])
    expect(inserts()).toHaveLength(1)
    expect(inserts()[0].params).toContain(OTHER_ID)
    expect(inserts()[0].params).not.toContain(USER_ID)
  })

  it("respects onlyUserIds when a caller scopes the helper", async () => {
    state.mock.onSelect(schema.tasksTable).respond([repeatingTask()])
    rosterOf(USER_ID, OTHER_ID)
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])
    state.mock
      .onInsert(schema.taskAssignmentsTable)
      .respond([{ id: "spawned-1" }])

    const ids = await queries.spawnEligibleAssignments(TASK_ID, {
      anchor: ANCHOR,
      onlyUserIds: [USER_ID],
    })

    expect(ids).toEqual(["spawned-1"])
    expect(inserts()).toHaveLength(1)
    expect(inserts()[0].params).toContain(USER_ID)
    expect(inserts()[0].params).not.toContain(OTHER_ID)
  })
})
