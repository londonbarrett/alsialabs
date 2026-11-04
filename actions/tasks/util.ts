import { returnActionError } from "@/lib/safe-action"
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
