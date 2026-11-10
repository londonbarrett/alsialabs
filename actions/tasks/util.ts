import { returnActionError } from "@/actions/safe-action"
import type { ProjectRole } from "@/lib/types"
import { canViewProject } from "@/lib/util/project-roles"
import queries from "./queries"

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  )
}

export async function assertAssignees(
  projectId: string,
  userIds: string[]
): Promise<void> {
  if (userIds.length === 0) return

  const [primaryOwnerId, memberIds] = await Promise.all([
    queries.getProjectPrimaryOwnerId(projectId),
    queries.getProjectMemberIds(projectId),
  ])

  if (primaryOwnerId === null) returnActionError("NOT_FOUND")

  const allowed = new Set([primaryOwnerId, ...memberIds])
  if (userIds.some((id) => !allowed.has(id))) {
    returnActionError("FORBIDDEN")
  }
}

/** A comment is only reachable through the project that owns its task. */
export async function assertTaskInProject(
  taskId: string,
  projectId: string
): Promise<void> {
  const task = await queries.getTaskRowInProject(taskId, projectId)

  if (!task) returnActionError("NOT_FOUND")
}

/**
 * Project work is visible to owners and admins; a collaborator only sees a
 * task's comments while they hold an open assignment on it.
 */
export async function assertCommentAccess(
  taskId: string,
  projectId: string,
  userId: string,
  role: ProjectRole | null
): Promise<void> {
  await assertTaskInProject(taskId, projectId)
  if (canViewProject(role)) return

  const openAssignment = await queries.getOpenAssignmentId(
    taskId,
    userId
  )

  if (!openAssignment) returnActionError("FORBIDDEN")
}
