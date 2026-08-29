import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  hasPermission: vi.fn(),
}))

vi.mock("@/lib/actions/project-access", () => ({
  verifyProjectAccess: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}))

const state = vi.hoisted(() => ({
  mock: null as unknown as {
    resetMocks(): void
    onSelect(table: unknown): { respond(data: unknown): unknown }
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
import { auth, hasPermission } from "@/lib/auth"
import { verifyProjectAccess } from "@/lib/actions/project-access"
import {
  getTasks,
  createTask,
  updateTask,
  updateTaskStatus,
  updateTaskPriority,
  deleteTask,
} from "@/lib/actions/tasks"

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>
const mockHasPermission = vi.mocked(hasPermission)
const mockVerifyProjectAccess = vi.mocked(verifyProjectAccess)

const PROJECT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00"
const TASK_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const USER_ID = "user-1"

function grantAccess(isOwner = true) {
  mockVerifyProjectAccess.mockResolvedValue({
    hasAccess: true,
    isOwner,
  })
}

function denyAccess() {
  mockVerifyProjectAccess.mockResolvedValue({
    hasAccess: false,
    isOwner: false,
  })
}

describe("tasks actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.mock.resetMocks()
    mockAuth.mockResolvedValue({
      user: { id: USER_ID, role: "user", name: "Test" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    })
    mockHasPermission.mockResolvedValue(true)
    grantAccess(true)
  })

  describe("getTasks", () => {
    it("returns tasks for an accessible project", async () => {
      const fakeTasks = [
        {
          id: TASK_ID,
          projectId: PROJECT_ID,
          name: "Task 1",
          description: null,
          cost: null,
          status: "todo",
          priority: null,
          routineId: null,
          dueDate: null,
          assigneeId: null,
          assigneeName: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          commentCount: 0,
        },
      ]
      state.mock.onSelect(schema.tasksTable).respond(fakeTasks)

      const result = await getTasks({ projectId: PROJECT_ID })

      expect(result.data).toEqual(fakeTasks)
    })

    it("returns FORBIDDEN when access is denied", async () => {
      denyAccess()

      const result = await getTasks({ projectId: PROJECT_ID })

      expect(result.serverError).toEqual({ code: "FORBIDDEN" })
    })
  })

  describe("createTask", () => {
    it("creates a task with valid data", async () => {
      const inserted = {
        id: TASK_ID,
        projectId: PROJECT_ID,
        name: "New Task",
        description: null,
        cost: null,
        status: "todo",
        priority: null,
        routineId: null,
        dueDate: null,
        assigneeId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      state.mock.onInsert(schema.tasksTable).respond([inserted])

      const result = await createTask({
        projectId: PROJECT_ID,
        name: "New Task",
        description: "",
        cost: "",
        status: "todo",
        priority: null,
        dueDate: null,
        assigneeId: null,
      })

      expect(result.serverError).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.data?.id).toBe(TASK_ID)
    })

    it("returns FORBIDDEN when not owner", async () => {
      grantAccess(false)

      const result = await createTask({
        projectId: PROJECT_ID,
        name: "New Task",
        description: "",
        cost: "",
        status: "todo",
        priority: null,
        dueDate: null,
        assigneeId: null,
      })

      expect(result.serverError).toEqual({ code: "FORBIDDEN" })
    })

    it("rejects missing required fields", async () => {
      const result = await createTask({
        projectId: PROJECT_ID,
        name: "",
        description: "",
        cost: "",
        status: "todo",
        priority: null,
        dueDate: null,
        assigneeId: null,
      })

      expect(result.validationErrors).toBeDefined()
    })
  })

  describe("updateTask", () => {
    it("updates an existing task", async () => {
      const updated = {
        id: TASK_ID,
        projectId: PROJECT_ID,
        name: "Updated",
        description: null,
        cost: null,
        status: "in_progress",
        priority: null,
        routineId: null,
        dueDate: null,
        assigneeId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      state.mock.onUpdate(schema.tasksTable).respond([updated])

      const result = await updateTask({
        projectId: PROJECT_ID,
        taskId: TASK_ID,
        name: "Updated",
        description: "",
        cost: "",
        status: "in_progress",
        priority: null,
        dueDate: null,
        assigneeId: null,
      })

      expect(result.serverError).toBeUndefined()
      expect(result.data?.id).toBe(TASK_ID)
    })

    it("returns NOT_FOUND when task does not exist", async () => {
      state.mock.onUpdate(schema.tasksTable).respond([])

      const result = await updateTask({
        projectId: PROJECT_ID,
        taskId: TASK_ID,
        name: "Updated",
        description: "",
        cost: "",
        status: "in_progress",
        priority: null,
        dueDate: null,
        assigneeId: null,
      })

      expect(result.serverError).toEqual({ code: "NOT_FOUND" })
    })
  })

  describe("updateTaskStatus", () => {
    it("allows owner to set any status", async () => {
      grantAccess(true)
      state.mock.onSelect(schema.tasksTable).respond([
        {
          status: "todo",
          assigneeId: USER_ID,
          routineId: null,
          dueDate: null,
        },
      ])
      state.mock.onUpdate(schema.tasksTable).respond([{ id: TASK_ID }])

      const result = await updateTaskStatus({
        projectId: PROJECT_ID,
        taskId: TASK_ID,
        status: "done",
      })

      expect(result.serverError).toBeUndefined()
    })

    it("allows collaborator to set in_progress", async () => {
      grantAccess(false)
      state.mock.onSelect(schema.tasksTable).respond([
        {
          status: "todo",
          assigneeId: USER_ID,
          routineId: null,
          dueDate: null,
        },
      ])
      state.mock.onUpdate(schema.tasksTable).respond([{ id: TASK_ID }])

      const result = await updateTaskStatus({
        projectId: PROJECT_ID,
        taskId: TASK_ID,
        status: "in_progress",
      })

      expect(result.serverError).toBeUndefined()
    })

    it("rejects collaborator setting to done", async () => {
      grantAccess(false)
      state.mock.onSelect(schema.tasksTable).respond([
        {
          status: "in_progress",
          assigneeId: USER_ID,
          routineId: null,
          dueDate: null,
        },
      ])

      const result = await updateTaskStatus({
        projectId: PROJECT_ID,
        taskId: TASK_ID,
        status: "done",
      })

      expect(result.serverError).toEqual({ code: "VALIDATION_FAILED" })
    })

    it("rejects collaborator updating done task", async () => {
      grantAccess(false)
      state.mock.onSelect(schema.tasksTable).respond([
        {
          status: "done",
          assigneeId: USER_ID,
          routineId: null,
          dueDate: null,
        },
      ])

      const result = await updateTaskStatus({
        projectId: PROJECT_ID,
        taskId: TASK_ID,
        status: "in_progress",
      })

      expect(result.serverError).toEqual({ code: "FORBIDDEN" })
    })
  })

  describe("updateTaskPriority", () => {
    it("updates priority as owner", async () => {
      grantAccess(true)
      state.mock.onUpdate(schema.tasksTable).respond([{ id: TASK_ID }])

      const result = await updateTaskPriority({
        projectId: PROJECT_ID,
        taskId: TASK_ID,
        priority: "high",
      })

      expect(result.serverError).toBeUndefined()
    })

    it("returns FORBIDDEN for collaborator", async () => {
      grantAccess(false)

      const result = await updateTaskPriority({
        projectId: PROJECT_ID,
        taskId: TASK_ID,
        priority: "high",
      })

      expect(result.serverError).toEqual({ code: "FORBIDDEN" })
    })
  })

  describe("deleteTask", () => {
    it("deletes as owner", async () => {
      grantAccess(true)
      state.mock.onDelete(schema.tasksTable).respond([{ id: TASK_ID }])

      const result = await deleteTask({
        projectId: PROJECT_ID,
        taskId: TASK_ID,
      })

      expect(result.serverError).toBeUndefined()
    })

    it("returns FORBIDDEN for collaborator", async () => {
      grantAccess(false)

      const result = await deleteTask({
        projectId: PROJECT_ID,
        taskId: TASK_ID,
      })

      expect(result.serverError).toEqual({ code: "FORBIDDEN" })
    })
  })
})
