"use server"

import {
  MemberInputSchema,
  ProjectMemberRowSchema,
  ProjectMembershipSchema,
  ProjectPrimaryOwnerSchema,
  SetMemberRoleSchema,
  TransferPrimaryOwnerSchema,
} from "@/actions/schemas/project-membership"
import { db } from "@/lib/drizzle/client"
import {
  projectMembershipTable,
  projectsTable,
  usersTable,
} from "@/lib/drizzle/schema"
import {
  canManageAdmins,
  canManageCollaborators,
  canManageProject,
  canViewProject,
} from "@/lib/project-roles"
import { throwActionError } from "@/lib/action-result"
import { projectAction, returnActionError } from "@/lib/safe-action"
import { and, eq } from "drizzle-orm"

const MEMBER_METADATA = {
  revalidate: ["/app/proyectos/:projectId"],
}

async function getProjectPrimaryOwnerId(
  projectId: string
): Promise<string | null> {
  const project = await db
    .select({ primaryOwnerId: projectsTable.primaryOwnerId })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .then((rows) => rows[0])

  return project?.primaryOwnerId ?? null
}

async function getMembership(
  projectId: string,
  userId: string
): Promise<{ role: "admin" | "collaborator" } | null> {
  return db
    .select({ role: projectMembershipTable.role })
    .from(projectMembershipTable)
    .where(
      and(
        eq(projectMembershipTable.projectId, projectId),
        eq(projectMembershipTable.userId, userId)
      )
    )
    .then((rows) => rows[0] ?? null)
}

