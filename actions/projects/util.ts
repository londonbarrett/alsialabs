import type { ProjectAccess } from "@/lib/types"
import queries from "./queries"

/**
 * Resolves the caller's role on a project. The owner is stored on the project
 * itself and never in the membership table; super users get no override.
 */
export async function resolveProjectAccess(
  projectId: string,
  userId: string
): Promise<ProjectAccess> {
  const primaryOwnerId =
    await queries.getProjectPrimaryOwnerId(projectId)

  if (primaryOwnerId === null) {
    return { hasAccess: false, role: null }
  }

  if (primaryOwnerId === userId) {
    return { hasAccess: true, role: "owner" }
  }

  const role = await queries.getProjectMembershipRole(projectId, userId)

  if (!role) {
    return { hasAccess: false, role: null }
  }

  return { hasAccess: true, role }
}
