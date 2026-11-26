import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  hasPermission: vi.fn(),
  isSuperUser: vi.fn(),
  getUserPermissions: vi.fn(),
}))

vi.mock("@/actions/legacy/categories", () => ({
  getProjectCategories: vi.fn(),
}))

vi.mock("@/actions/projects/util", () => ({
  resolveProjectAccess: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}))

const state = vi.hoisted(() => ({
  mock: null as unknown as {
    calls: { sql: string; params: unknown[]; timestamp: number }[]
    resetMocks(): void
    resetCalls(): void
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
    }
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
import { db } from "@/lib/drizzle/client"
import {
  auth,
  hasPermission,
  isSuperUser,
  getUserPermissions,
} from "@/lib/auth"
import { getProjectCategories } from "@/actions/legacy/categories"
import { resolveProjectAccess } from "@/actions/projects/util"
import { ProjectSchema } from "@/actions/projects/schemas"
import type {
  ProjectDetailDTO,
  ProjectOptionDTO,
} from "@/actions/projects/schemas"
import {
  createProject,
  getProjects,
  getProjectsWithDetails,
  updateProject,
  getProjectForEdit,
  getProjectContext,
} from "@/actions/projects"

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>
const mockHasPermission = vi.mocked(hasPermission)
const mockIsSuperUser = vi.mocked(isSuperUser)
const mockGetUserPermissions = vi.mocked(getUserPermissions)
const mockGetProjectCategories = vi.mocked(getProjectCategories)
const mockResolveAccess = vi.mocked(resolveProjectAccess)

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
    country: "CO",
    timeZone: "America/Bogota",
    budget: null,
    color: "#3b82f6",
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  }
}

function grantAccess(isOwner = true) {
  mockResolveAccess.mockResolvedValue({
    hasAccess: true,
    role: isOwner ? "owner" : "collaborator",
  })
}

describe("projects actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.mock.resetMocks()
    state.mock.resetCalls()
    mockAuth.mockResolvedValue({
      user: { id: "user-1", role: "user", name: "Test" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    })
    mockHasPermission.mockResolvedValue(true)
    mockIsSuperUser.mockReturnValue(false)
    mockGetUserPermissions.mockResolvedValue([])
    mockGetProjectCategories.mockResolvedValue({ data: [] } as never)
    grantAccess(true)
  })

  describe("createProject", () => {
    it("creates a project with valid data", async () => {
      state.mock
        .onInsert(schema.projectsTable)
        .respond([makeProjectRow()])

      const result = await createProject({
        name: "New Project",
        categoryId: CATEGORY_ID,
        status: "active",
        description: "",
        startDate: "2026-08-01",
        endDate: "",
        location: "Test Location",
        country: "CO",
        budget: "",
        color: "#3b82f6",
      })

      expect(result.serverError).toBeUndefined()
      expect(result.data).toBeDefined()
    })

    it("persists the supplied country", async () => {
      let insertParams: unknown[] = []
      state.mock
        .onInsert(schema.projectsTable)
        .respondWith((_sql, params) => {
          insertParams = params
          return [makeProjectRow({ country: "MX" })]
        })

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
        country: "MX",
      })

      expect(result.serverError).toBeUndefined()
      expect(insertParams).toContain("MX")
    })

    it("requires a country", () => {
      const result = ProjectSchema.safeParse({
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

      expect(result.success).toBe(false)
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
        country: "CO",
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
        country: "CO",
        budget: "",
        color: "#3b82f6",
      })

      expect(result.serverError).toBeUndefined()
    })

    it("updates the project country", async () => {
      let updateParams: unknown[] = []
      state.mock
        .onUpdate(schema.projectsTable)
        .respondWith((_sql, params) => {
          updateParams = params
          return [makeProjectRow({ country: "BR" })]
        })

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
        country: "BR",
      })

      expect(result.serverError).toBeUndefined()
      expect(updateParams).toContain("BR")
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
        country: "CO",
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
        country: "CO",
        budget: "",
        color: "#3b82f6",
      })

      expect(result.serverError).toEqual({ code: "NOT_FOUND" })
    })
  })

  describe("time zone", () => {
    const zoneInput = {
      name: "New Project",
      categoryId: CATEGORY_ID,
      status: "active" as const,
      description: "",
      startDate: "2026-08-01",
      endDate: "",
      location: "Test Location",
      country: "CO" as const,
      budget: "",
      color: "#3b82f6" as const,
    }

    it("stores the country's default zone when none is supplied", async () => {
      let insertParams: unknown[] = []
      state.mock
        .onInsert(schema.projectsTable)
        .respondWith((_sql, params) => {
          insertParams = params
          return [makeProjectRow({ timeZone: "America/Bogota" })]
        })

      const result = await createProject(zoneInput)

      expect(result.serverError).toBeUndefined()
      expect(insertParams).toContain("America/Bogota")
      expect(result.data?.timeZone).toBe("America/Bogota")
    })

    it("stores an explicitly chosen supported zone", async () => {
      let insertParams: unknown[] = []
      state.mock
        .onInsert(schema.projectsTable)
        .respondWith((_sql, params) => {
          insertParams = params
          return [makeProjectRow({ timeZone: "America/Mexico_City" })]
        })

      const result = await createProject({
        ...zoneInput,
        timeZone: "America/Mexico_City",
      })

      expect(result.serverError).toBeUndefined()
      expect(insertParams).toContain("America/Mexico_City")
      expect(result.data?.timeZone).toBe("America/Mexico_City")
    })

    it("rejects an unsupported zone", async () => {
      const result = await createProject({
        ...zoneInput,
        timeZone: "Mars/Olympus",
      })

      expect(result.validationErrors).toBeDefined()
    })

    it("leaves task and assignment timestamps untouched when only the zone changes", async () => {
      const taskInstant = new Date("2026-08-01T09:00:00.000Z")
      const assignmentInstant = new Date("2026-08-02T15:30:00.000Z")
      state.mock
        .onSelect(schema.tasksTable)
        .respond([{ startDate: taskInstant }])
      state.mock
        .onSelect(schema.taskAssignmentsTable)
        .respond([{ startDate: assignmentInstant }])

      const readTimestamps = async () => {
        const [task] = await db
          .select({ startDate: schema.tasksTable.startDate })
          .from(schema.tasksTable)
        const [assignment] = await db
          .select({ startDate: schema.taskAssignmentsTable.startDate })
          .from(schema.taskAssignmentsTable)
        return { task: task?.startDate, assignment: assignment?.startDate }
      }

      const before = await readTimestamps()
      expect(before.task).toEqual(taskInstant)

      let projectUpdateSql = ""
      state.mock
        .onUpdate(schema.projectsTable)
        .respondWith((sql) => {
          projectUpdateSql = sql
          return [makeProjectRow({ timeZone: "America/Mexico_City" })]
        })

      const result = await updateProject({
        ...zoneInput,
        projectId: PROJECT_ID,
        timeZone: "America/Mexico_City",
      })

      const after = await readTimestamps()
      const updateCalls = state.mock.calls.filter((call) =>
        call.sql.startsWith("update")
      )

      expect(result.serverError).toBeUndefined()
      const setClause = projectUpdateSql.slice(
        0,
        projectUpdateSql.indexOf(" where ")
      )
      expect(setClause).toContain('"time_zone" = ')
      // Only the project row is touched: no task, assignment, comment or
      // expense timestamp is rewritten when the zone changes.
      expect(updateCalls).toHaveLength(1)
      expect(updateCalls[0]?.sql).toContain('update "project"')
      expect(after).toEqual(before)
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
        country: "CO",
        timeZone: "America/Bogota",
        budget: null,
        color: "#3b82f6",
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        categorySlug: null,
        categoryName: null,
        ownerName: "Jane Doe",
      }
      let projectSql = ""
      state.mock.onSelect(schema.projectsTable).respondWith((sql) => {
        projectSql = sql
        return [row]
      })
      const result = await getProjects()
      expect(result.data).toHaveLength(1)
      expect(mockHasPermission).not.toHaveBeenCalled()
      expect(mockIsSuperUser).not.toHaveBeenCalled()
      expect(projectSql).toContain("project_membership")
      expect(projectSql).toContain("primary_owner_id")
    })

    it("scopes the list to owners and admins, never plain collaborators", async () => {
      let projectSql = ""
      state.mock.onSelect(schema.projectsTable).respondWith((sql) => {
        projectSql = sql
        return []
      })

      const result = await getProjects()

      expect(result.data).toEqual([])
      expect(projectSql).toContain(`"role" = 'admin'`)
    })

    it("scopes the detail list the same way", async () => {
      let projectSql = ""
      state.mock.onSelect(schema.projectsTable).respondWith((sql) => {
        if (sql.includes('inner join "user"')) return []
        projectSql = sql
        return []
      })
      state.mock.onSelect(schema.tasksTable).respond([])
      state.mock.onSelect(schema.expensesTable).respond([])
      state.mock.onSelect(schema.invoicesTable).respond([])
      state.mock.onSelect(schema.projectMembershipTable).respond([])

      const result = await getProjectsWithDetails()

      expect(result.data).toEqual([])
      expect(projectSql).toContain(`"role" = 'admin'`)
    })
  })

  describe("getProjectsWithDetails", () => {
    it("counts expenses, paid invoices and closed task costs toward project spend", async () => {
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
        country: "CO",
        timeZone: "America/Bogota",
        budget: null,
        color: "#3b82f6",
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        categorySlug: null,
        categoryName: null,
      }
      state.mock.onSelect(schema.projectsTable).respondWith((sql) =>
        sql.includes('inner join "user"')
          ? [
              {
                projectId: PROJECT.id,
                userId: "user-1",
                name: "Owner",
                image: null,
              },
            ]
          : [PROJECT]
      )
      state.mock.onSelect(schema.tasksTable).respondWith((sql) =>
        sql.includes("count(")
          ? [{ projectId: PROJECT.id, total: 2, completed: 1 }]
          : []
      )
      let taskCostSql = ""
      state.mock.onSelect(schema.taskAssignmentsTable).respondWith((sql) => {
        if (sql.includes("sum(")) taskCostSql = sql
        return sql.includes("sum(")
          ? [{ projectId: PROJECT.id, total: "25" }]
          : []
      })
      state.mock
        .onSelect(schema.expensesTable)
        .respond([{ projectId: PROJECT.id, total: "50" }])
      let invoiceSql = ""
      state.mock.onSelect(schema.invoicesTable).respondWith((sql) => {
        invoiceSql = sql
        return [{ projectId: PROJECT.id, total: "30" }]
      })
      state.mock.onSelect(schema.projectMembershipTable).respond([])

      const result = await getProjectsWithDetails()

      // 50 expenses + 30 paid invoices + 25 closed task costs.
      expect(result.data?.[0]?.expenses).toBe(105)
      // Task money only counts once the assignment is closed.
      expect(taskCostSql).toContain("case when")
      expect(invoiceSql).toContain("paid_amount")
      expect(invoiceSql).not.toContain("grand_total")
    })

    it("includes country in the summary output", async () => {
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
        country: "AR",
        timeZone: "America/Bogota",
        budget: null,
        color: "#3b82f6",
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        categorySlug: null,
        categoryName: null,
      }
      state.mock
        .onSelect(schema.projectsTable)
        .respondWith((sql) =>
          sql.includes('inner join "user"') ? [] : [PROJECT]
        )
      state.mock.onSelect(schema.tasksTable).respond([])
      state.mock.onSelect(schema.taskAssignmentsTable).respond([])
      state.mock.onSelect(schema.expensesTable).respond([])
      state.mock.onSelect(schema.invoicesTable).respond([])
      state.mock.onSelect(schema.projectMembershipTable).respond([])

      const result = await getProjectsWithDetails()

      expect(result.data?.[0]?.country).toBe("AR")
    })
  })

  describe("getProjectForEdit", () => {
    it("returns the record without the shared query's category fields", async () => {
      state.mock
        .onSelect(schema.projectsTable)
        .respond([
          makeProjectRow({
            country: "AR",
            categorySlug: "dev",
            categoryName: "Dev",
          }),
        ])

      const result = await getProjectForEdit({ projectId: PROJECT_ID })

      expect(result.serverError).toBeUndefined()
      expect(result.data?.id).toBe(PROJECT_ID)
      expect(result.data?.country).toBe("AR")
      expect(result.data && "categorySlug" in result.data).toBe(false)
      expect(result.data && "categoryName" in result.data).toBe(false)
    })
  })

  describe("getProjectContext", () => {
    it("returns the project, members, permissions and categories", async () => {
      grantAccess(true)
      state.mock
        .onSelect(schema.projectsTable)
        .respond([
          makeProjectRow({ categorySlug: null, categoryName: null }),
        ])
      state.mock.onSelect(schema.usersTable).respond([])
      state.mock.onSelect(schema.projectMembershipTable).respond([])

      const result = await getProjectContext({ projectId: PROJECT_ID })

      expect(result.serverError).toBeUndefined()
      expect(result.data?.project.id).toBe(PROJECT_ID)
      expect(result.data?.currentUserId).toBe("user-1")
      expect(Array.isArray(result.data?.members)).toBe(true)
      expect(Array.isArray(result.data?.permissions)).toBe(true)
      expect(Array.isArray(result.data?.categories)).toBe(true)
    })

    it("returns FORBIDDEN when the caller has no project access", async () => {
      mockResolveAccess.mockResolvedValue({
        hasAccess: false,
        role: null,
      })

      const result = await getProjectContext({ projectId: PROJECT_ID })

      expect(result.serverError).toEqual({ code: "FORBIDDEN" })
    })
  })
})
