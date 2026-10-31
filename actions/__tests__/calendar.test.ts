import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({ auth: vi.fn(), hasPermission: vi.fn() }))

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
import { getCalendarAssignments } from "@/actions/not-safe/calendar"

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>

const USER_ID = "user-1"
const OWNER_ID = "owner-9"
const PROJECT_ID = "project-1"

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    assignmentId: "a1",
    taskId: "t1",
    taskName: "Clean the studio",
    status: "todo",
    priority: null,
    startDate: new Date("2026-10-30T09:00:00"),
    endDate: new Date("2026-10-30T11:00:00"),
    projectId: PROJECT_ID,
    userId: "someone-else",
    recurrence: null,
    userName: "Ana",
    userEmail: "ana@test.local",
    userImage: null,
    comment: null,
    ...overrides,
  }
}

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: PROJECT_ID,
    projectName: "Home",
    projectColor: "#3b82f6",
    projectOwnerName: "Owner",
    primaryOwnerId: OWNER_ID,
    memberRole: "admin",
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

describe("getCalendarAssignments", () => {
  it("returns the caller's visible assignments enriched with the project", async () => {
    state.mock.onSelect(schema.taskAssignmentDetailView).respond([
      makeRow({ userId: USER_ID }),
    ])

    const result = await getCalendarAssignments({
      from: "2026-10-01",
      to: "2026-10-31",
    })

    expect(result.data).toHaveLength(1)
    expect(result.data?.[0]?.projectName).toBe("Home")
    expect(result.data?.[0]?.projectOwnerName).toBe("Owner")
  })

  it("keeps an assignment the caller holds even without a project role", async () => {
    state.mock.onSelect(schema.projectsTable).respond([
      makeProject({ primaryOwnerId: OWNER_ID, memberRole: null }),
    ])
    state.mock.onSelect(schema.taskAssignmentDetailView).respond([
      makeRow({ userId: USER_ID }),
    ])

    const result = await getCalendarAssignments({
      from: "2026-10-01",
      to: "2026-10-31",
    })

    expect(result.data).toHaveLength(1)
  })

  it("hides another person's assignment on a project the caller cannot manage", async () => {
    state.mock.onSelect(schema.projectsTable).respond([
      makeProject({ primaryOwnerId: OWNER_ID, memberRole: "collaborator" }),
    ])
    state.mock.onSelect(schema.taskAssignmentDetailView).respond([
      makeRow({ userId: "someone-else" }),
    ])

    const result = await getCalendarAssignments({
      from: "2026-10-01",
      to: "2026-10-31",
    })

    expect(result.data).toEqual([])
  })

  it("keeps the view query join-free", async () => {
    let sqlText = ""
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respondWith((query) => {
        sqlText = query
        return [makeRow({ userId: USER_ID })]
      })

    await getCalendarAssignments({
      from: "2026-10-01",
      to: "2026-10-31",
    })

    // View columns are emitted unqualified, so the statement must not join a
    // relation that shares a column name with the view.
    expect(sqlText).not.toMatch(/\bjoin\b/i)
  })

  it("sends the range bounds to the view as ISO strings", async () => {
    let params: unknown[] = []
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respondWith((_query, values) => {
        params = values
        return [makeRow({ userId: USER_ID })]
      })

    await getCalendarAssignments({
      from: "2026-10-01",
      to: "2026-10-31",
    })

    // The view's date columns carry no type for drizzle, so a Date parameter
    // cannot be serialized against them; they must cross as ISO strings.
    expect(params.length).toBeGreaterThan(0)
    expect(params.every((p) => typeof p === "string")).toBe(true)
  })

  it("rejects a missing session", async () => {
    mockAuth.mockResolvedValue(null)

    const result = await getCalendarAssignments()

    expect(result.serverError).toEqual({ code: "UNAUTHORIZED" })
  })
})
