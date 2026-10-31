"use server"

import { createNextRoutineTask } from "@/actions/routines"
import { db } from "@/lib/drizzle/client"
import type { Task, TaskStatus } from "@/lib/drizzle/schema"
import {
  projectMembershipTable,
  projectsTable,
  taskAssignmentDetailView,
  taskAssignmentsTable,
  taskCommentsTable,
  tasksTable,
  usersTable,
} from "@/lib/drizzle/schema"
import {
  projectAction,
  returnActionError,
  sessionAction,
} from "@/lib/safe-action"
import { SuccessSchema } from "@/actions/schemas/common"
import {
  ALL_TASK_STATUSES,
  AssignmentStatusResultSchema,
  CollaboratorStatusSchema,
  COLLABORATOR_TASK_STATUSES,
  CreateTaskV2Schema,
  MyTaskSchema,
  OwnerStatusSchema,
  TaskPrioritySchema,
  TaskStatusResultSchema,
  TaskWithAssignmentsSchema,
  UpdateTaskV2Schema,
  type TaskAssignmentDTO,
  type TaskRecordV2DTO,
} from "@/actions/schemas/task"
import {
  canChangeAnyAssignment,
  canManageWork,
  canViewProject,
  isTerminalStatus,
} from "@/lib/project-roles"
import {
  firstAssignmentWindow,
  toTaskAssignmentDTO,
} from "@/lib/tasks/assignments"
import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm"
import { z } from "zod"

const ASSIGNMENT_VIEW_COLUMNS = {
  assignmentId: taskAssignmentDetailView.assignmentId,
  taskId: taskAssignmentDetailView.taskId,
  userId: taskAssignmentDetailView.userId,
  status: taskAssignmentDetailView.status,
  comment: taskAssignmentDetailView.comment,
  startDate: taskAssignmentDetailView.startDate,
  endDate: taskAssignmentDetailView.endDate,
  userName: taskAssignmentDetailView.userName,
  userEmail: taskAssignmentDetailView.userEmail,
  userImage: taskAssignmentDetailView.userImage,
}

function toTaskRecord(
  row: typeof tasksTable.$inferSelect
): TaskRecordV2DTO {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    priority: row.priority,
    startDate: row.startDate,
    endDate: row.endDate,
    recurrence: row.recurrence,
    interval: row.interval,
    daysOfWeek: row.daysOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    cost: row.cost,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function assertAssignees(
  projectId: string,
  userIds: string[]
): Promise<void> {
  if (userIds.length === 0) return

  const [project, members] = await Promise.all([
    db
      .select({ primaryOwnerId: projectsTable.primaryOwnerId })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .then((rows) => rows[0]),
    db
      .select({ userId: projectMembershipTable.userId })
      .from(projectMembershipTable)
      .where(eq(projectMembershipTable.projectId, projectId)),
  ])

  if (!project) returnActionError("NOT_FOUND")

  const allowed = new Set([
    project!.primaryOwnerId,
    ...members.map((m) => m.userId),
  ])
  if (userIds.some((id) => !allowed.has(id))) {
    returnActionError("FORBIDDEN")
  }
}

async function loadTaskWithAssignments(
  taskId: string
): Promise<{
  record: TaskRecordV2DTO
  assignments: TaskAssignmentDTO[]
}> {
  const row = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, taskId))
    .then((rows) => rows[0])

  if (!row) returnActionError("NOT_FOUND")

  const assignmentRows = await db
    .select(ASSIGNMENT_VIEW_COLUMNS)
    .from(taskAssignmentDetailView)
    .where(eq(taskAssignmentDetailView.taskId, taskId))

  return {
    record: toTaskRecord(row!),
    assignments: assignmentRows.map(toTaskAssignmentDTO),
  }
}

// ---------- Queries ----------

