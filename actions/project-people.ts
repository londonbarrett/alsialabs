"use server"

import { db } from "@/lib/drizzle/client"
import {
  projectCollaboratorsTable,
  projectOwnersTable,
  projectsTable,
  usersTable,
} from "@/lib/drizzle/schema"
import {
  projectScopedAction,
  returnActionError,
  sessionAction,
} from "@/lib/safe-action"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

const memberInputSchema = z.object({
  projectId: z.uuid(),
  userId: z.string().min(1),
})

// ---------- Helpers ----------

/** Membership changes are reserved for the people recorded on the project, so
 * this check is stricter than `ctx.isProjectOwner` — that flag also covers
 * super users. */
async function isOwnerMember(
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

async function isCollaboratorMember(
  projectId: string,
  userId: string
): Promise<boolean> {
  const collaborator = await db
    .select({ projectId: projectCollaboratorsTable.projectId })
    .from(projectCollaboratorsTable)
    .where(
      and(
        eq(projectCollaboratorsTable.projectId, projectId),
        eq(projectCollaboratorsTable.userId, userId)
      )
    )
    .then((rows) => rows[0])
  return !!collaborator
}

/** Loads the project and asserts the caller holds the primary ownership, which
 * the owners table alone cannot express — it lists every owner, not the one the
 * project points at. */
async function requirePrimaryOwner(
  projectId: string,
  userId: string
): Promise<string> {
  const project = await db
    .select({ primaryOwnerId: projectsTable.primaryOwnerId })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .then((rows) => rows[0])

  if (!project) returnActionError("NOT_FOUND")
  if (project.primaryOwnerId !== userId) returnActionError("FORBIDDEN")

  return project.primaryOwnerId
}

async function requireOwnerMember(
  projectId: string,
  userId: string
): Promise<void> {
  if (!(await isOwnerMember(projectId, userId))) {
    returnActionError("FORBIDDEN")
  }
}

// ---------- Queries ----------

export const getProjectOwners = sessionAction
  .metadata({ permission: { module: "projects", action: "view" } })
  .inputSchema(z.object({ projectId: z.uuid() }))
  .action(async ({ parsedInput }) => {
    const { projectId } = parsedInput

    return db
      .select({
        userId: projectOwnersTable.userId,
        userName: usersTable.name,
        userEmail: usersTable.email,
        userImage: usersTable.image,
        primaryOwnerId: projectsTable.primaryOwnerId,
      })
      .from(projectOwnersTable)
      .innerJoin(
        usersTable,
        eq(projectOwnersTable.userId, usersTable.id)
      )
      .innerJoin(
        projectsTable,
        eq(projectOwnersTable.projectId, projectsTable.id)
      )
      .where(eq(projectOwnersTable.projectId, projectId))
  })

export const getProjectCollaborators = sessionAction
  .metadata({ permission: { module: "projects", action: "view" } })
  .inputSchema(z.object({ projectId: z.uuid() }))
  .action(async ({ parsedInput }) => {
    const { projectId } = parsedInput

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
  })

// ---------- Mutations ----------

export const addProjectOwner = projectScopedAction(memberInputSchema)
  .metadata({ revalidate: ["/app/proyectos/:projectId"] })
  .action(async ({ parsedInput, ctx }) => {
    const { projectId, userId } = parsedInput

    await requirePrimaryOwner(projectId, ctx.session.user.id)

    if (await isOwnerMember(projectId, userId)) {
      returnActionError("ALREADY_OWNER")
    }
    if (await isCollaboratorMember(projectId, userId)) {
      returnActionError("ALREADY_COLLABORATOR")
    }

    const [owner] = await db
      .insert(projectOwnersTable)
      .values({ projectId, userId })
      .returning()
    return owner
  })

export const removeProjectOwner = projectScopedAction(memberInputSchema)
  .metadata({ revalidate: ["/app/proyectos/:projectId"] })
  .action(async ({ parsedInput, ctx }) => {
    const { projectId, userId } = parsedInput

    const primaryOwnerId = await requirePrimaryOwner(
      projectId,
      ctx.session.user.id
    )

    if (primaryOwnerId === userId) {
      returnActionError("CANNOT_REMOVE_PRIMARY_OWNER")
    }

    await db
      .delete(projectOwnersTable)
      .where(
        and(
          eq(projectOwnersTable.projectId, projectId),
          eq(projectOwnersTable.userId, userId)
        )
      )

    return { projectId, userId }
  })

export const transferPrimaryOwner = projectScopedAction(
  z.object({
    projectId: z.uuid(),
    newOwnerId: z.string().min(1),
  })
)
  .metadata({ revalidate: ["/app/proyectos/:projectId"] })
  .action(async ({ parsedInput, ctx }) => {
    const { projectId, newOwnerId } = parsedInput

    await requirePrimaryOwner(projectId, ctx.session.user.id)

    if (!(await isOwnerMember(projectId, newOwnerId))) {
      returnActionError("MUST_BE_OWNER")
    }

    const [updated] = await db
      .update(projectsTable)
      .set({ primaryOwnerId: newOwnerId })
      .where(eq(projectsTable.id, projectId))
      .returning({ primaryOwnerId: projectsTable.primaryOwnerId })

    if (!updated) returnActionError("NOT_FOUND")

    return updated
  })

export const addProjectCollaborator = projectScopedAction(
  memberInputSchema
)
  .metadata({ revalidate: ["/app/proyectos/:projectId"] })
  .action(async ({ parsedInput, ctx }) => {
    const { projectId, userId } = parsedInput

    await requireOwnerMember(projectId, ctx.session.user.id)

    if (await isCollaboratorMember(projectId, userId)) {
      returnActionError("ALREADY_COLLABORATOR")
    }
    if (await isOwnerMember(projectId, userId)) {
      returnActionError("ALREADY_OWNER")
    }

    const [collaborator] = await db
      .insert(projectCollaboratorsTable)
      .values({ projectId, userId })
      .returning()
    return collaborator
  })

export const removeProjectCollaborator = projectScopedAction(
  memberInputSchema
)
  .metadata({ revalidate: ["/app/proyectos/:projectId"] })
  .action(async ({ parsedInput, ctx }) => {
    const { projectId, userId } = parsedInput

    await requireOwnerMember(projectId, ctx.session.user.id)

    await db
      .delete(projectCollaboratorsTable)
      .where(
        and(
          eq(projectCollaboratorsTable.projectId, projectId),
          eq(projectCollaboratorsTable.userId, userId)
        )
      )

    return { projectId, userId }
  })
