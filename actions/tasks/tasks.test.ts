import { beforeEach, describe, expect, it, vi } from "vitest"

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
import queries from "@/actions/tasks/queries"
import {
  createTask,
  deleteTask,
  getTaskAssignmentHistory,
  getTasks,
  updateAssignmentComment,
  updateAssignmentStatus,
  updateTask,
  updateTaskPriority,
} from "@/actions/tasks"

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>
const mockResolveAccess = vi.mocked(resolveProjectAccess)

const PROJECT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const TASK_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const ASSIGNMENT_ID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const USER_ID = "user-1"
const OTHER_ID = "user-2"

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

beforeEach(() => {
  vi.clearAllMocks()
  state.mock.resetMocks()
  state.mock.onSelect(schema.taskAssigneesTable).respond([])
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
  it("diffs open assignments, keeping closed rows out of the diff", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: USER_ID }])
    state.mock
      .onSelect(schema.projectMembershipTable)
      .respond([{ userId: "user-3" }])
    state.mock.onUpdate(schema.tasksTable).respond([makeTaskRow()])
    let openSql = ""
    // One table, two shapes: the open-assignments diff read and the
    // terminal-count read that follows it — routed by SQL.
    state.mock
      .onSelect(schema.taskAssignmentsTable)
      .respondWith((sql) => {
        if (sql.includes("count(")) return []
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
    // Only open rows enter the diff; the query filters closed ones out.
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

  it("creates the next occurrence when a repeating assignment is done", async () => {
    state.mock.onSelect(schema.taskAssignmentsTable).respondWith((sql) =>
      sql.includes("exists") ? [] : [
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
        },
      ]
    )
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

    const result = await updateAssignmentStatus({
      projectId: PROJECT_ID,
      assignmentId: ASSIGNMENT_ID,
      status: "done",
    })

    expect(result.serverError).toBeUndefined()
    expect(result.data?.nextAssignment?.id).toBe("next-assignment")
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
    state.mock.onSelect(schema.taskAssignmentsTable).respondWith((sql) =>
      sql.includes("exists") ? [{ id: "later-row" }] : [
        { id: ASSIGNMENT_ID, userId: USER_ID, status: "todo", endDate: new Date("2026-11-10T11:00:00"),
          taskId: TASK_ID, recurrence: "daily", interval: 1, daysOfWeek: null,
          startTime: "09:00", endTime: "11:00" },
      ]
    )
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
    state.mock.onSelect(schema.taskAssignmentsTable).respondWith((sql) =>
      sql.includes("exists") ? [{ id: "dated-row" }] : [
        { id: ASSIGNMENT_ID, userId: USER_ID, status: "todo", endDate: null,
          taskId: TASK_ID, recurrence: "daily", interval: 1, daysOfWeek: null,
          startTime: "09:00", endTime: "11:00" },
      ]
    )
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
    state.mock.onSelect(schema.taskAssignmentDetailView)
      .respond([makeAssignmentRow({ status: "done" })])

    const result = await updateAssignmentStatus({
      projectId: PROJECT_ID, assignmentId: ASSIGNMENT_ID, status: "done",
    })
    expect(result.data?.nextAssignment).toBeNull()
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