export const getTasks = projectAction(
  z.object({ projectId: z.uuid() })
)
  .metadata({})
  .outputSchema(z.array(TaskWithAssignmentsSchema))
  .action(async ({ parsedInput, ctx }) => {
    if (!canViewProject(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { projectId } = parsedInput

    const taskRows = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.projectId, projectId))
      .orderBy(desc(tasksTable.createdAt))

    const ids = taskRows.map((t) => t.id)
    if (ids.length === 0) return []

    const [assignmentRows, commentRows] = await Promise.all([
      db
        .select(ASSIGNMENT_VIEW_COLUMNS)
        .from(taskAssignmentDetailView)
        .where(inArray(taskAssignmentDetailView.taskId, ids)),
      db
        .select({
          taskId: taskCommentsTable.taskId,
          cnt: sql<number>`count(*)::int`,
        })
        .from(taskCommentsTable)
        .where(inArray(taskCommentsTable.taskId, ids))
        .groupBy(taskCommentsTable.taskId),
    ])

    const assignmentsByTask = new Map<
      string,
      TaskAssignmentDTO[]
    >()
    for (const row of assignmentRows) {
      const list = assignmentsByTask.get(row.taskId) ?? []
      list.push(toTaskAssignmentDTO(row))
      assignmentsByTask.set(row.taskId, list)
    }

    const counts = new Map(commentRows.map((r) => [r.taskId, r.cnt]))

    return taskRows.map((row) => ({
      ...toTaskRecord(row),
      assignments: assignmentsByTask.get(row.id) ?? [],
      commentCount: counts.get(row.id) ?? 0,
    }))
  })

export const getMyTasks = sessionAction
  .inputSchema(
    z.object({
      statusFilter: z.string().optional(),
      projectIdFilter: z.string().optional(),
    })
  )
  .metadata({})
  .outputSchema(z.array(MyTaskSchema))
  .action(async ({ parsedInput, ctx }) => {
    const { statusFilter, projectIdFilter } = parsedInput
    const session = ctx.session

    const conditions = [eq(tasksTable.assigneeId, session.user.id)]
    if (statusFilter) {
      if (
        (ALL_TASK_STATUSES as readonly string[]).includes(statusFilter)
      ) {
        conditions.push(
          eq(tasksTable.status, statusFilter as TaskStatus)
        )
      }
    }
    if (projectIdFilter) {
      conditions.push(eq(tasksTable.projectId, projectIdFilter))
    }

    const where = and(...conditions)

    const commentCounts = db
      .select({
        taskId: taskCommentsTable.taskId,
        cnt: sql<number>`count(*)::int`.as("cnt"),
      })
      .from(taskCommentsTable)
      .groupBy(taskCommentsTable.taskId)
      .as("task_comment_counts")

    const primaryOwners = db
      .select({
        projectId: tasksTable.projectId,
        userId: sql<string>`min(${usersTable.id})`.as("userId"),
      })
      .from(tasksTable)
      .groupBy(tasksTable.projectId)
      .as("primary_owners")

    const ownerUsers = db
      .select({
        userId: usersTable.id,
        userName: usersTable.name,
        userEmail: usersTable.email,
      })
      .from(usersTable)
      .as("owner_users")

    return db
      .select({
        id: tasksTable.id,
        projectId: tasksTable.projectId,
        projectName: projectsTable.name,
        projectColor: projectsTable.color,
        projectOwnerName: sql<
          string | null
        >`coalesce(${ownerUsers.userName}, ${ownerUsers.userEmail})`,
        name: tasksTable.name,
        description: tasksTable.description,
        cost: tasksTable.cost,
        status: tasksTable.status,
        priority: tasksTable.priority,
        routineId: tasksTable.routineId,
        dueDate: tasksTable.dueDate,
        startDate: tasksTable.startDate,
        endDate: tasksTable.endDate,
        recurrence: tasksTable.recurrence,
        interval: tasksTable.interval,
        daysOfWeek: tasksTable.daysOfWeek,
        startTime: tasksTable.startTime,
        endTime: tasksTable.endTime,
        assigneeId: tasksTable.assigneeId,
        assigneeName: sql<string>`coalesce(${usersTable.name}, ${usersTable.email})`,
        isOwner: sql<boolean>`coalesce((
        select true from ${projectsTable}
        where ${projectsTable.id} = ${tasksTable.projectId}
        and ${projectsTable.primaryOwnerId} = ${session.user.id}
        limit 1
      ), false)`,
        commentCount: sql<number>`coalesce(${commentCounts.cnt}, 0)`,
        createdAt: tasksTable.createdAt,
        updatedAt: tasksTable.updatedAt,
      })
      .from(tasksTable)
      .innerJoin(
        projectsTable,
        eq(tasksTable.projectId, projectsTable.id)
      )
      .leftJoin(commentCounts, eq(tasksTable.id, commentCounts.taskId))
      .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
      .leftJoin(
        primaryOwners,
        eq(tasksTable.projectId, primaryOwners.projectId)
      )
      .leftJoin(ownerUsers, eq(primaryOwners.userId, ownerUsers.userId))
      .where(where)
      .orderBy(desc(tasksTable.createdAt))
  })

