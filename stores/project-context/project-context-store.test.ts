import { describe, expect, it } from "vitest"

import type { ProjectContextDTO } from "@/actions/schemas/project"
import type { ProjectMemberRowDTO } from "@/actions/schemas/project-membership"
import {
  projectContextReducer,
  type ProjectContextAction,
} from "./project-context-reducer"

function member(
  overrides: Partial<ProjectMemberRowDTO> = {}
): ProjectMemberRowDTO {
  return {
    userId: "user-2",
    userName: "Ada",
    userEmail: "ada@test.local",
    userImage: null,
    role: "collaborator",
    isPrimaryOwner: false,
    ...overrides,
  }
}

function context(
  overrides: Partial<ProjectContextDTO> = {}
): ProjectContextDTO {
  return {
    project: { id: "project-1", primaryOwnerId: "owner-1" },
    members: [
      member({
        userId: "owner-1",
        userName: "Owner",
        role: "owner",
        isPrimaryOwner: true,
      }),
      member({ userId: "user-2", role: "admin" }),
      member({ userId: "user-3" }),
    ],
    permissions: [],
    session: {
      user: { id: "owner-1", role: "user" },
      expires: new Date("2030-01-01"),
    },
    currentRole: "owner",
    currentUserId: "owner-1",
    categories: [],
    ...overrides,
  } as unknown as ProjectContextDTO
}

function reduce(
  action: ProjectContextAction,
  state = context()
): ProjectContextDTO {
  return projectContextReducer(state, action)
}

describe("project context reducer", () => {
  it("patches the project", () => {
    const result = reduce({
      type: "patchProject",
      patch: { name: "Renamed" },
    })
    expect((result.project as { name?: string }).name).toBe("Renamed")
  })

  it("adds a member", () => {
    const result = reduce({
      type: "addMember",
      member: member({ userId: "user-4" }),
    })
    expect(result.members.map((m) => m.userId)).toContain("user-4")
  })

  it("ignores a duplicate member", () => {
    const result = reduce({
      type: "addMember",
      member: member({ userId: "user-2" }),
    })
    expect(result.members).toHaveLength(3)
  })

  it("refuses to add an owner row", () => {
    const result = reduce({
      type: "addMember",
      member: member({ userId: "user-9", role: "owner" }),
    })
    expect(result.members).toHaveLength(3)
  })

  it("removes a member", () => {
    const result = reduce({ type: "removeMember", userId: "user-3" })
    expect(result.members.map((m) => m.userId)).not.toContain("user-3")
  })

  it("refuses to remove the primary owner", () => {
    const result = reduce({ type: "removeMember", userId: "owner-1" })
    expect(result.members.map((m) => m.userId)).toContain("owner-1")
  })

  it("changes a member role", () => {
    const result = reduce({
      type: "setMemberRole",
      userId: "user-2",
      role: "collaborator",
    })
    expect(
      result.members.find((m) => m.userId === "user-2")?.role
    ).toBe("collaborator")
  })

  it("refuses to change the primary owner role", () => {
    const result = reduce({
      type: "setMemberRole",
      userId: "owner-1",
      role: "admin",
    })
    expect(
      result.members.find((m) => m.userId === "owner-1")?.role
    ).toBe("owner")
  })
})
