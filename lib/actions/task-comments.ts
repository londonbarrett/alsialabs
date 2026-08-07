"use server"

import { verifyProjectAccess } from "@/lib/actions/project-access"
import { auth, requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import {
  taskCommentsTable,
  tasksTable,
  usersTable,
} from "@/lib/drizzle/schema"
import { getActionT } from "@/lib/i18n-actions"
import { asc, eq } from "drizzle-orm"
import { z } from "zod"

const commentSchema = z.object({
  taskId: z.string().min(1),
  content: z
    .string()
    .min(1, "Comment is required")
    .transform((v) => v.trim()),
})

async function getTaskContext(
  taskId: string
): Promise<{ projectId: string; assigneeId: string | null } | null> {
  const task = await db
    .select({
      projectId: tasksTable.projectId,
      assigneeId: tasksTable.assigneeId,
    })
    .from(tasksTable)
    .where(eq(tasksTable.id, taskId))
    .then((rows) => rows[0])
  return task ?? null
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

  const task = await getTaskContext(taskId)
  if (!task) throw new Error(t("notFound"))

  const access = await verifyProjectAccess(
    task.projectId,
    session.user.id,
    session.user.role ?? null
  )
  const isAssignee = task.assigneeId === session.user.id
  if (!access.hasAccess && !isAssignee) throw new Error(t("notFound"))

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

  const task = await getTaskContext(taskId)
  if (!task) return { success: false as const, error: t("notFound") }

  const access = await verifyProjectAccess(
    task.projectId,
    session.user.id,
    session.user.role ?? null
  )
  const isAssignee = task.assigneeId === session.user.id
  if (!access.hasAccess && !isAssignee)
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

  const task = await getTaskContext(taskId)
  if (!task) return { success: false as const, error: t("notFound") }

  const access = await verifyProjectAccess(
    task.projectId,
    session.user.id,
    session.user.role ?? null
  )
  const isAssignee = task.assigneeId === session.user.id
  if (!access.hasAccess && !isAssignee)
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

  const task = await getTaskContext(taskId)
  if (!task) return { success: false as const, error: t("notFound") }

  const access = await verifyProjectAccess(
    task.projectId,
    session.user.id,
    session.user.role ?? null
  )
  const isAssignee = task.assigneeId === session.user.id
  if (!access.hasAccess && !isAssignee)
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
