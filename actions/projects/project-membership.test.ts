import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
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
import { auth } from "@/lib/auth"
import { resolveProjectAccess } from "@/actions/projects/util"
import type { ProjectRole } from "@/lib/types"
import {
  addProjectAdmin,
  addProjectCollaborator,
  getProjectMembers,
  removeProjectAdmin,
  removeProjectCollaborator,
  setProjectMemberRole,
  transferProjectPrimaryOwner,
} from "@/actions/projects"

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>
const mockResolveAccess = vi.mocked(resolveProjectAccess)

const PROJECT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const OWNER_ID = "owner-1"
const USER_ID = "user-1"

function grantRole(role: ProjectRole) {
  mockResolveAccess.mockResolvedValue({
    hasAccess: true,
    role,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  state.mock.resetMocks()
  mockAuth.mockResolvedValue({
    user: { id: USER_ID, role: "user", name: "Test" },
    expires: new Date().toISOString(),
  } as never)
  grantRole("owner")
})

describe("membership actions", () => {
  it("lets an admin add a collaborator", async () => {
    grantRole("admin")
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: OWNER_ID }])
    state.mock.onSelect(schema.projectMembershipTable).respond([])
    state.mock.onInsert(schema.projectMembershipTable).respond([
      {
        projectId: PROJECT_ID,
        userId: USER_ID,
        role: "collaborator",
      },
    ])

    const result = await addProjectCollaborator({
      projectId: PROJECT_ID,
      userId: USER_ID,
    })

    expect(result.serverError).toBeUndefined()
    expect(result.data).toEqual({
      projectId: PROJECT_ID,
      userId: USER_ID,
      role: "collaborator",
    })
  })

  it("forbids an admin from adding an admin", async () => {
    grantRole("admin")

    const result = await addProjectAdmin({
      projectId: PROJECT_ID,
      userId: USER_ID,
    })

    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })

  it("forbids an admin from removing an admin", async () => {
    grantRole("admin")

    const result = await removeProjectAdmin({
      projectId: PROJECT_ID,
      userId: USER_ID,
    })

    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })

  it("forbids an admin from changing a role", async () => {
    grantRole("admin")

    const result = await setProjectMemberRole({
      projectId: PROJECT_ID,
      userId: USER_ID,
      role: "collaborator",
    })

    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })

  it("lets the owner add an admin", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: OWNER_ID }])
    state.mock.onSelect(schema.projectMembershipTable).respond([])
    state.mock
      .onInsert(schema.projectMembershipTable)
      .respond([
        { projectId: PROJECT_ID, userId: USER_ID, role: "admin" },
      ])

    const result = await addProjectAdmin({
      projectId: PROJECT_ID,
      userId: USER_ID,
    })

    expect(result.serverError).toBeUndefined()
    expect(result.data?.role).toBe("admin")
  })

  it("rejects adding the primary owner", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: OWNER_ID }])

    const result = await addProjectAdmin({
      projectId: PROJECT_ID,
      userId: OWNER_ID,
    })

    expect(result.serverError).toEqual({ code: "ALREADY_OWNER" })
  })

  it("rejects a duplicate collaborator", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: OWNER_ID }])
    state.mock
      .onSelect(schema.projectMembershipTable)
      .respond([{ role: "collaborator" }])

    const result = await addProjectCollaborator({
      projectId: PROJECT_ID,
      userId: USER_ID,
    })

    expect(result.serverError).toEqual({ code: "ALREADY_COLLABORATOR" })
  })

  it("lets an admin remove a collaborator", async () => {
    grantRole("admin")
    state.mock
      .onDelete(schema.projectMembershipTable)
      .respond([{ projectId: PROJECT_ID, userId: USER_ID }])

    const result = await removeProjectCollaborator({
      projectId: PROJECT_ID,
      userId: USER_ID,
    })

    expect(result.serverError).toBeUndefined()
    expect(result.data).toEqual({
      projectId: PROJECT_ID,
      userId: USER_ID,
      role: "collaborator",
    })
  })

  it("returns the members with the owner first", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: OWNER_ID }])
    state.mock.onSelect(schema.usersTable).respond([
      {
        userId: OWNER_ID,
        userName: "Owner",
        userEmail: "owner@test.local",
        userImage: null,
      },
    ])
    state.mock.onSelect(schema.projectMembershipTable).respond([
      {
        userId: "user-2",
        userName: "Admin",
        userEmail: "admin@test.local",
        userImage: null,
        role: "admin",
      },
      {
        userId: "user-3",
        userName: "Collaborator",
        userEmail: "collab@test.local",
        userImage: null,
        role: "collaborator",
      },
    ])

    const result = await getProjectMembers({ projectId: PROJECT_ID })

    expect(result.data?.map((m) => m.role)).toEqual([
      "owner",
      "admin",
      "collaborator",
    ])
    expect(result.data?.[0]?.isPrimaryOwner).toBe(true)
  })

  it("transfers ownership and demotes the previous owner to admin", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: OWNER_ID }])
    state.mock
      .onSelect(schema.projectMembershipTable)
      .respond([{ role: "admin" }])
    state.mock.onDelete(schema.projectMembershipTable).respond([{}])
    state.mock.onInsert(schema.projectMembershipTable).respond([{}])
    state.mock
      .onUpdate(schema.projectsTable)
      .respond([{ primaryOwnerId: USER_ID }])

    const result = await transferProjectPrimaryOwner({
      projectId: PROJECT_ID,
      newOwnerId: "user-2",
    })

    expect(result.serverError).toBeUndefined()
    expect(result.data).toEqual({ primaryOwnerId: "user-2" })
  })

  it("rejects transferring ownership to a stranger", async () => {
    state.mock
      .onSelect(schema.projectsTable)
      .respond([{ primaryOwnerId: OWNER_ID }])
    state.mock.onSelect(schema.projectMembershipTable).respond([])

    const result = await transferProjectPrimaryOwner({
      projectId: PROJECT_ID,
      newOwnerId: "stranger",
    })

    expect(result.serverError).toEqual({ code: "MUST_BE_OWNER" })
  })
})
