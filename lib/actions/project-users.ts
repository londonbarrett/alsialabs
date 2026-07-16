"use server"

import { auth, requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import {
  projectCollaboratorsTable,
  projectOwnersTable,
  projectsTable,
  usersTable,
} from "@/lib/drizzle/schema"
import { getActionT } from "@/lib/i18n-actions"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

async function isPrimaryOwner(
  projectId: string,
  userId: string
): Promise<boolean> {
  const project = await db
    .select({ primaryOwnerId: projectsTable.primaryOwnerId })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .then((rows) => rows[0])
  return project?.primaryOwnerId === userId
}

async function isProjectOwner(
  projectId: string,
  userId: string
): Promise<boolean> {
  const owner = await db
    .select({ projectId: projectOwnersTable.projectId })
    .from(projectOwnersTable)
    .where(
      and(
        eq(projectOwnersTable.projectId, projectId),
        eq(projectOwnersTable.userId, userId)
      )
    )
    .then((rows) => rows[0])
  return !!owner
}

export async function getProjectOwners(projectId: string) {
  const t = await getActionT("actions.projects")
  try {
    await requirePermission("projects", "view")
  } catch {
    throw new Error(t("forbidden"))
  }

  return db
    .select({
      userId: projectOwnersTable.userId,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userImage: usersTable.image,
      primaryOwnerId: projectsTable.primaryOwnerId,
    })
    .from(projectOwnersTable)
    .innerJoin(usersTable, eq(projectOwnersTable.userId, usersTable.id))
    .innerJoin(
      projectsTable,
      eq(projectOwnersTable.projectId, projectsTable.id)
    )
    .where(eq(projectOwnersTable.projectId, projectId))
}

export async function getProjectCollaborators(projectId: string) {
  const t = await getActionT("actions.projects")
  try {
    await requirePermission("projects", "view")
  } catch {
    throw new Error(t("forbidden"))
  }

  return db
    .select({
      userId: projectCollaboratorsTable.userId,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userImage: usersTable.image,
    })
    .from(projectCollaboratorsTable)
    .innerJoin(
      usersTable,
      eq(projectCollaboratorsTable.userId, usersTable.id)
    )
    .where(eq(projectCollaboratorsTable.projectId, projectId))
}

export async function addProjectOwner(
  projectId: string,
  userId: string
) {
  const t = await getActionT("actions.projects")

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  if (!(await isPrimaryOwner(projectId, session.user.id))) {
    return { success: false as const, error: t("forbidden") }
  }

  const existing = await db
    .select()
    .from(projectOwnersTable)
    .where(
      and(
        eq(projectOwnersTable.projectId, projectId),
        eq(projectOwnersTable.userId, userId)
      )
    )
    .then((rows) => rows[0])

  if (existing) {
    return { success: false as const, error: t("alreadyOwner") }
  }

  await db.insert(projectOwnersTable).values({ projectId, userId })

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true as const }
}

export async function removeProjectOwner(
  projectId: string,
  userId: string
) {
  const t = await getActionT("actions.projects")

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  if (!(await isPrimaryOwner(projectId, session.user.id))) {
    return { success: false as const, error: t("forbidden") }
  }

  const project = await db
    .select({ primaryOwnerId: projectsTable.primaryOwnerId })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .then((rows) => rows[0])

  if (project?.primaryOwnerId === userId) {
    return {
      success: false as const,
      error: t("cannotRemovePrimaryOwner"),
    }
  }

  await db
    .delete(projectOwnersTable)
    .where(
      and(
        eq(projectOwnersTable.projectId, projectId),
        eq(projectOwnersTable.userId, userId)
      )
    )

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true as const }
}

export async function transferPrimaryOwner(
  projectId: string,
  newOwnerId: string
) {
  const t = await getActionT("actions.projects")

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  if (!(await isPrimaryOwner(projectId, session.user.id))) {
    return { success: false as const, error: t("forbidden") }
  }

  if (!(await isProjectOwner(projectId, newOwnerId))) {
    return { success: false as const, error: t("mustBeOwner") }
  }

  await db
    .update(projectsTable)
    .set({ primaryOwnerId: newOwnerId })
    .where(eq(projectsTable.id, projectId))

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true as const }
}

export async function addProjectCollaborator(
  projectId: string,
  userId: string
) {
  const t = await getActionT("actions.projects")

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  if (!(await isProjectOwner(projectId, session.user.id))) {
    return { success: false as const, error: t("forbidden") }
  }

  const existing = await db
    .select()
    .from(projectCollaboratorsTable)
    .where(
      and(
        eq(projectCollaboratorsTable.projectId, projectId),
        eq(projectCollaboratorsTable.userId, userId)
      )
    )
    .then((rows) => rows[0])

  if (existing) {
    return { success: false as const, error: t("alreadyCollaborator") }
  }

  await db
    .insert(projectCollaboratorsTable)
    .values({ projectId, userId })

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true as const }
}

export async function removeProjectCollaborator(
  projectId: string,
  userId: string
) {
  const t = await getActionT("actions.projects")

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  if (!(await isProjectOwner(projectId, session.user.id))) {
    return { success: false as const, error: t("forbidden") }
  }

  await db
    .delete(projectCollaboratorsTable)
    .where(
      and(
        eq(projectCollaboratorsTable.projectId, projectId),
        eq(projectCollaboratorsTable.userId, userId)
      )
    )

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true as const }
}
