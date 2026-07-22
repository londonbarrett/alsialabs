"use server"

import { auth, isSuperUser, requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import {
  projectCollaboratorsTable,
  projectOwnersTable,
  projectTasksTable,
  taskCommentsTable,
  usersTable,
} from "@/lib/drizzle/schema"
import { getActionT } from "@/lib/i18n-actions"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"

const commentSchema = z.object({
  taskId: z.string().min(1),
  content: z
    .string()
    .min(1, "Comment is required")
    .transform((v) => v.trim()),
})

async function verifyProjectAccess(
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

async function getProjectIdForTask(
  taskId: string
): Promise<string | null> {
  const task = await db
    .select({ projectId: projectTasksTable.projectId })
    .from(projectTasksTable)
    .where(eq(projectTasksTable.id, taskId))
    .then((rows) => rows[0])
  return task?.projectId ?? null
}

export async function getTaskComments(taskId: string) {
  const t = await getActionT("actions.projects")

  try {
    await requirePermission("projects", "view")
  } catch {
    throw new Error(t("forbidden"))
  }

  const session = await auth()
  if (!session?.user) throw new Error(t("unauthorized"))

  const projectId = await getProjectIdForTask(taskId)
  if (!projectId) throw new Error(t("notFound"))

  const access = await verifyProjectAccess(
    projectId,
    session.user.id,
    session.user.role ?? null
  )
  if (!access.hasAccess) throw new Error(t("notFound"))

  return db
    .select({
      id: taskCommentsTable.id,
      taskId: taskCommentsTable.taskId,
      authorId: taskCommentsTable.authorId,
      authorName: usersTable.name,
      authorImage: usersTable.image,
      content: taskCommentsTable.content,
      createdAt: taskCommentsTable.createdAt,
      updatedAt: taskCommentsTable.updatedAt,
    })
    .from(taskCommentsTable)
    .innerJoin(
      usersTable,
      eq(taskCommentsTable.authorId, usersTable.id)
    )
    .where(eq(taskCommentsTable.taskId, taskId))
    .orderBy(asc(taskCommentsTable.createdAt))
}

export async function createComment(taskId: string, content: string) {
  const t = await getActionT("actions.projects")

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  const projectId = await getProjectIdForTask(taskId)
  if (!projectId)
    return { success: false as const, error: t("notFound") }

  const access = await verifyProjectAccess(
    projectId,
    session.user.id,
    session.user.role ?? null
  )
  if (!access.hasAccess)
    return { success: false as const, error: t("notFound") }

  const parsed = commentSchema.safeParse({ taskId, content })
  if (!parsed.success) {
    return {
      success: false as const,
      error: t("validationFailed"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const [inserted] = await db
    .insert(taskCommentsTable)
    .values({
      taskId,
      authorId: session.user.id,
      content: parsed.data.content,
    })
    .returning()

  const user = await db
    .select({ name: usersTable.name, image: usersTable.image })
    .from(usersTable)
    .where(eq(usersTable.id, session.user.id))
    .then((rows) => rows[0])

  return {
    success: true as const,
    data: {
      comment: {
        id: inserted.id,
        taskId: inserted.taskId,
        authorId: inserted.authorId,
        authorName: user?.name ?? null,
        authorImage: user?.image ?? null,
        content: inserted.content,
        createdAt: inserted.createdAt,
        updatedAt: inserted.updatedAt,
      },
    },
  }
}

export async function updateComment(
  commentId: string,
  taskId: string,
  content: string
) {
  const t = await getActionT("actions.projects")

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  const projectId = await getProjectIdForTask(taskId)
  if (!projectId)
    return { success: false as const, error: t("notFound") }

  const access = await verifyProjectAccess(
    projectId,
    session.user.id,
    session.user.role ?? null
  )
  if (!access.hasAccess)
    return { success: false as const, error: t("notFound") }

  const parsed = commentSchema.safeParse({ taskId, content })
  if (!parsed.success) {
    return {
      success: false as const,
      error: t("validationFailed"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const comment = await db
    .select({ authorId: taskCommentsTable.authorId })
    .from(taskCommentsTable)
    .where(eq(taskCommentsTable.id, commentId))
    .then((rows) => rows[0])

  if (!comment) return { success: false as const, error: t("notFound") }

  if (comment.authorId !== session.user.id)
    return { success: false as const, error: t("forbidden") }

  await db
    .update(taskCommentsTable)
    .set({ content: parsed.data.content })
    .where(eq(taskCommentsTable.id, commentId))

  const [updated] = await db
    .select({
      id: taskCommentsTable.id,
      taskId: taskCommentsTable.taskId,
      authorId: taskCommentsTable.authorId,
      authorName: usersTable.name,
      authorImage: usersTable.image,
      content: taskCommentsTable.content,
      createdAt: taskCommentsTable.createdAt,
      updatedAt: taskCommentsTable.updatedAt,
    })
    .from(taskCommentsTable)
    .innerJoin(
      usersTable,
      eq(taskCommentsTable.authorId, usersTable.id)
    )
    .where(eq(taskCommentsTable.id, commentId))

  return {
    success: true as const,
    data: { comment: updated },
  }
}

export async function deleteComment(commentId: string, taskId: string) {
  const t = await getActionT("actions.projects")

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  const projectId = await getProjectIdForTask(taskId)
  if (!projectId)
    return { success: false as const, error: t("notFound") }

  const access = await verifyProjectAccess(
    projectId,
    session.user.id,
    session.user.role ?? null
  )
  if (!access.hasAccess)
    return { success: false as const, error: t("notFound") }

  const comment = await db
    .select({ authorId: taskCommentsTable.authorId })
    .from(taskCommentsTable)
    .where(eq(taskCommentsTable.id, commentId))
    .then((rows) => rows[0])

  if (!comment) return { success: false as const, error: t("notFound") }

  const canDelete =
    comment.authorId === session.user.id || access.isOwner
  if (!canDelete)
    return { success: false as const, error: t("forbidden") }

  await db
    .delete(taskCommentsTable)
    .where(eq(taskCommentsTable.id, commentId))

  return {
    success: true as const,
    data: {
      commentId,
    },
  }
}
