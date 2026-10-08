"use server"

import { verifyProjectAccess } from "@/actions/project-access"
import { db } from "@/lib/drizzle/client"
import {
  taskCommentsTable,
  tasksTable,
  usersTable,
} from "@/lib/drizzle/schema"
import { returnActionError, sessionAction } from "@/lib/safe-action"
import {
  createTaskCommentSchema,
  deleteTaskCommentSchema,
  updateTaskCommentSchema,
} from "@/lib/schemas/task-comment"
import { asc, eq } from "drizzle-orm"
import { z } from "zod"

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

export const getTaskComments = sessionAction
  .metadata({ permission: { module: "projects", action: "view" } })
  .inputSchema(z.object({ taskId: z.uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    const { taskId } = parsedInput
    const session = ctx.session

    const task = await getTaskContext(taskId)
    if (!task) returnActionError("NOT_FOUND")

    const access = await verifyProjectAccess(
      task!.projectId,
      session.user.id,
      session.user.role ?? null
    )
    const isAssignee = task!.assigneeId === session.user.id
    if (!access.hasAccess && !isAssignee) returnActionError("NOT_FOUND")

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
  })

export const createComment = sessionAction
  .inputSchema(createTaskCommentSchema)
  .metadata({
    permission: { module: "projects", action: "view" },
  })
  .action(async ({ parsedInput, ctx }) => {
    const { taskId, content } = parsedInput
    const session = ctx.session

    const task = await getTaskContext(taskId)
    if (!task) returnActionError("NOT_FOUND")

    const access = await verifyProjectAccess(
      task!.projectId,
      session.user.id,
      session.user.role ?? null
    )
    const isAssignee = task!.assigneeId === session.user.id
    if (!access.hasAccess && !isAssignee) returnActionError("NOT_FOUND")

    const [inserted] = await db
      .insert(taskCommentsTable)
      .values({
        taskId,
        authorId: session.user.id,
        content,
      })
      .returning()

    const user = await db
      .select({ name: usersTable.name, image: usersTable.image })
      .from(usersTable)
      .where(eq(usersTable.id, session.user.id))
      .then((rows) => rows[0])

    return {
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
    }
  })

export const updateComment = sessionAction
  .inputSchema(updateTaskCommentSchema)
  .metadata({
    permission: { module: "projects", action: "view" },
  })
  .action(async ({ parsedInput, ctx }) => {
    const { commentId, taskId, content } = parsedInput
    const session = ctx.session

    const task = await getTaskContext(taskId)
    if (!task) returnActionError("NOT_FOUND")

    const access = await verifyProjectAccess(
      task!.projectId,
      session.user.id,
      session.user.role ?? null
    )
    const isAssignee = task!.assigneeId === session.user.id
    if (!access.hasAccess && !isAssignee) returnActionError("NOT_FOUND")

    const comment = await db
      .select({ authorId: taskCommentsTable.authorId })
      .from(taskCommentsTable)
      .where(eq(taskCommentsTable.id, commentId))
      .then((rows) => rows[0])

    if (!comment) returnActionError("NOT_FOUND")

    if (comment.authorId !== session.user.id)
      returnActionError("FORBIDDEN")

    await db
      .update(taskCommentsTable)
      .set({ content })
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
      comment: updated,
    }
  })

export const deleteComment = sessionAction
  .inputSchema(deleteTaskCommentSchema)
  .metadata({
    permission: { module: "projects", action: "view" },
  })
  .action(async ({ parsedInput, ctx }) => {
    const { commentId, taskId } = parsedInput
    const session = ctx.session

    const task = await getTaskContext(taskId)
    if (!task) returnActionError("NOT_FOUND")

    const access = await verifyProjectAccess(
      task!.projectId,
      session.user.id,
      session.user.role ?? null
    )
    const isAssignee = task!.assigneeId === session.user.id
    if (!access.hasAccess && !isAssignee) returnActionError("NOT_FOUND")

    const comment = await db
      .select({ authorId: taskCommentsTable.authorId })
      .from(taskCommentsTable)
      .where(eq(taskCommentsTable.id, commentId))
      .then((rows) => rows[0])

    if (!comment) returnActionError("NOT_FOUND")

    const canDelete =
      comment.authorId === session.user.id || access.isOwner
    if (!canDelete) returnActionError("FORBIDDEN")

    await db
      .delete(taskCommentsTable)
      .where(eq(taskCommentsTable.id, commentId))

    return {
      commentId,
    }
  })
