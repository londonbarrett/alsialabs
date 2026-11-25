import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  hasPermission: vi.fn(),
  isSuperUser: vi.fn(),
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
import { toDateKey } from "@/lib/util/schedule"
import { getCalendarAssignments } from "@/actions/calendar"
import { resolveCalendarRange } from "@/actions/calendar/util"

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
    startTime: "09:00",
    dateKey: "2026-10-30",
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
    timeZone: "America/Bogota",
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

  it("exposes each assignment's project zone and task start time", async () => {
    state.mock.onSelect(schema.projectsTable).respond([
      makeProject({ timeZone: "America/Bogota" }),
    ])
    state.mock.onSelect(schema.taskAssignmentDetailView).respond([
      makeRow({ userId: USER_ID, startTime: "21:00" }),
    ])

    const result = await getCalendarAssignments({
      from: "2026-10-01",
      to: "2026-10-31",
    })

    expect(result.data?.[0]?.timeZone).toBe("America/Bogota")
    expect(result.data?.[0]?.startTime).toBe("21:00")
  })

  it("derives the project-zone day key on the server", async () => {
    const boundary = new Date("2026-11-25T02:00:00.000Z")
    const range = { from: "2026-11-01", to: "2026-11-30" }
    state.mock.onSelect(schema.taskAssignmentDetailView).respond([
      makeRow({ userId: USER_ID, startDate: boundary }),
    ])

    state.mock.onSelect(schema.projectsTable).respond([
      makeProject({ timeZone: "America/Bogota" }),
    ])
    const bogota = await getCalendarAssignments(range)
    expect(bogota.data?.[0]?.dateKey).toBe("2026-11-24")

    state.mock.onSelect(schema.projectsTable).respond([
      makeProject({ timeZone: "UTC" }),
    ])
    const utc = await getCalendarAssignments(range)
    expect(utc.data?.[0]?.dateKey).toBe("2026-11-25")
  })

  it("coerces the driver's raw startDate before deriving the calendar date", async () => {
    state.mock.onSelect(schema.taskAssignmentDetailView).respond([
      makeRow({
        userId: USER_ID,
        startDate: "2026-11-24 05:00:00+00",
        endDate: "2026-11-24 06:00:00+00",
      }),
    ])
    state.mock.onSelect(schema.projectsTable).respond([
      makeProject({ timeZone: "America/Bogota" }),
    ])

    const result = await getCalendarAssignments({
      from: "2026-11-01",
      to: "2026-11-30",
    })

    expect(result.serverError).toBeUndefined()
    expect(result.data).toHaveLength(1)
    expect(result.data?.[0]?.dateKey).toBe("2026-11-24")
    expect(result.data?.[0]?.startDate).toBeInstanceOf(Date)
  })

  it("widens explicit range bounds by a day on each side", () => {
    const range = resolveCalendarRange({
      from: "2026-11-25",
      to: "2026-11-25",
    })

    // Bounds are host-local days, but events are placed by their project-zone
    // date. A one-day buffer keeps an adjacent-zone event inside the query.
    expect(toDateKey(range.from)).toBe("2026-11-24")
    expect(toDateKey(range.to)).toBe("2026-11-26")
    expect(range.from.getTime()).toBeLessThanOrEqual(
      new Date("2026-11-24T23:30:00.000Z").getTime()
    )
  })

  it("rejects a missing session", async () => {
    mockAuth.mockResolvedValue(null)

    const result = await getCalendarAssignments({})

    expect(result.serverError).toEqual({ code: "UNAUTHORIZED" })
  })
})
