import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({ auth: vi.fn(), hasPermission: vi.fn() }))
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
import { getMyTasks } from "@/actions/tasks"

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>

const USER_ID = "user-1"
const OWNER_ID = "owner-9"
const PROJECT_ID = "project-1"

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    assignmentId: "a1",
    taskId: "t1",
    projectId: PROJECT_ID,
    name: "Fix the roof",
    description: null,
    priority: null,
    status: "todo",
    comment: null,
    startDate: new Date("2026-10-30T09:00:00"),
    endDate: new Date("2026-10-30T11:00:00"),
    recurrence: null,
    ...overrides,
  }
}

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: PROJECT_ID,
    projectName: "Renovation",
    projectColor: "#0f766e",
    projectOwnerName: "Grace",
    primaryOwnerId: OWNER_ID,
    memberRole: "collaborator",
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  state.mock.resetMocks()
  mockAuth.mockResolvedValue({
    user: { id: USER_ID, role: "user", name: "Test" },
    expires: new Date().toISOString(),
  } as never)
  state.mock.onSelect(schema.projectsTable).respond([makeProject()])
  state.mock.onSelect(schema.taskCommentsTable).respond([])
})

describe("getMyTasks", () => {
  it("rejects an unknown view before the action runs", async () => {
    // @ts-expect-error simulating a raw client payload outside the enum
    const result = await getMyTasks({ view: "someday" })

    expect(result.validationErrors).toBeDefined()
    expect(result.data).toBeUndefined()
    expect(result.serverError).toBeUndefined()
  })

  it("returns only open assignments for the active view", async () => {
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respond([
        makeRow({ assignmentId: "open" }),
        makeRow({ assignmentId: "closed", status: "done" }),
      ])

    const result = await getMyTasks({ view: "active" })

    expect(result.data?.map((a) => a.assignmentId)).toEqual(["open"])
    expect(result.data?.[0]?.projectName).toBe("Renovation")
    expect(result.data?.[0]?.commentCount).toBe(0)
  })

  it("returns only terminal assignments for the past view", async () => {
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respond([
        makeRow({ assignmentId: "open" }),
        makeRow({ assignmentId: "closed", status: "done" }),
      ])

    const result = await getMyTasks({ view: "past" })

    expect(result.data?.map((a) => a.assignmentId)).toEqual(["closed"])
  })

  it("scopes the view query to the caller and keeps it join-free", async () => {
    let sqlText = ""
    let params: unknown[] = []
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respondWith((query, values) => {
        sqlText = query
        params = values
        return [makeRow()]
      })

    await getMyTasks({ view: "active" })

    expect(params).toContain(USER_ID)
    // Drizzle emits view columns unqualified, so joining any relation that
    // shares a column name (project.status, project_membership.user_id, ...)
    // makes the statement ambiguous. The view query must stand alone.
    expect(sqlText).not.toMatch(/\bjoin\b/i)
  })

  it("hides a removed collaborator's open assignment from active", async () => {
    state.mock.onSelect(schema.projectsTable).respond([
      // Not the owner, no membership row left: access is gone.
      makeProject({ primaryOwnerId: OWNER_ID, memberRole: null }),
    ])
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respond([
        makeRow({ assignmentId: "orphan-open" }),
        makeRow({ assignmentId: "orphan-closed", status: "cancelled" }),
      ])

    const active = await getMyTasks({ view: "active" })
    const past = await getMyTasks({ view: "past" })

    expect(active.data).toEqual([])
    expect(past.data?.map((a) => a.assignmentId)).toEqual([
      "orphan-closed",
    ])
  })

  it("carries the recurrence so the list can badge repeating work", async () => {
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respond([makeRow({ recurrence: "weekly" })])

    const result = await getMyTasks({ view: "active" })

    expect(result.data?.[0]?.recurrence).toBe("weekly")
  })

  it("includes an open assignment the caller still owns", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([
        makeProject({ primaryOwnerId: USER_ID, memberRole: null }),
      ])
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respond([makeRow()])

    const result = await getMyTasks({ view: "active" })

    expect(result.data?.map((a) => a.assignmentId)).toEqual(["a1"])
    expect(result.data?.[0]?.role).toBe("owner")
  })
})
