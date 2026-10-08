import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  hasPermission: vi.fn(),
  isSuperUser: vi.fn(),
}))

vi.mock("@/actions/project-access", () => ({
  verifyProjectAccess: vi.fn(),
}))

vi.mock("@/actions/stores", () => ({
  getEffectiveStoreId: vi.fn(),
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
import { verifyProjectAccess } from "@/actions/project-access"
import { revalidatePath } from "next/cache"
import {
  createNextRoutineTask,
  createRoutine,
  deleteRoutine,
  getProjectRoutines,
  updateRoutine,
} from "@/actions/routines"

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>
const mockHasPermission = vi.mocked(hasPermission)
const mockVerifyProjectAccess = vi.mocked(verifyProjectAccess)
const mockRevalidatePath = vi.mocked(revalidatePath)

const PROJECT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00"
const ROUTINE_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const TASK_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33"
const PROJECT_PATH = `/app/proyectos/${PROJECT_ID}`

const ROUTINE = {
  id: ROUTINE_ID,
  projectId: PROJECT_ID,
  name: "Water the plants",
  description: null,
  cost: null,
  recurrence: "weekly",
  interval: 1,
  daysOfWeek: ["monday"],
  time: "08:00",
  startDate: null,
  endDate: null,
  assigneeId: null,
  createdAt: new Date("2026-08-01T10:00:00Z"),
  updatedAt: new Date("2026-08-01T10:00:00Z"),
}

const TASK = {
  id: TASK_ID,
  projectId: PROJECT_ID,
  routineId: ROUTINE_ID,
  name: "Water the plants",
  description: null,
  cost: null,
  status: "todo",
  priority: null,
  dueDate: new Date("2026-08-03T08:00:00Z"),
  assigneeId: null,
  createdAt: new Date("2026-08-01T10:00:00Z"),
  updatedAt: new Date("2026-08-01T10:00:00Z"),
}

const validRoutineInput = {
  projectId: PROJECT_ID,
  name: "Water the plants",
  description: "",
  cost: "",
  recurrence: "weekly" as const,
  interval: 1,
  daysOfWeek: ["monday"],
  time: "08:00",
  startDate: "",
  endDate: "",
  assigneeId: null,
}

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

describe("routines actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.mock.resetMocks()
    mockAuth.mockResolvedValue({
      user: { id: "user-1", role: "user", name: "Test" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    })
    mockHasPermission.mockResolvedValue(true)
    grantAccess()
  })

  describe("getProjectRoutines", () => {
    it("returns the routines of an accessible project", async () => {
      state.mock.onSelect(schema.routinesTable).respond([ROUTINE])

      const result = await getProjectRoutines({ projectId: PROJECT_ID })

      expect(result.data).toEqual([ROUTINE])
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "projects",
        "view"
      )
      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(
        PROJECT_ID,
        "user-1",
        "user"
      )
    })

    it("returns FORBIDDEN when access is denied", async () => {
      denyAccess()

      const result = await getProjectRoutines({ projectId: PROJECT_ID })

      expect(result.serverError).toEqual({ code: "FORBIDDEN" })
    })

    it("returns UNAUTHORIZED without a session", async () => {
      mockAuth.mockResolvedValue(null)

      const result = await getProjectRoutines({ projectId: PROJECT_ID })

      expect(result.serverError).toEqual({ code: "UNAUTHORIZED" })
    })
  })

  describe("createRoutine", () => {
    it("creates a routine and spawns its first task", async () => {
      state.mock.onInsert(schema.routinesTable).respond([ROUTINE])
      state.mock.onSelect(schema.routinesTable).respond([ROUTINE])
      state.mock.onSelect(schema.tasksTable).respond([])
      state.mock.onInsert(schema.tasksTable).respond([TASK])

      const result = await createRoutine(validRoutineInput)

      expect(result.serverError).toBeUndefined()
      expect(result.data).toEqual(ROUTINE)
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "projects",
        "edit"
      )
      expect(mockRevalidatePath).toHaveBeenCalledWith(PROJECT_PATH)
    })

    it("returns FORBIDDEN when the user is not the project owner", async () => {
      grantAccess(false)

      const result = await createRoutine(validRoutineInput)

      expect(result.serverError).toEqual({ code: "FORBIDDEN" })
      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })

    it("rejects an end date before the start date", async () => {
      const result = await createRoutine({
        ...validRoutineInput,
        startDate: "2026-12-10",
        endDate: "2026-12-01",
      })

      expect(result.validationErrors).toBeDefined()
      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })

    it("rejects a missing name", async () => {
      const result = await createRoutine({
        ...validRoutineInput,
        name: "",
      })

      expect(result.validationErrors).toBeDefined()
    })
  })

  describe("updateRoutine", () => {
    it("updates a routine as the project owner", async () => {
      state.mock.onUpdate(schema.routinesTable).respond([ROUTINE])

      const result = await updateRoutine({
        ...validRoutineInput,
        routineId: ROUTINE_ID,
      })

      expect(result.serverError).toBeUndefined()
      expect(result.data).toEqual(ROUTINE)
      expect(mockRevalidatePath).toHaveBeenCalledWith(PROJECT_PATH)
    })

    it("returns NOT_FOUND when the routine does not exist", async () => {
      state.mock.onUpdate(schema.routinesTable).respond([])

      const result = await updateRoutine({
        ...validRoutineInput,
        routineId: ROUTINE_ID,
      })

      expect(result.serverError).toEqual({ code: "NOT_FOUND" })
      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })

    it("returns FORBIDDEN when the user is not the project owner", async () => {
      grantAccess(false)

      const result = await updateRoutine({
        ...validRoutineInput,
        routineId: ROUTINE_ID,
      })

      expect(result.serverError).toEqual({ code: "FORBIDDEN" })
    })

    it("rejects an end date before the start date", async () => {
      const result = await updateRoutine({
        ...validRoutineInput,
        routineId: ROUTINE_ID,
        startDate: "2026-12-10",
        endDate: "2026-12-01",
      })

      expect(result.validationErrors).toBeDefined()
    })
  })

  describe("deleteRoutine", () => {
    it("deletes a routine as the project owner", async () => {
      state.mock.onDelete(schema.routinesTable).respond([])

      const result = await deleteRoutine({
        projectId: PROJECT_ID,
        routineId: ROUTINE_ID,
      })

      expect(result.serverError).toBeUndefined()
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "projects",
        "delete"
      )
      expect(mockRevalidatePath).toHaveBeenCalledWith(PROJECT_PATH)
    })

    it("returns FORBIDDEN when the user is not the project owner", async () => {
      grantAccess(false)

      const result = await deleteRoutine({
        projectId: PROJECT_ID,
        routineId: ROUTINE_ID,
      })

      expect(result.serverError).toEqual({ code: "FORBIDDEN" })
      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })
  })

  describe("createNextRoutineTask", () => {
    it("spawns the next open instance", async () => {
      state.mock.onSelect(schema.routinesTable).respond([ROUTINE])
      state.mock.onSelect(schema.tasksTable).respond([])
      state.mock.onInsert(schema.tasksTable).respond([TASK])

      const result = await createNextRoutineTask({
        routineId: ROUTINE_ID,
      })

      expect(result.serverError).toBeUndefined()
      expect(result.data?.spawned).toBe(true)
      expect(result.data?.task).toEqual(TASK)
      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(
        PROJECT_ID,
        "user-1",
        "user"
      )
    })

    it("does not spawn while an instance is still open", async () => {
      state.mock.onSelect(schema.routinesTable).respond([ROUTINE])
      state.mock.onSelect(schema.tasksTable).respond([{ id: TASK_ID }])

      const result = await createNextRoutineTask({
        routineId: ROUTINE_ID,
      })

      expect(result.data).toEqual({ spawned: false })
    })

    it("returns NOT_FOUND when the routine does not exist", async () => {
      state.mock.onSelect(schema.routinesTable).respond([])

      const result = await createNextRoutineTask({
        routineId: ROUTINE_ID,
      })

      expect(result.serverError).toEqual({ code: "NOT_FOUND" })
    })

    it("returns FORBIDDEN when the user is not the project owner", async () => {
      state.mock.onSelect(schema.routinesTable).respond([ROUTINE])
      grantAccess(false)

      const result = await createNextRoutineTask({
        routineId: ROUTINE_ID,
      })

      expect(result.serverError).toEqual({ code: "FORBIDDEN" })
    })

    it("returns UNAUTHORIZED without a session", async () => {
      mockAuth.mockResolvedValue(null)

      const result = await createNextRoutineTask({
        routineId: ROUTINE_ID,
      })

      expect(result.serverError).toEqual({ code: "UNAUTHORIZED" })
    })
  })
})
