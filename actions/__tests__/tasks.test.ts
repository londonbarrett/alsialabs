import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({ auth: vi.fn(), hasPermission: vi.fn() }))
vi.mock("@/actions/not-safe/project-access", () => ({
  verifyProjectAccess: vi.fn(),
}))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}))

const state = vi.hoisted(() => ({
  mock: null as unknown as {
    resetMocks(): void
    onSelect(table: unknown): {
      respond(data: unknown): unknown
      respondWith(
        fn: (sql: string, params: unknown[]) => unknown
      ): unknown
    }
    onInsert(table: unknown): { respond(data: unknown): unknown }
    onUpdate(table: unknown): { respond(data: unknown): unknown }
    onDelete(table: unknown): { respond(data: unknown): unknown }
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
import { verifyProjectAccess } from "@/actions/not-safe/project-access"
import type { ProjectRole } from "@/lib/project-roles"
import {
  createTask,
  deleteTask,
  getTasks,
  updateAssignmentComment,
  updateAssignmentStatus,
  updateTask,
  updateTaskPriority,
} from "@/actions/tasks"

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>
const mockVerifyProjectAccess = vi.mocked(verifyProjectAccess)

const PROJECT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const TASK_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const ASSIGNMENT_ID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const USER_ID = "user-1"
const OTHER_ID = "user-2"

function grantAccess(role: ProjectRole = "owner") {
  mockVerifyProjectAccess.mockResolvedValue({
    hasAccess: true,
    role,
    isOwner: role === "owner",
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
  mockAuth.mockResolvedValue({
    user: { id: USER_ID, role: "user", name: "Test" },
    expires: new Date().toISOString(),
  } as never)
  grantAccess("owner")
})

describe("getTasks", () => {
  it("returns tasks with their assignments", async () => {
    state.mock.onSelect(schema.tasksTable).respond([makeTaskRow()])
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respond([makeAssignmentRow()])
    state.mock.onSelect(schema.taskCommentsTable).respond([])

    const result = await getTasks({ projectId: PROJECT_ID })

    expect(result.serverError).toBeUndefined()
    expect(result.data?.[0]?.assignments).toHaveLength(1)
    expect(result.data?.[0]?.assignments[0]?.userId).toBe(USER_ID)
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
      .onSelect(schema.taskAssignmentDetailView)
      .respond([assignment])
    state.mock.onInsert(schema.tasksTable).respond([makeTaskRow()])

    const result = await createTask(validTask)

    expect(result.serverError).toBeUndefined()
    expect(result.data?.id).toBe(TASK_ID)
  })

  it("rejects an assignee outside the project", async () => {
    state.mock.onSelect(schema.projectsTable).respond([
      { primaryOwnerId: "owner-1" },
    ])
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
  it("forbids a collaborator", async () => {
    grantAccess("collaborator")
    const result = await updateTask({ ...validTask, taskId: TASK_ID })
    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })
})

describe("updateAssignmentStatus", () => {
  function mockAssignmentRow(status = "todo", userId = USER_ID) {
    state.mock.onSelect(schema.taskAssignmentsTable).respond([
      { id: ASSIGNMENT_ID, userId, status },
    ])
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respond([makeAssignmentRow({ status: "in_progress" })])
  }

  it("lets a manager set done on any assignment", async () => {
    state.mock.onSelect(schema.taskAssignmentsTable).respond([
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
    state.mock.onSelect(schema.taskAssignmentsTable).respond([
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
    ])
    state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
    state.mock.onInsert(schema.taskAssignmentsTable).respond([
      { id: "next-assignment" },
    ])
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

  it("returns NOT_FOUND for an assignment outside the project", async () => {
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])

    const result = await updateAssignmentStatus({
      projectId: PROJECT_ID,
      assignmentId: ASSIGNMENT_ID,
      status: "in_progress",
    })

    expect(result.serverError).toEqual({ code: "NOT_FOUND" })
  })
})

describe("updateAssignmentComment", () => {
  it("lets a manager edit another assignee's note", async () => {
    state.mock.onSelect(schema.taskAssignmentsTable).respond([
      { userId: OTHER_ID, status: "todo" },
    ])
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
    state.mock.onSelect(schema.taskAssignmentsTable).respond([
      { userId: OTHER_ID, status: "todo" },
    ])
    grantAccess("collaborator")

    const result = await updateAssignmentComment({
      projectId: PROJECT_ID,
      assignmentId: ASSIGNMENT_ID,
      comment: "note",
    })

    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })

  it("forbids a collaborator from editing their own note", async () => {
    state.mock.onSelect(schema.taskAssignmentsTable).respond([
      { userId: USER_ID, status: "todo" },
    ])
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
    const result = await deleteTask({ projectId: PROJECT_ID, taskId: TASK_ID })
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
