"use server"

import { verifyProjectAccess } from "@/lib/actions/project-access"
import { createNextRoutineTask } from "@/lib/actions/routines"
import { isSuperUser } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import type { Task } from "@/lib/drizzle/schema"
import {
  projectOwnersTable,
  projectsTable,
  taskCommentsTable,
  tasksTable,
  usersTable,
} from "@/lib/drizzle/schema"
import {
  projectScopedAction,
  returnActionError,
  sessionAction,
} from "@/lib/safe-action"
import { and, desc, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const taskSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .transform((v) => v.trim()),
  description: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
  cost: z.string().optional().default(""),
  status: z
    .enum([
      "todo",
      "in_progress",
      "in_review",
      "blocked",
      "done",
      "cancelled",
    ])
    .optional()
    .default("todo"),
  priority: z.enum(["urgent", "high"]).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
})

const ownerStatusSchema = z.enum([
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
])

const collaboratorStatusSchema = z.enum([
  "in_progress",
  "blocked",
  "in_review",
])

export type TaskFormData = z.infer<typeof taskSchema>

// ---------- Queries ----------

export const getTasks = projectScopedAction(
  z.object({ projectId: z.uuid() })
)
  .metadata({ permission: { module: "projects", action: "view" } })
  .action(async ({ parsedInput }) => {
    const { projectId } = parsedInput

    const commentCounts = db
      .select({
        taskId: taskCommentsTable.taskId,
        cnt: sql<number>`count(*)::int`.as("cnt"),
      })
      .from(taskCommentsTable)
      .groupBy(taskCommentsTable.taskId)
      .as("task_comment_counts")

    return db
      .select({
        id: tasksTable.id,
        projectId: tasksTable.projectId,
        name: tasksTable.name,
        description: tasksTable.description,
        cost: tasksTable.cost,
        status: tasksTable.status,
        priority: tasksTable.priority,
        routineId: tasksTable.routineId,
        dueDate: tasksTable.dueDate,
        assigneeId: tasksTable.assigneeId,
        assigneeName: sql<string>`coalesce(${usersTable.name}, ${usersTable.email})`,
        createdAt: tasksTable.createdAt,
        updatedAt: tasksTable.updatedAt,
        commentCount: sql<number>`coalesce(${commentCounts.cnt}, 0)`,
      })
      .from(tasksTable)
      .leftJoin(commentCounts, eq(tasksTable.id, commentCounts.taskId))
      .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
      .where(eq(tasksTable.projectId, projectId))
      .orderBy(desc(tasksTable.createdAt))
  })

