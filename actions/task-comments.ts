"use server"

import {
  CreateTaskCommentSchema,
  DeleteTaskCommentResultSchema,
  DeleteTaskCommentSchema,
  TaskCommentResultSchema,
  TaskCommentWithAuthorSchema,
  UpdateTaskCommentSchema,
} from "@/actions/schemas/task-comment"
import { db } from "@/lib/drizzle/client"
import {
  taskAssignmentsTable,
  taskCommentsTable,
  tasksTable,
  usersTable,
} from "@/lib/drizzle/schema"
import {
  canManageWork,
  canViewProject,
  type ProjectRole,
} from "@/lib/project-roles"
import { projectAction, returnActionError } from "@/lib/safe-action"
import { and, asc, eq, notInArray } from "drizzle-orm"
import { z } from "zod"

/** A comment is only reachable through the project that owns its task. */
async function assertTaskInProject(
  taskId: string,
  projectId: string
): Promise<void> {
  const task = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.id, taskId),
        eq(tasksTable.projectId, projectId)
      )
    )
    .then((rows) => rows[0])

  if (!task) returnActionError("NOT_FOUND")
}

/**
 * Project work is visible to owners and admins; a collaborator only sees a
 * task's comments while they hold an open assignment on it.
 */
async function assertCommentAccess(
  taskId: string,
  projectId: string,
  userId: string,
  role: ProjectRole | null
): Promise<void> {
  await assertTaskInProject(taskId, projectId)
  if (canViewProject(role)) return

  const openAssignment = await db
    .select({ id: taskAssignmentsTable.id })
    .from(taskAssignmentsTable)
    .where(
      and(
        eq(taskAssignmentsTable.taskId, taskId),
        eq(taskAssignmentsTable.userId, userId),
        notInArray(taskAssignmentsTable.status, ["done", "cancelled"])
      )
    )
    .limit(1)
    .then((rows) => rows[0])

  if (!openAssignment) returnActionError("FORBIDDEN")
}

export const getTaskComments = projectAction(
  z.object({ projectId: z.uuid(), taskId: z.uuid() })
)
  .metadata({})
  .outputSchema(z.array(TaskCommentWithAuthorSchema))
  .action(async ({ parsedInput, ctx }) => {
    const { projectId, taskId } = parsedInput
    await assertCommentAccess(
      taskId,
      projectId,
      ctx.session.user.id,
      ctx.projectRole
    )

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

export const createComment = projectAction(CreateTaskCommentSchema)
  .metadata({})
  .outputSchema(TaskCommentResultSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { projectId, taskId, content } = parsedInput
    const session = ctx.session

    await assertCommentAccess(
      taskId,
      projectId,
      session.user.id,
      ctx.projectRole
    )

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

export const updateComment = projectAction(UpdateTaskCommentSchema)
  .metadata({})
  .outputSchema(TaskCommentResultSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { projectId, commentId, taskId, content } = parsedInput
    const session = ctx.session

    await assertCommentAccess(
      taskId,
      projectId,
      session.user.id,
      ctx.projectRole
    )

    const comment = await db
      .select({
        authorId: taskCommentsTable.authorId,
        taskId: taskCommentsTable.taskId,
      })
      .from(taskCommentsTable)
      .where(eq(taskCommentsTable.id, commentId))
      .then((rows) => rows[0])

    if (!comment || comment.taskId !== taskId) {
      returnActionError("NOT_FOUND")
    }

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

export const deleteComment = projectAction(DeleteTaskCommentSchema)
  .metadata({})
  .outputSchema(DeleteTaskCommentResultSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { projectId, commentId, taskId } = parsedInput
    const session = ctx.session

    await assertCommentAccess(
      taskId,
      projectId,
      session.user.id,
      ctx.projectRole
    )

    const comment = await db
      .select({
        authorId: taskCommentsTable.authorId,
        taskId: taskCommentsTable.taskId,
      })
      .from(taskCommentsTable)
      .where(eq(taskCommentsTable.id, commentId))
      .then((rows) => rows[0])

    if (!comment || comment.taskId !== taskId) {
      returnActionError("NOT_FOUND")
    }

    const canDelete =
      comment.authorId === session.user.id ||
      canManageWork(ctx.projectRole)
    if (!canDelete) returnActionError("FORBIDDEN")

    await db
      .delete(taskCommentsTable)
      .where(eq(taskCommentsTable.id, commentId))

    return {
      commentId,
    }
  })
