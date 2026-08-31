import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  hasPermission: vi.fn(),
  isSuperUser: vi.fn(),
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
import { auth, hasPermission, isSuperUser } from "@/lib/auth"
import { verifyProjectAccess } from "@/lib/actions/project-access"
import { createProject, updateProject } from "@/lib/actions/projects"

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>
const mockHasPermission = vi.mocked(hasPermission)
const mockIsSuperUser = vi.mocked(isSuperUser)
const mockVerifyProjectAccess = vi.mocked(verifyProjectAccess)

const PROJECT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00"
const CATEGORY_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"

function grantAccess(isOwner = true) {
  mockVerifyProjectAccess.mockResolvedValue({
    hasAccess: true,
    isOwner,
  })
}

describe("projects actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.mock.resetMocks()
    mockAuth.mockResolvedValue({
      user: { id: "user-1", role: "user", name: "Test" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    })
    mockHasPermission.mockResolvedValue(true)
    mockIsSuperUser.mockReturnValue(false)
    grantAccess(true)
  })

  describe("createProject", () => {
    it("creates a project with valid data", async () => {
      state.mock.onInsert(schema.projectsTable).respond([{ id: PROJECT_ID }])
      state.mock.onInsert(schema.projectOwnersTable).respond([])

      const result = await createProject({
        name: "New Project",
        categoryId: CATEGORY_ID,
        status: "active",
        description: "",
        startDate: "2026-08-01",
        endDate: "",
        location: "Test Location",
        budget: "",
        color: "#3b82f6",
      })

      expect(result.serverError).toBeUndefined()
      expect(result.data).toBeDefined()
    })

    it("rejects missing required fields", async () => {
      const result = await createProject({
        name: "",
        categoryId: "",
        status: "active",
        description: "",
        startDate: "",
        endDate: "",
        location: "",
        budget: "",
        color: "#3b82f6",
      })

      expect(result.validationErrors).toBeDefined()
    })
  })

  describe("updateProject", () => {
    it("updates an existing project as owner", async () => {
      state.mock.onUpdate(schema.projectsTable).respond([{ id: PROJECT_ID }])

      const result = await updateProject({
        projectId: PROJECT_ID,
        name: "Updated",
        categoryId: CATEGORY_ID,
        status: "active",
        description: "",
        startDate: "2026-08-01",
        endDate: "",
        location: "Test Location",
        budget: "",
        color: "#3b82f6",
      })

      expect(result.serverError).toBeUndefined()
    })

    it("returns FORBIDDEN when not owner", async () => {
      grantAccess(false)

      const result = await updateProject({
        projectId: PROJECT_ID,
        name: "Updated",
        categoryId: CATEGORY_ID,
        status: "active",
        description: "",
        startDate: "2026-08-01",
        endDate: "",
        location: "Test Location",
        budget: "",
        color: "#3b82f6",
      })

      expect(result.serverError).toEqual({ code: "FORBIDDEN" })
    })

    it("returns NOT_FOUND when project does not exist", async () => {
      state.mock.onUpdate(schema.projectsTable).respond([])

      const result = await updateProject({
        projectId: PROJECT_ID,
        name: "Updated",
        categoryId: CATEGORY_ID,
        status: "active",
        description: "",
        startDate: "2026-08-01",
        endDate: "",
        location: "Test Location",
        budget: "",
        color: "#3b82f6",
      })

      expect(result.serverError).toEqual({ code: "NOT_FOUND" })
    })
  })
})
