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
import { resolveProjectAccess } from "@/actions/projects/util"
import type { ProjectRole } from "@/lib/types"
import { deleteComment, getTaskComments } from "@/actions/tasks"

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>
const mockResolveAccess = vi.mocked(resolveProjectAccess)

const PROJECT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const TASK_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const COMMENT_ID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const USER_ID = "user-1"
const OTHER_ID = "user-2"

function grantAccess(role: ProjectRole = "collaborator") {
  mockResolveAccess.mockResolvedValue({
    hasAccess: true,
    role,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  state.mock.resetMocks()
  mockAuth.mockResolvedValue({
    user: { id: USER_ID, role: "user", name: "Test" },
    expires: new Date().toISOString(),
  } as never)
  grantAccess("collaborator")
})

describe("getTaskComments access", () => {
  it("rejects input that fails the schema before the action runs", async () => {
    const result = await getTaskComments({
      projectId: "not-a-uuid",
      taskId: "not-a-uuid",
    })

    expect(result.validationErrors).toBeDefined()
    expect(result.data).toBeUndefined()
    expect(result.serverError).toBeUndefined()
  })

  it("lets a collaborator with an open assignment read comments", async () => {
    state.mock.onSelect(schema.tasksTable).respond([{ id: TASK_ID }])
    state.mock
      .onSelect(schema.taskAssignmentsTable)
      .respond([{ id: "assignment-1" }])
    state.mock.onSelect(schema.taskCommentsTable).respond([])

    const result = await getTaskComments({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
    })

    expect(result.data).toEqual([])
  })

  it("blocks a collaborator without an open assignment", async () => {
    state.mock.onSelect(schema.tasksTable).respond([{ id: TASK_ID }])
    state.mock.onSelect(schema.taskAssignmentsTable).respond([])

    const result = await getTaskComments({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
    })

    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })

  it("lets an admin read comments without an assignment", async () => {
    grantAccess("admin")
    state.mock.onSelect(schema.tasksTable).respond([{ id: TASK_ID }])
    state.mock.onSelect(schema.taskCommentsTable).respond([])

    const result = await getTaskComments({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
    })

    expect(result.data).toEqual([])
  })
})

describe("deleteComment moderation", () => {
  it("lets an admin delete someone else's comment", async () => {
    grantAccess("admin")
    state.mock.onSelect(schema.tasksTable).respond([{ id: TASK_ID }])
    state.mock
      .onSelect(schema.taskCommentsTable)
      .respond([{ authorId: OTHER_ID, taskId: TASK_ID }])
    state.mock.onDelete(schema.taskCommentsTable).respond([])

    const result = await deleteComment({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      commentId: COMMENT_ID,
    })

    expect(result.data).toEqual({ commentId: COMMENT_ID })
  })

  it("forbids a collaborator from deleting someone else's comment", async () => {
    state.mock.onSelect(schema.tasksTable).respond([{ id: TASK_ID }])
    state.mock
      .onSelect(schema.taskAssignmentsTable)
      .respond([{ id: "assignment-1" }])
    state.mock
      .onSelect(schema.taskCommentsTable)
      .respond([{ authorId: OTHER_ID, taskId: TASK_ID }])

    const result = await deleteComment({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      commentId: COMMENT_ID,
    })

    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })
})
