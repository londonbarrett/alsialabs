import { describe, expect, it } from "vitest"

import {
  canChangeAnyAssignment,
  canManageAdmins,
  canManageCollaborators,
  canManageProject,
  canManageWork,
  canViewProject,
  isTerminalStatus,
} from "./project-roles"

describe("project role capabilities", () => {
  it("maps roles to capabilities", () => {
    expect([
      canViewProject("owner"),
      canViewProject("admin"),
      canViewProject("collaborator"),
      canViewProject(null),
    ]).toEqual([true, true, false, false])
    expect([
      canManageProject("owner"),
      canManageProject("admin"),
    ]).toEqual([true, false])
    expect([
      canManageWork("owner"),
      canManageWork("admin"),
      canManageWork("collaborator"),
    ]).toEqual([true, true, false])
    expect([
      canManageAdmins("owner"),
      canManageAdmins("admin"),
    ]).toEqual([true, false])
    expect([
      canManageCollaborators("owner"),
      canManageCollaborators("admin"),
      canManageCollaborators("collaborator"),
    ]).toEqual([true, true, false])
    expect([
      canChangeAnyAssignment("owner"),
      canChangeAnyAssignment("collaborator"),
    ]).toEqual([true, false])
  })

  it("treats done and cancelled as terminal", () => {
    expect(isTerminalStatus("done")).toBe(true)
    expect(isTerminalStatus("cancelled")).toBe(true)
    expect(isTerminalStatus("blocked")).toBe(false)
  })
})
