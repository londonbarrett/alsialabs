"use server"

import { SuccessSchema } from "@/actions/legacy/schemas/common"
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
} from "@/actions/safe-action"
import {
  archivedWindow,
  toTaskAssignmentDTO,
} from "@/lib/tasks/assignments"
import { z } from "zod"
import queries from "./queries"
import {
  ALL_TASK_STATUSES,
  ArchiveTaskSchema,
  AssignmentStatusResultSchema,
  COLLABORATOR_TASK_STATUSES,
  CreateTaskCommentSchema,
  CreateTaskSchema,
  DeleteTaskCommentResultSchema,
  DeleteTaskCommentSchema,
  MyAssignmentSchema,
  MyTasksTabSchema,
  TaskAssignmentHistoryResultSchema,
  TaskAssignmentHistorySchema,
  TaskAssignmentSchema,
  TaskCommentResultSchema,
  TaskCommentWithAuthorSchema,
  TaskPrioritySchema,
  TaskWithAssignmentsSchema,
  UnarchiveTaskResultSchema,
  UnarchiveTaskSchema,
  UpdateTaskCommentSchema,
  UpdateTaskSchema,
  type TaskAssignmentDTO,
} from "./schemas"
import {
  assertAssignees,
  assertCommentAccess,
  assertTaskMutable,
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

export const getTaskAssignmentHistory = projectAction(
  TaskAssignmentHistorySchema
)
  .metadata({})
  .outputSchema(TaskAssignmentHistoryResultSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canViewProject(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    return queries.getTaskAssignmentHistory(
      parsedInput.projectId,
      parsedInput.taskId,
      parsedInput.limit,
      parsedInput.offset
    )
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
      assigneeIds: loaded.assigneeIds,
      commentCount: 0,
      closedCount: loaded.closedCount,
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

    const previous = await queries.getTaskRowInProject(taskId, projectId)
    if (!previous) returnActionError("NOT_FOUND")

    await assertAssignees(projectId, uniqueIds)

    const row = await queries.updateTaskRow(parsedInput)
    if (!row) returnActionError("NOT_FOUND")

    await queries.syncTaskAssignments(
      taskId,
      uniqueIds,
      row,
      parsedInput.unassignAs
    )

    /**
     * Trigger (b): moving a repeating task's due date spawns for every
     * active member left without an open row — the fresh window's first
     * occurrence from the later of the new start date and now, so an old
     * start never backdates the spawn. A future start is an inclusive
     * anchor: an occurrence exactly on it is kept. An unchanged end date
     * (null == null included) never spawns.
     */
    const previousEnd = previous.endDate?.getTime() ?? null
    const nextEnd = parsedInput.endDate
      ? new Date(parsedInput.endDate).getTime()
      : null

    if (previous.recurrence && previousEnd !== nextEnd) {
      const now = new Date()
      const start = parsedInput.startDate
        ? new Date(parsedInput.startDate)
        : null
      const startsLater = start !== null && start.getTime() > now.getTime()

      await queries.spawnEligibleAssignments(taskId, {
        anchor: startsLater ? start : now,
        inclusive: startsLater,
      })
    }

    const loaded = await queries.getTaskWithAssignments(taskId)
    if (!loaded) returnActionError("NOT_FOUND")

    return {
      ...loaded.record,
      assignments: loaded.assignments,
      assigneeIds: loaded.assigneeIds,
      commentCount: 0,
      closedCount: loaded.closedCount,
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
    } else if (
      isTerminalStatus(row.status) &&
      !isTerminalStatus(status as TaskStatus) &&
      row.recurrence
    ) {
      // Repeat chains can't be reopened — terminal→open exists only on
      // non-repeating tasks, so history can never fork a successor.
      returnActionError("VALIDATION_FAILED")
    }

    /**
     * The cascade runs inside the status write's transaction (spec), and only
     * when an OPEN row actually crosses into a terminal status: re-completing
     * a done row would spawn a second successor. Reopen is rejected outright
     * on repeating tasks (rule above); on non-repeating tasks it never
     * spawns, so the unique-violation catch below guards spawn races and
     * stale reopens. The helper decides eligibility per member — the closing
     * assignee's successor plus any active member left without an open row.
     */
    const wasOpen = !isTerminalStatus(row.status)
    const crossesToTerminal =
      wasOpen && isTerminalStatus(status as TaskStatus)

    let spawnedIds: string[] = []
    try {
      spawnedIds = await queries.updateAssignmentStatus(
        assignmentId,
        status as TaskStatus,
        crossesToTerminal && row.recurrence && !row.archived
          ? {
              taskId: row.taskId,
              anchor: row.endDate ?? new Date(),
              closing: { userId: row.userId, endDate: row.endDate },
            }
          : null
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

    // Healed members arrive via the list reseed; nextAssignment reports only
    // the closing assignee's own successor.
    let nextAssignment: TaskAssignmentDTO | null = null

    for (const id of spawnedIds) {
      const nextView = await queries.getAssignmentViewById(id)

      if (nextView?.userId === row.userId) {
        nextAssignment = toTaskAssignmentDTO(nextView)
        break
      }
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

export const archiveTask = projectAction(ArchiveTaskSchema)
  .metadata({ revalidate: ["/app/proyectos/:projectId"] })
  .outputSchema(SuccessSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageWork(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { projectId, taskId, closeAs } = parsedInput

    const task = await queries.getTaskRowInProject(taskId, projectId)
    if (!task) returnActionError("NOT_FOUND")
    assertTaskMutable(task)

    await queries.archiveTaskRow(
      taskId,
      projectId,
      closeAs,
      archivedWindow(task, new Date())
    )

    return { success: true }
  })

export const unarchiveTask = projectAction(UnarchiveTaskSchema)
  .metadata({ revalidate: ["/app/proyectos/:projectId"] })
  .outputSchema(UnarchiveTaskResultSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageWork(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { projectId, taskId } = parsedInput

    // The existence check scopes the task to the project so a foreign taskId
    // can never reach the spawn helper, and a live task is rejected so this
    // never doubles as a "spawn now" button.
    const task = await queries.getTaskRowInProject(taskId, projectId)
    if (!task) returnActionError("NOT_FOUND")
    if (!task.archived) returnActionError("VALIDATION_FAILED")

    const spawnedIds = await queries.unarchiveTaskRow(
      taskId,
      projectId,
      new Date()
    )
    // Deleted (or unarchived) between the pre-read and the write.
    if (spawnedIds === null) returnActionError("NOT_FOUND")

    const spawned: TaskAssignmentDTO[] = []
    for (const id of spawnedIds) {
      const viewRow = await queries.getAssignmentViewById(id)
      if (viewRow) spawned.push(toTaskAssignmentDTO(viewRow))
    }

    return { spawned }
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
