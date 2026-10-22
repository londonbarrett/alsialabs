import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  hasPermission: vi.fn(),
  isSuperUser: vi.fn(),
}))

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
import { auth, hasPermission, isSuperUser } from "@/lib/auth"
import { verifyProjectAccess } from "@/actions/not-safe/project-access"
import type {
  ProjectDetailDTO,
  ProjectOptionDTO,
} from "@/actions/schemas/project"
import {
  createProject,
  getProjects,
  getProjectsWithDetails,
  updateProject,
} from "@/actions/projects"

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>
const mockHasPermission = vi.mocked(hasPermission)
const mockIsSuperUser = vi.mocked(isSuperUser)
const mockVerifyProjectAccess = vi.mocked(verifyProjectAccess)

const PROJECT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00"
const CATEGORY_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"

function makeProjectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PROJECT_ID,
    primaryOwnerId: "user-1",
    categoryId: CATEGORY_ID,
    name: "New Project",
    description: null,
    status: "active",
    startDate: "2026-08-01",
    endDate: null,
    location: "Test Location",
    budget: null,
    color: "#3b82f6",
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  }
}

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
      state.mock
        .onInsert(schema.projectsTable)
        .respond([makeProjectRow()])
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
      state.mock
        .onUpdate(schema.projectsTable)
        .respond([makeProjectRow({ name: "Updated" })])

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

  describe("getProjects", () => {
    it("returns projects without checking the projects:view permission", async () => {
      mockIsSuperUser.mockReturnValue(false)
      const row: ProjectOptionDTO = {
        id: PROJECT_ID,
        primaryOwnerId: "user-1",
        categoryId: CATEGORY_ID,
        name: "Owned Project",
        description: null,
        status: "active",
        startDate: "2026-08-01",
        endDate: null,
        location: "Test Location",
        budget: null,
        color: "#3b82f6",
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        categorySlug: null,
        categoryName: null,
        ownerName: "Jane Doe",
      }
      state.mock.onSelect(schema.projectsTable).respond([row])
      const result = await getProjects()
      expect(result.data).toHaveLength(1)
      expect(mockHasPermission).not.toHaveBeenCalled()
    })
  })

  describe("getProjectsWithDetails", () => {
    it("counts invoice paidAmount toward project spend", async () => {
      mockIsSuperUser.mockReturnValue(false)
      const PROJECT: ProjectDetailDTO = {
        id: PROJECT_ID,
        primaryOwnerId: "user-1",
        categoryId: CATEGORY_ID,
        name: "Owned Project",
        description: null,
        status: "active",
        startDate: "2026-08-01",
        endDate: null,
        location: "Test Location",
        budget: null,
        color: "#3b82f6",
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        categorySlug: null,
        categoryName: null,
      }
      state.mock.onSelect(schema.projectsTable).respond([PROJECT])
      state.mock
        .onSelect(schema.tasksTable)
        .respondWith((sql) =>
          sql.includes("count(")
            ? [{ projectId: PROJECT.id, total: 2, completed: 1 }]
            : sql.includes("cost")
              ? [{ projectId: PROJECT.id, total: "40" }]
              : []
        )
      state.mock
        .onSelect(schema.expensesTable)
        .respond([{ projectId: PROJECT.id, total: "50" }])
      let invoiceSql = ""
      state.mock.onSelect(schema.invoicesTable).respondWith((sql) => {
        invoiceSql = sql
        return [{ projectId: PROJECT.id, total: "30" }]
      })
      state.mock.onSelect(schema.projectOwnersTable).respond([])
      state.mock.onSelect(schema.projectCollaboratorsTable).respond([])

      const result = await getProjectsWithDetails()

      expect(result.data?.[0]?.expenses).toBe(120) // 50 expenses + 40 tasks + 30 invoices
      expect(invoiceSql).toContain("paid_amount")
      expect(invoiceSql).not.toContain("grand_total")
    })
  })
})
