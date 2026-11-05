"use server"

import { SuccessSchema } from "@/actions/schemas/common"
import type { TaskStatus } from "@/lib/drizzle/schema"
import {
  canChangeAnyAssignment,
  canManageWork,
  canViewProject,
  isTerminalStatus,
} from "@/lib/util/project-roles"
import {
  projectAction,
  returnActionError,
  sessionAction,
} from "@/lib/safe-action"
import { atTime, toTaskAssignmentDTO } from "@/lib/tasks/assignments"
import { computeNextOccurrence } from "@/lib/tasks/recurrence"
import { z } from "zod"
import queries from "./queries"
import {
  ALL_TASK_STATUSES,
  AssignmentStatusResultSchema,
  COLLABORATOR_TASK_STATUSES,
  CreateTaskCommentSchema,
  CreateTaskSchema,
  DeleteTaskCommentResultSchema,
  DeleteTaskCommentSchema,
  MyAssignmentSchema,
  MyTasksTabSchema,
  TaskAssignmentSchema,
  TaskCommentResultSchema,
  TaskCommentWithAuthorSchema,
  TaskPrioritySchema,
  TaskWithAssignmentsSchema,
  UpdateTaskCommentSchema,
  UpdateTaskSchema,
  type TaskAssignmentDTO,
} from "./schemas"
import {
  assertAssignees,
  assertCommentAccess,
  isUniqueViolation,
} from "./util"

