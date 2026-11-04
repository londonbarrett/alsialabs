import type { ProjectRole } from "@/lib/types"
import type { TaskStatus } from "@/lib/drizzle/schema"

/** The project list and the project route are owner/admin surfaces. */
export function canViewProject(role: ProjectRole | null): boolean {
  return role === "owner" || role === "admin"
}

/** Project details and deletion stay with the unique owner. */
export function canManageProject(role: ProjectRole | null): boolean {
  return role === "owner"
}

/** Tasks and expenses. */
export function canManageWork(role: ProjectRole | null): boolean {
  return role === "owner" || role === "admin"
}

/** Only the owner may add, remove, or demote admins. */
export function canManageAdmins(role: ProjectRole | null): boolean {
  return role === "owner"
}

/** Owners and admins may manage collaborators. */
export function canManageCollaborators(
  role: ProjectRole | null
): boolean {
  return role === "owner" || role === "admin"
}

/** Owners and admins may set any assignment's status and note. */
export function canChangeAnyAssignment(
  role: ProjectRole | null
): boolean {
  return role === "owner" || role === "admin"
}

export function isTerminalStatus(status: TaskStatus): boolean {
  return status === "done" || status === "cancelled"
}