export const getMyTasks = sessionAction
  .inputSchema(
    z.object({
      statusFilter: z.string().optional(),
      projectIdFilter: z.string().optional(),
    })
  )
  .metadata({ permission: { module: "projects", action: "view" } })
  .action(async ({ parsedInput, ctx }) => {
    const { statusFilter, projectIdFilter } = parsedInput
    const session = ctx.session
    const isSuper = isSuperUser(
      session as { user: { role: string | null } }
    )

    const conditions = []
    if (!isSuper) {
      conditions.push(eq(tasksTable.assigneeId, session.user.id))
    }
    if (statusFilter) {
      const validStatuses = [
        "todo",
        "in_progress",
        "in_review",
        "blocked",
        "done",
        "cancelled",
      ] as const
      if (
        validStatuses.includes(
          statusFilter as (typeof validStatuses)[number]
        )
      ) {
        conditions.push(
          eq(
            tasksTable.status,
            statusFilter as (typeof validStatuses)[number]
          )
        )
      }
    }
    if (projectIdFilter) {
      conditions.push(eq(tasksTable.projectId, projectIdFilter))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

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
        projectId: projectOwnersTable.projectId,
        userId: sql<string>`min(${projectOwnersTable.userId})`.as(
          "userId"
        ),
      })
      .from(projectOwnersTable)
      .groupBy(projectOwnersTable.projectId)
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
        assigneeId: tasksTable.assigneeId,
        assigneeName: sql<string>`coalesce(${usersTable.name}, ${usersTable.email})`,
        isOwner: sql<boolean>`coalesce((
        select true from ${projectOwnersTable}
        where ${projectOwnersTable.projectId} = ${tasksTable.projectId}
        and ${projectOwnersTable.userId} = ${session.user.id}
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

export type MyTask = NonNullable<
  Awaited<ReturnType<typeof getMyTasks>>["data"]
>[number]

// ---------- Mutations ----------

const upsertTaskSchema = taskSchema.extend({
  projectId: z.uuid(),
  taskId: z.uuid().optional(),
})

export const upsertTask = projectScopedAction(upsertTaskSchema)
  .metadata({ permission: { module: "projects", action: "edit" } })
  .action(async ({ parsedInput, ctx }) => {
    if (!ctx.isProjectOwner) {
      returnActionError("FORBIDDEN")
    }

    const {
      projectId,
      taskId,
      name,
      description,
      cost,
      status,
      priority,
      dueDate,
      assigneeId,
    } = parsedInput

    let taskRow: typeof tasksTable.$inferSelect

    if (taskId) {
      const rows = await db
        .update(tasksTable)
        .set({
          name,
          description: description || null,
          cost: cost || null,
          status,
          priority: priority ?? null,
          dueDate: dueDate ? new Date(dueDate) : null,
          assigneeId: assigneeId ?? null,
        })
        .where(
          and(
            eq(tasksTable.id, taskId),
            eq(tasksTable.projectId, projectId)
          )
        )
        .returning()
      if (!rows[0]) returnActionError("NOT_FOUND")
      taskRow = rows[0]
    } else {
      const rows = await db
        .insert(tasksTable)
        .values({
          projectId,
          name,
          description: description || null,
          cost: cost || null,
          status,
          priority: priority ?? null,
          dueDate: dueDate ? new Date(dueDate) : null,
          assigneeId: assigneeId ?? null,
        })
        .returning()
      taskRow = rows[0]
    }

    const assignee = taskRow.assigneeId
      ? await db
          .select({ name: usersTable.name, email: usersTable.email })
          .from(usersTable)
          .where(eq(usersTable.id, taskRow.assigneeId))
          .then((rows) => rows[0])
      : null

    revalidatePath(`/dashboard/projects/${projectId}`)

    return {
      ...taskRow,
      assigneeName: assignee ? assignee.name || assignee.email : null,
      commentCount: 0,
    }
  })

export const updateTaskStatus = sessionAction
  .inputSchema(
    z.object({
      projectId: z.uuid(),
      taskId: z.uuid(),
      status: z.string(),
    })
  )
  .metadata({})
  .action(async ({ parsedInput, ctx }) => {
    const { projectId, taskId, status } = parsedInput
    const session = ctx.session

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

    const isAssignee = currentTask.assigneeId === session.user.id
    const access = await verifyProjectAccess(
      projectId,
      session.user.id,
      session.user.role ?? null
    )

    if (!access.hasAccess && !isAssignee) {
      returnActionError("NOT_FOUND")
    }

    const isOwner = access.isOwner

    if (!isOwner) {
      if (
        currentTask.status === "done" ||
        currentTask.status === "cancelled"
      ) {
        returnActionError("FORBIDDEN")
      }

      const parsed = collaboratorStatusSchema.safeParse(status)
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
      const parsed = ownerStatusSchema.safeParse(status)
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
      const spawned = await createNextRoutineTask(
        currentTask.routineId,
        currentTask.dueDate
      )
      if (spawned.success && spawned.spawned) nextTask = spawned.task
    }

    revalidatePath(`/dashboard/projects/${projectId}`)
    return { nextTask }
  })

export const updateTaskPriority = projectScopedAction(
  z.object({
    projectId: z.uuid(),
    taskId: z.uuid(),
    priority: z.string().nullable(),
  })
)
  .metadata({ permission: { module: "projects", action: "edit" } })
  .action(async ({ parsedInput, ctx }) => {
    if (!ctx.isProjectOwner) {
      returnActionError("FORBIDDEN")
    }

    const { projectId, taskId, priority } = parsedInput
    const taskPrioritySchema = z.enum(["urgent", "high"]).nullable()
    const parsed = taskPrioritySchema.safeParse(priority)
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

    revalidatePath(`/dashboard/projects/${projectId}`)
  })

export const deleteTask = projectScopedAction(
  z.object({
    projectId: z.uuid(),
    taskId: z.uuid(),
  })
)
  .metadata({ permission: { module: "projects", action: "delete" } })
  .action(async ({ parsedInput, ctx }) => {
    if (!ctx.isProjectOwner) {
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

    revalidatePath(`/dashboard/projects/${projectId}`)
  })
