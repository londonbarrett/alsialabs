"use server"

import { isSuperUser } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import {
  projectCollaboratorsTable,
  projectOwnersTable,
} from "@/lib/drizzle/schema"
import { and, eq } from "drizzle-orm"

export async function verifyProjectAccess(
  projectId: string,
  sessionUserId: string,
  sessionRole: string | null
): Promise<{ hasAccess: boolean; isOwner: boolean }> {
  const session = { user: { role: sessionRole } }
  if (isSuperUser(session)) return { hasAccess: true, isOwner: true }

  const owner = await db
    .select()
    .from(projectOwnersTable)
    .where(
      and(
        eq(projectOwnersTable.projectId, projectId),
        eq(projectOwnersTable.userId, sessionUserId)
      )
    )
    .then((rows) => rows[0])

  if (owner) return { hasAccess: true, isOwner: true }

  const collaborator = await db
    .select()
    .from(projectCollaboratorsTable)
    .where(
      and(
        eq(projectCollaboratorsTable.projectId, projectId),
        eq(projectCollaboratorsTable.userId, sessionUserId)
      )
    )
    .then((rows) => rows[0])

  if (collaborator) return { hasAccess: true, isOwner: false }

  return { hasAccess: false, isOwner: false }
}
