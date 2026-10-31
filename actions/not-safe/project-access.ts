"use server"

import { db } from "@/lib/drizzle/client"
import {
  projectMembershipTable,
  projectsTable,
} from "@/lib/drizzle/schema"
import type { ProjectAccess } from "@/lib/project-roles"
import { and, eq } from "drizzle-orm"

/**
 * Resolves the caller's role on a project. The owner is stored on the project
 * itself and never in the membership table; super users get no override.
 */
export async function verifyProjectAccess(
  projectId: string,
  sessionUserId: string
): Promise<ProjectAccess> {
  const project = await db
    .select({ primaryOwnerId: projectsTable.primaryOwnerId })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .then((rows) => rows[0])

  if (!project) {
    return { hasAccess: false, role: null, isOwner: false }
  }

  if (project.primaryOwnerId === sessionUserId) {
    return { hasAccess: true, role: "owner", isOwner: true }
  }

  const membership = await db
    .select({ role: projectMembershipTable.role })
    .from(projectMembershipTable)
    .where(
      and(
        eq(projectMembershipTable.projectId, projectId),
        eq(projectMembershipTable.userId, sessionUserId)
      )
    )
    .then((rows) => rows[0])

  if (!membership) {
    return { hasAccess: false, role: null, isOwner: false }
  }

  return { hasAccess: true, role: membership.role, isOwner: false }
}
