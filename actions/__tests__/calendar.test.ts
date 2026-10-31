import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))

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

beforeEach(() => {
  vi.clearAllMocks()
  state.mock.resetMocks()
  mockAuth.mockResolvedValue({
    user: { id: "user-1" },
    expires: new Date().toISOString(),
  } as never)
})

describe("getCalendarAssignments", () => {
  it("returns the visible assignments scoped by assignment or project role", async () => {
    let sqlText = ""
    state.mock
      .onSelect(schema.taskAssignmentDetailView)
      .respondWith((sql) => {
        sqlText = sql
        return [
          {
            assignmentId: "a1",
            taskId: "t1",
            taskName: "Clean",
            status: "todo",
            priority: null,
            startDate: new Date("2026-10-30T09:00:00"),
            endDate: new Date("2026-10-30T11:00:00"),
            projectId: "p1",
            projectName: "Home",
            projectColor: "#3b82f6",
            projectOwnerName: "Owner",
            userName: "Ana",
            userImage: null,
            comment: null,
            commentCount: 0,
            recurrence: null,
          },
        ]
      })

    const result = await getCalendarAssignments({
      from: "2026-10-01",
      to: "2026-10-31",
    })

    expect(result.data).toHaveLength(1)
    expect(sqlText).toContain("project_membership")
    expect(sqlText).toContain("primary_owner_id")
  })

  it("rejects a missing session", async () => {
    mockAuth.mockResolvedValue(null)

    const result = await getCalendarAssignments()

    expect(result.serverError).toEqual({ code: "UNAUTHORIZED" })
  })
})