// ---------- Mutations ----------

export const createTask = projectAction(CreateTaskV2Schema)
  .metadata({ revalidate: ["/app/proyectos/:projectId"] })
  .outputSchema(TaskWithAssignmentsSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageWork(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const {
      projectId,
      name,
      description,
      priority,
      assigneeIds,
      startDate,
      endDate,
      recurrence,
      interval,
      daysOfWeek,
      startTime,
      endTime,
      cost,
    } = parsedInput

    const uniqueIds = [...new Set(assigneeIds)]
    await assertAssignees(projectId, uniqueIds)

    let createdId = ""
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(tasksTable)
        .values({
          projectId,
          name,
          description: description || null,
          priority: priority ?? null,
          startDate: recurrence ? null : new Date(startDate!),
          endDate: recurrence ? null : new Date(endDate!),
          recurrence: recurrence ?? null,
          interval,
          daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : null,
          startTime: startTime || null,
          endTime: endTime || null,
          cost: cost || null,
        })
        .returning()

      createdId = row.id

      if (uniqueIds.length > 0) {
        const window = firstAssignmentWindow(row)
        await tx.insert(taskAssignmentsTable).values(
          uniqueIds.map((userId) => ({
            taskId: row.id,
            userId,
            status: "todo" as const,
            startDate: window.startDate,
            endDate: window.endDate,
          }))
        )
      }
    })

    const loaded = await loadTaskWithAssignments(createdId)
    return { ...loaded.record, assignments: loaded.assignments, commentCount: 0 }
  })

export const updateTask = projectAction(UpdateTaskV2Schema)
  .metadata({ revalidate: ["/app/proyectos/:projectId"] })
  .outputSchema(TaskWithAssignmentsSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageWork(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const {
      projectId,
      taskId,
      name,
      description,
      priority,
      assigneeIds,
      startDate,
      endDate,
      recurrence,
      interval,
      daysOfWeek,
      startTime,
      endTime,
      cost,
    } = parsedInput

    const uniqueIds = [...new Set(assigneeIds)]
    await assertAssignees(projectId, uniqueIds)

    const [row] = await db
      .update(tasksTable)
      .set({
        name,
        description: description || null,
        priority: priority ?? null,
        startDate: recurrence ? null : new Date(startDate!),
        endDate: recurrence ? null : new Date(endDate!),
        recurrence: recurrence ?? null,
        interval,
        daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : null,
        startTime: startTime || null,
        endTime: endTime || null,
        cost: cost || null,
      })
      .where(
        and(
          eq(tasksTable.id, taskId),
          eq(tasksTable.projectId, projectId)
        )
      )
      .returning()

    if (!row) returnActionError("NOT_FOUND")

    const openAssignments = await db
      .select({
        id: taskAssignmentsTable.id,
        userId: taskAssignmentsTable.userId,
      })
      .from(taskAssignmentsTable)
      .where(
        and(
          eq(taskAssignmentsTable.taskId, taskId),
          notInArray(taskAssignmentsTable.status, [
            "done",
            "cancelled",
          ])
        )
      )

    const openUserIds = new Set(openAssignments.map((a) => a.userId))
    const toAdd = uniqueIds.filter((id) => !openUserIds.has(id))
    const toRemove = openAssignments
      .filter((a) => !uniqueIds.includes(a.userId))
      .map((a) => a.id)

    await db.transaction(async (tx) => {
      if (toRemove.length > 0) {
        await tx
          .delete(taskAssignmentsTable)
          .where(inArray(taskAssignmentsTable.id, toRemove))
      }
      if (toAdd.length > 0) {
        const window = firstAssignmentWindow(row)
        await tx.insert(taskAssignmentsTable).values(
          toAdd.map((userId) => ({
            taskId,
            userId,
            status: "todo" as const,
            startDate: window.startDate,
            endDate: window.endDate,
          }))
        )
      }
    })

    const loaded = await loadTaskWithAssignments(taskId)
    return { ...loaded.record, assignments: loaded.assignments, commentCount: 0 }
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

    const row = await db
      .select({
        id: taskAssignmentsTable.id,
        userId: taskAssignmentsTable.userId,
        status: taskAssignmentsTable.status,
      })
      .from(taskAssignmentsTable)
      .innerJoin(
        tasksTable,
        eq(taskAssignmentsTable.taskId, tasksTable.id)
      )
      .where(
        and(
          eq(taskAssignmentsTable.id, assignmentId),
          eq(tasksTable.projectId, projectId)
        )
      )
      .then((rows) => rows[0])

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

    await db
      .update(taskAssignmentsTable)
      .set({ status: status as TaskStatus })
      .where(eq(taskAssignmentsTable.id, assignmentId))

    const viewRow = await db
      .select(ASSIGNMENT_VIEW_COLUMNS)
      .from(taskAssignmentDetailView)
      .where(eq(taskAssignmentDetailView.assignmentId, assignmentId))
      .then((rows) => rows[0])

    if (!viewRow) returnActionError("NOT_FOUND")

    return {
      assignment: toTaskAssignmentDTO(viewRow),
      nextAssignment: null,
    }
  })

