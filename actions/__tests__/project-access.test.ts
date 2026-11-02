import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  mock: null as unknown as {
    resetMocks(): void
    onSelect(table: unknown): { respond(data: unknown): unknown }
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
import { verifyProjectAccess } from "@/actions/not-safe/project-access"

const PROJECT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const USER_ID = "user-1"

beforeEach(() => {
  state.mock.resetMocks()
})

describe("verifyProjectAccess", () => {
  it("returns owner for the primary owner", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: USER_ID }])
    state.mock.onSelect(schema.projectMembershipTable).respond([])

    await expect(
      verifyProjectAccess(PROJECT_ID, USER_ID)
    ).resolves.toEqual({
      hasAccess: true,
      role: "owner",
    })
  })

  it("returns admin from membership", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: "someone-else" }])
    state.mock
      .onSelect(schema.projectMembershipTable)
      .respond([{ role: "admin" }])

    await expect(
      verifyProjectAccess(PROJECT_ID, USER_ID)
    ).resolves.toEqual({
      hasAccess: true,
      role: "admin",
    })
  })

  it("returns collaborator from membership", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: "someone-else" }])
    state.mock
      .onSelect(schema.projectMembershipTable)
      .respond([{ role: "collaborator" }])

    await expect(
      verifyProjectAccess(PROJECT_ID, USER_ID)
    ).resolves.toEqual({
      hasAccess: true,
      role: "collaborator",
    })
  })

  it("returns no access for a stranger", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: "someone-else" }])
    state.mock.onSelect(schema.projectMembershipTable).respond([])

    await expect(
      verifyProjectAccess(PROJECT_ID, USER_ID)
    ).resolves.toEqual({ hasAccess: false, role: null })
  })

  it("grants no implicit super user access", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: "someone-else" }])
    state.mock.onSelect(schema.projectMembershipTable).respond([])

    await expect(
      verifyProjectAccess(PROJECT_ID, "super-user")
    ).resolves.toEqual({ hasAccess: false, role: null })
  })

  it("returns no access when the project does not exist", async () => {
    state.mock.onSelect(schema.projectsTable).respond([])

    await expect(
      verifyProjectAccess(PROJECT_ID, USER_ID)
    ).resolves.toEqual({ hasAccess: false, role: null })
  })
})