export const getProjectMembers = projectAction(
  MemberInputSchema.pick({ projectId: true })
)
  .metadata({})
  .outputSchema(ProjectMemberRowSchema.array())
  .action(async ({ parsedInput, ctx }) => {
    if (!canViewProject(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { projectId } = parsedInput
    const primaryOwnerId = await getProjectPrimaryOwnerId(projectId)
    if (primaryOwnerId === null) throwActionError("NOT_FOUND")

    const owner = await db
      .select({
        userId: usersTable.id,
        userName: usersTable.name,
        userEmail: usersTable.email,
        userImage: usersTable.image,
      })
      .from(usersTable)
      .where(eq(usersTable.id, primaryOwnerId))
      .then((rows) => rows[0])

    const members = await db
      .select({
        userId: projectMembershipTable.userId,
        userName: usersTable.name,
        userEmail: usersTable.email,
        userImage: usersTable.image,
        role: projectMembershipTable.role,
      })
      .from(projectMembershipTable)
      .innerJoin(
        usersTable,
        eq(projectMembershipTable.userId, usersTable.id)
      )
      .where(eq(projectMembershipTable.projectId, projectId))

    const ordered = [...members].sort((a, b) => {
      if (a.role !== b.role) return a.role === "admin" ? -1 : 1
      const aName = a.userName ?? a.userEmail ?? a.userId
      const bName = b.userName ?? b.userEmail ?? b.userId
      return aName.localeCompare(bName)
    })

    return [
      ...(owner
        ? [
            {
              ...owner,
              role: "owner" as const,
              isPrimaryOwner: true,
            },
          ]
        : []),
      ...ordered.map((member) => ({
        ...member,
        isPrimaryOwner: false,
      })),
    ]
  })

export const addProjectAdmin = projectAction(MemberInputSchema)
  .metadata(MEMBER_METADATA)
  .outputSchema(ProjectMembershipSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageAdmins(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { projectId, userId } = parsedInput
    const primaryOwnerId = await getProjectPrimaryOwnerId(projectId)
    if (primaryOwnerId === null) throwActionError("NOT_FOUND")
    if (userId === primaryOwnerId) returnActionError("ALREADY_OWNER")

    const existing = await getMembership(projectId, userId)
    if (existing) {
      if (existing.role === "admin") returnActionError("ALREADY_OWNER")
      returnActionError("ALREADY_COLLABORATOR")
    }

    const [row] = await db
      .insert(projectMembershipTable)
      .values({ projectId, userId, role: "admin" })
      .returning()

    if (!row) returnActionError("NOT_FOUND")

    return { projectId, userId, role: row.role }
  })

export const removeProjectAdmin = projectAction(MemberInputSchema)
  .metadata(MEMBER_METADATA)
  .outputSchema(ProjectMembershipSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageAdmins(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { projectId, userId } = parsedInput
    const [removed] = await db
      .delete(projectMembershipTable)
      .where(
        and(
          eq(projectMembershipTable.projectId, projectId),
          eq(projectMembershipTable.userId, userId),
          eq(projectMembershipTable.role, "admin")
        )
      )
      .returning()

    if (!removed) returnActionError("NOT_FOUND")

    return { projectId, userId, role: "admin" as const }
  })

export const addProjectCollaborator = projectAction(MemberInputSchema)
  .metadata(MEMBER_METADATA)
  .outputSchema(ProjectMembershipSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageCollaborators(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { projectId, userId } = parsedInput
    const primaryOwnerId = await getProjectPrimaryOwnerId(projectId)
    if (primaryOwnerId === null) throwActionError("NOT_FOUND")
    if (userId === primaryOwnerId) returnActionError("ALREADY_OWNER")

    if (await getMembership(projectId, userId)) {
      returnActionError("ALREADY_COLLABORATOR")
    }

    const [row] = await db
      .insert(projectMembershipTable)
      .values({ projectId, userId, role: "collaborator" })
      .returning()

    if (!row) returnActionError("NOT_FOUND")

    return { projectId, userId, role: row.role }
  })

export const removeProjectCollaborator = projectAction(
  MemberInputSchema
)
  .metadata(MEMBER_METADATA)
  .outputSchema(ProjectMembershipSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageCollaborators(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { projectId, userId } = parsedInput
    const [removed] = await db
      .delete(projectMembershipTable)
      .where(
        and(
          eq(projectMembershipTable.projectId, projectId),
          eq(projectMembershipTable.userId, userId),
          eq(projectMembershipTable.role, "collaborator")
        )
      )
      .returning()

    if (!removed) returnActionError("NOT_FOUND")

    return { projectId, userId, role: "collaborator" as const }
  })

export const setProjectMemberRole = projectAction(SetMemberRoleSchema)
  .metadata(MEMBER_METADATA)
  .outputSchema(ProjectMembershipSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageAdmins(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { projectId, userId, role } = parsedInput
    const primaryOwnerId = await getProjectPrimaryOwnerId(projectId)
    if (primaryOwnerId === null) throwActionError("NOT_FOUND")
    if (userId === primaryOwnerId) returnActionError("ALREADY_OWNER")

    const [row] = await db
      .update(projectMembershipTable)
      .set({ role })
      .where(
        and(
          eq(projectMembershipTable.projectId, projectId),
          eq(projectMembershipTable.userId, userId)
        )
      )
      .returning()

    if (!row) returnActionError("NOT_FOUND")

    return { projectId, userId, role: row.role }
  })

export const transferPrimaryOwner = projectAction(
  TransferPrimaryOwnerSchema
)
  .metadata(MEMBER_METADATA)
  .outputSchema(ProjectPrimaryOwnerSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageProject(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { projectId, newOwnerId } = parsedInput
    const primaryOwnerId = await getProjectPrimaryOwnerId(projectId)
    if (primaryOwnerId === null) throwActionError("NOT_FOUND")
    if (newOwnerId === primaryOwnerId) {
      returnActionError("MUST_BE_OWNER")
    }

    if (!(await getMembership(projectId, newOwnerId))) {
      returnActionError("MUST_BE_OWNER")
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(projectMembershipTable)
        .where(
          and(
            eq(projectMembershipTable.projectId, projectId),
            eq(projectMembershipTable.userId, newOwnerId)
          )
        )
      await tx.insert(projectMembershipTable).values({
        projectId,
        userId: primaryOwnerId,
        role: "admin",
      })
      await tx
        .update(projectsTable)
        .set({ primaryOwnerId: newOwnerId })
        .where(eq(projectsTable.id, projectId))
    })

    return { primaryOwnerId: newOwnerId }
  })
