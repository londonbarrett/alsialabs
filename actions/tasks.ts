"use server"

import { db } from "@/lib/drizzle/client"
import type { TaskStatus } from "@/lib/drizzle/schema"
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
  COLLABORATOR_TASK_STATUSES,
  CreateTaskSchema,
  MyAssignmentSchema,
  MyTasksTabSchema,
  TaskAssignmentSchema,
  TaskPrioritySchema,
  TaskWithAssignmentsSchema,
  UpdateTaskSchema,
  type TaskAssignmentDTO,
  type TaskRecordDTO,
} from "@/actions/schemas/task"
import {
  canChangeAnyAssignment,
  canManageWork,
  canViewProject,
  isTerminalStatus,
} from "@/lib/project-roles"
import {
  atTime,
  firstAssignmentWindow,
  toTaskAssignmentDTO,
} from "@/lib/tasks/assignments"
import { computeNextOccurrence } from "@/lib/tasks/recurrence"
import { and, asc, desc, eq, inArray, notInArray, sql } from "drizzle-orm"
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
): TaskRecordDTO {
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
  record: TaskRecordDTO
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
  .inputSchema(z.object({ view: MyTasksTabSchema }))
  .metadata({})
  .outputSchema(z.array(MyAssignmentSchema))
  .action(async ({ parsedInput, ctx }) => {
    const { view } = parsedInput
    const userId = ctx.session.user.id

    /**
     * Drizzle emits the detail view's columns unqualified, so the view query
     * runs on its own: joining `project` (status, start_date...) or
     * `project_membership` (user_id...) here would make the statement
     * ambiguous. Projects and comment counts come back as keyed lookups.
     */
    const viewRows = await db
      .select({
        assignmentId: taskAssignmentDetailView.assignmentId,
        taskId: taskAssignmentDetailView.taskId,
        projectId: taskAssignmentDetailView.projectId,
        name: taskAssignmentDetailView.taskName,
        description: taskAssignmentDetailView.taskDescription,
        priority: taskAssignmentDetailView.taskPriority,
        status: taskAssignmentDetailView.status,
        comment: taskAssignmentDetailView.comment,
        startDate: taskAssignmentDetailView.startDate,
        endDate: taskAssignmentDetailView.endDate,
        recurrence: taskAssignmentDetailView.taskRecurrence,
      })
      .from(taskAssignmentDetailView)
      .where(eq(taskAssignmentDetailView.userId, userId))
      .orderBy(
        view === "past"
          ? desc(taskAssignmentDetailView.endDate)
          : asc(taskAssignmentDetailView.startDate)
      )

    if (viewRows.length === 0) return []

    const projectIds = [
      ...new Set(viewRows.map((row) => row.projectId)),
    ]
    const taskIds = [...new Set(viewRows.map((row) => row.taskId))]

    const [projectRows, countRows] = await Promise.all([
      db
        .select({
          id: projectsTable.id,
          projectName: projectsTable.name,
          projectColor: projectsTable.color,
          primaryOwnerId: projectsTable.primaryOwnerId,
          projectOwnerName: sql<
            string | null
          >`coalesce(${usersTable.name}, ${usersTable.email})`,
          memberRole: projectMembershipTable.role,
        })
        .from(projectsTable)
        .leftJoin(
          usersTable,
          eq(projectsTable.primaryOwnerId, usersTable.id)
        )
        .leftJoin(
          projectMembershipTable,
          and(
            eq(projectMembershipTable.projectId, projectsTable.id),
            eq(projectMembershipTable.userId, userId)
          )
        )
        .where(inArray(projectsTable.id, projectIds)),
      db
        .select({
          taskId: taskCommentsTable.taskId,
          cnt: sql<number>`count(*)::int`,
        })
        .from(taskCommentsTable)
        .where(inArray(taskCommentsTable.taskId, taskIds))
        .groupBy(taskCommentsTable.taskId),
    ])

    const projectsById = new Map(
      projectRows.map((row) => [row.id, row])
    )
    const countsByTask = new Map(
      countRows.map((row) => [row.taskId, row.cnt])
    )

    const isOpen = (status: string) =>
      !isTerminalStatus(status as TaskStatus)

    const merged = viewRows.map((row) => {
      const project = projectsById.get(row.projectId)
      const isOwner = project?.primaryOwnerId === userId
      // A caller with no project row left still shows in history as a
      // collaborator: their past work is not rewritten by a role change.
      const role = isOwner
        ? ("owner" as const)
        : project?.memberRole ?? ("collaborator" as const)
      const hasAccess = Boolean(
        project && (isOwner || project.memberRole !== null)
      )
      return { row, project, role, hasAccess }
    })

    const visible =
      view === "active"
        ? // An open assignment is only actionable while the caller still has
          // a place on the project; a removed collaborator's row disappears.
          merged.filter((m) => isOpen(m.row.status) && m.hasAccess)
        : // Terminal work stays visible even after the caller leaves the
          // project, so their history outlives the membership.
          merged.filter((m) => !isOpen(m.row.status))

    return visible.map(({ row, project, role }) =>
      MyAssignmentSchema.parse({
        ...row,
        projectName: project?.projectName ?? "",
        projectColor: project?.projectColor ?? "",
        projectOwnerName: project?.projectOwnerName ?? null,
        role,
        commentCount: countsByTask.get(row.taskId) ?? 0,
      })
    )
  })

// ---------- Mutations ----------

export const createTask = projectAction(CreateTaskSchema)
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

export const updateTask = projectAction(UpdateTaskSchema)
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
        endDate: taskAssignmentsTable.endDate,
        taskId: tasksTable.id,
        recurrence: tasksTable.recurrence,
        interval: tasksTable.interval,
        daysOfWeek: tasksTable.daysOfWeek,
        startTime: tasksTable.startTime,
        endTime: tasksTable.endTime,
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

    let nextAssignment: TaskAssignmentDTO | null = null

    if (
      (status === "done" || status === "cancelled") &&
      row.recurrence
    ) {
      const next = computeNextOccurrence(
        {
          recurrence: row.recurrence,
          interval: row.interval,
          daysOfWeek: row.daysOfWeek,
          startTime: row.startTime,
        },
        row.endDate ?? new Date()
      )

      if (next) {
        const [inserted] = await db
          .insert(taskAssignmentsTable)
          .values({
            taskId: row.taskId,
            userId: row.userId,
            status: "todo",
            startDate: next,
            endDate: atTime(next, row.endTime),
          })
          .returning()

        const nextView = await db
          .select(ASSIGNMENT_VIEW_COLUMNS)
          .from(taskAssignmentDetailView)
          .where(
            eq(taskAssignmentDetailView.assignmentId, inserted.id)
          )
          .then((rows) => rows[0])

        nextAssignment = nextView
          ? toTaskAssignmentDTO(nextView)
          : null
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

    const row = await db
      .select({
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
      returnActionError("FORBIDDEN")
    }

    const trimmed = comment.trim()

    await db
      .update(taskAssignmentsTable)
      .set({ comment: trimmed || null })
      .where(eq(taskAssignmentsTable.id, assignmentId))

    const viewRow = await db
      .select(ASSIGNMENT_VIEW_COLUMNS)
      .from(taskAssignmentDetailView)
      .where(eq(taskAssignmentDetailView.assignmentId, assignmentId))
      .then((rows) => rows[0])

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