export const getTasks = projectAction(z.object({ projectId: z.uuid() }))
  .metadata({})
  .outputSchema(z.array(TaskWithAssignmentsSchema))
  .action(async ({ parsedInput, ctx }) => {
    if (!canViewProject(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    return queries.getTasksWithAssignments(parsedInput.projectId)
  })

export const getMyTasks = sessionAction
  .inputSchema(z.object({ view: MyTasksTabSchema }))
  .metadata({})
  .outputSchema(z.array(MyAssignmentSchema))
  .action(async ({ parsedInput, ctx }) => {
    return queries.getMyTasks(ctx.session.user.id, parsedInput.view)
  })

export const createTask = projectAction(CreateTaskSchema)
  .metadata({ revalidate: ["/app/proyectos/:projectId"] })
  .outputSchema(TaskWithAssignmentsSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageWork(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const uniqueIds = [...new Set(parsedInput.assigneeIds)]
    await assertAssignees(parsedInput.projectId, uniqueIds)

    const created = await queries.createTask(parsedInput, uniqueIds)
    const loaded = await queries.getTaskWithAssignments(created.id)
    if (!loaded) returnActionError("NOT_FOUND")

    return {
      ...loaded.record,
      assignments: loaded.assignments,
      commentCount: 0,
    }
  })

export const updateTask = projectAction(UpdateTaskSchema)
  .metadata({ revalidate: ["/app/proyectos/:projectId"] })
  .outputSchema(TaskWithAssignmentsSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageWork(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { projectId, taskId } = parsedInput
    const uniqueIds = [...new Set(parsedInput.assigneeIds)]
    await assertAssignees(projectId, uniqueIds)

    const row = await queries.updateTaskRow(parsedInput)
    if (!row) returnActionError("NOT_FOUND")

    await queries.syncTaskAssignments(taskId, uniqueIds, row)

    const loaded = await queries.getTaskWithAssignments(taskId)
    if (!loaded) returnActionError("NOT_FOUND")

    return {
      ...loaded.record,
      assignments: loaded.assignments,
      commentCount: 0,
    }
  })

export const updateAssignmentStatus = projectAction(
  z.object({
    projectId: z.uuid(),
    assignmentId: z.uuid(),
    status: z.string(),
  })
)
  .metadata({})
  .outputSchema(AssignmentStatusResultSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { projectId, assignmentId, status } = parsedInput

    const row = await queries.getAssignmentForRow(
      assignmentId,
      projectId
    )
    if (!row) returnActionError("NOT_FOUND")

    if (!canChangeAnyAssignment(ctx.projectRole)) {
      if (row.userId !== ctx.session.user.id) {
        returnActionError("FORBIDDEN")
      }
      if (isTerminalStatus(row.status)) {
        returnActionError("FORBIDDEN")
      }
      if (
        !(COLLABORATOR_TASK_STATUSES as readonly string[]).includes(
          status
        )
      ) {
        returnActionError("VALIDATION_FAILED")
      }
    } else if (
      !(ALL_TASK_STATUSES as readonly string[]).includes(status)
    ) {
      returnActionError("VALIDATION_FAILED")
    }

    /**
     * The cascade runs inside the status write's transaction (spec), and only
     * when an OPEN row actually crosses into a terminal status: re-completing
     * a done row would spawn a second successor, and reopening one whose
     * successor exists would trip `task_assignment_open_unique`.
     */
    const wasOpen = !isTerminalStatus(row.status)
    const crossesToTerminal =
      wasOpen && isTerminalStatus(status as TaskStatus)
    let spawn: {
      taskId: string
      userId: string
      startDate: Date
      endDate: Date
    } | null = null

    if (crossesToTerminal && row.recurrence) {
      const next = computeNextOccurrence(
        {
          recurrence: row.recurrence,
          interval: row.interval,
          daysOfWeek: row.daysOfWeek,
          startTime: row.startTime,
          endDate: row.taskEndDate,
        },
        row.endDate ?? new Date()
      )

      if (next) {
        spawn = {
          taskId: row.taskId,
          userId: row.userId,
          startDate: next,
          endDate: atTime(next, row.endTime),
        }
      }
    }

    let spawnedId: string | null = null
    try {
      spawnedId = await queries.updateAssignmentStatus(
        assignmentId,
        status as TaskStatus,
        spawn
      )
    } catch (error) {
      // A reopen that races an existing open successor (double submit,
      // reopened parent) is a conflict, not a crash.
      if (isUniqueViolation(error)) {
        returnActionError("VALIDATION_FAILED")
      }
      throw error
    }

    const viewRow = await queries.getAssignmentViewById(assignmentId)
    if (!viewRow) returnActionError("NOT_FOUND")

    let nextAssignment: TaskAssignmentDTO | null = null

    if (spawnedId) {
      const nextView = await queries.getAssignmentViewById(spawnedId)

      nextAssignment = nextView ? toTaskAssignmentDTO(nextView) : null
    }

    return {
      assignment: toTaskAssignmentDTO(viewRow),
      nextAssignment,
    }
  })

export const updateAssignmentComment = projectAction(
  z.object({
    projectId: z.uuid(),
    assignmentId: z.uuid(),
    comment: z.string().max(2000),
  })
)
  .metadata({})
  .outputSchema(TaskAssignmentSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { projectId, assignmentId, comment } = parsedInput

    const row = await queries.getAssignmentForComment(
      assignmentId,
      projectId
    )
    if (!row) returnActionError("NOT_FOUND")

    if (!canChangeAnyAssignment(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const trimmed = comment.trim()

    await queries.updateAssignmentComment(assignmentId, trimmed || null)

    const viewRow = await queries.getAssignmentViewById(assignmentId)
    if (!viewRow) returnActionError("NOT_FOUND")

    return toTaskAssignmentDTO(viewRow)
  })

export const updateTaskPriority = projectAction(
  z.object({
    projectId: z.uuid(),
    taskId: z.uuid(),
    priority: z.string().nullable(),
  })
)
  .metadata({ revalidate: ["/app/proyectos/:projectId"] })
  .outputSchema(SuccessSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageWork(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { projectId, taskId, priority } = parsedInput
    const parsed = TaskPrioritySchema.safeParse(priority)
    if (!parsed.success) {
      returnActionError("VALIDATION_FAILED")
    }

    await queries.updateTaskPriority(taskId, projectId, parsed.data)

    return { success: true }
  })

export const deleteTask = projectAction(
  z.object({
    projectId: z.uuid(),
    taskId: z.uuid(),
  })
)
  .metadata({ revalidate: ["/app/proyectos/:projectId"] })
  .outputSchema(SuccessSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageWork(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { projectId, taskId } = parsedInput

    await queries.deleteTask(taskId, projectId)

    return { success: true }
  })

// ---------- Task comments ----------

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

    return queries.getTaskComments(taskId)
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

    const inserted = await queries.createComment(
      taskId,
      session.user.id,
      content
    )
    const author = await queries.getUserProfile(session.user.id)

    return {
      comment: {
        id: inserted.id,
        taskId: inserted.taskId,
        authorId: inserted.authorId,
        authorName: author?.name ?? null,
        authorImage: author?.image ?? null,
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

    const comment = await queries.getCommentRow(commentId)
    if (!comment || comment.taskId !== taskId) {
      returnActionError("NOT_FOUND")
    }

    if (comment.authorId !== session.user.id)
      returnActionError("FORBIDDEN")

    await queries.updateCommentContent(commentId, content)

    const updated = await queries.getCommentWithAuthor(commentId)
    if (!updated) returnActionError("NOT_FOUND")

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

    const comment = await queries.getCommentRow(commentId)
    if (!comment || comment.taskId !== taskId) {
      returnActionError("NOT_FOUND")
    }

    const canDelete =
      comment.authorId === session.user.id ||
      canManageWork(ctx.projectRole)
    if (!canDelete) returnActionError("FORBIDDEN")

    await queries.deleteComment(commentId)

    return {
      commentId,
    }
  })