export const updateTaskStatus = projectAction(
  z.object({
    projectId: z.uuid(),
    taskId: z.uuid(),
    status: z.string(),
  })
)
  .metadata({ revalidate: ["/app/proyectos/:projectId"] })
  .outputSchema(TaskStatusResultSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { projectId, taskId, status } = parsedInput

    const currentTask = await db
      .select({
        status: tasksTable.status,
        assigneeId: tasksTable.assigneeId,
        routineId: tasksTable.routineId,
        dueDate: tasksTable.dueDate,
      })
      .from(tasksTable)
      .where(
        and(
          eq(tasksTable.id, taskId),
          eq(tasksTable.projectId, projectId)
        )
      )
      .then((rows) => rows[0])

    if (!currentTask) {
      returnActionError("NOT_FOUND")
    }

    const isOwner = ctx.isProjectOwner

    if (!isOwner) {
      if (
        currentTask.status === "done" ||
        currentTask.status === "cancelled"
      ) {
        returnActionError("FORBIDDEN")
      }

      const parsed = CollaboratorStatusSchema.safeParse(status)
      if (!parsed.success) {
        returnActionError("VALIDATION_FAILED")
      }
      await db
        .update(tasksTable)
        .set({ status: parsed.data })
        .where(
          and(
            eq(tasksTable.id, taskId),
            eq(tasksTable.projectId, projectId)
          )
        )
    } else {
      const parsed = OwnerStatusSchema.safeParse(status)
      if (!parsed.success) {
        returnActionError("VALIDATION_FAILED")
      }
      await db
        .update(tasksTable)
        .set({ status: parsed.data })
        .where(
          and(
            eq(tasksTable.id, taskId),
            eq(tasksTable.projectId, projectId)
          )
        )
    }

    let nextTask: Task | undefined
    if (
      currentTask.routineId &&
      (status === "done" || status === "cancelled")
    ) {
      const spawned = await createNextRoutineTask({
        projectId,
        routineId: currentTask.routineId,
        after: currentTask.dueDate,
      })
      if (spawned.data?.spawned) nextTask = spawned.data.task
    }

    return { nextTask }
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

    await db
      .update(tasksTable)
      .set({ priority: parsed.data })
      .where(
        and(
          eq(tasksTable.id, taskId),
          eq(tasksTable.projectId, projectId)
        )
      )

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

    await db
      .delete(tasksTable)
      .where(
        and(
          eq(tasksTable.id, taskId),
          eq(tasksTable.projectId, projectId)
        )
      )

    return { success: true }
  })
