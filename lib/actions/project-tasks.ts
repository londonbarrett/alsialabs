"use server"

import { auth, isSuperUser, requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import {
  projectCollaboratorsTable,
  projectOwnersTable,
  projectTasksTable,
  projectsTable,
  taskCommentsTable,
} from "@/lib/drizzle/schema"
import { getActionT } from "@/lib/i18n-actions"
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
    .enum(["todo", "in_progress", "in_review", "blocked", "done"])
    .optional()
    .default("todo"),
  assigneeId: z.string().nullable().optional(),
})

const ownerStatusSchema = z.enum([
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
])

const collaboratorStatusSchema = z.enum(["todo", "in_progress", "blocked", "in_review"])

export type TaskFormData = z.infer<typeof taskSchema>

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

export async function getProjectTasks(projectId: string) {
  const t = await getActionT("actions.projects")
  try {
    await requirePermission("projects", "view")
  } catch {
    throw new Error(t("forbidden"))
  }

  const session = await auth()
  if (!session?.user) throw new Error(t("unauthorized"))

  const access = await verifyProjectAccess(
    projectId,
    session.user.id,
    session.user.role ?? null
  )
  if (!access.hasAccess) throw new Error(t("notFound"))

  return db
    .select({
      id: projectTasksTable.id,
      projectId: projectTasksTable.projectId,
      name: projectTasksTable.name,
      description: projectTasksTable.description,
      cost: projectTasksTable.cost,
      status: projectTasksTable.status,
      assigneeId: projectTasksTable.assigneeId,
      createdAt: projectTasksTable.createdAt,
      updatedAt: projectTasksTable.updatedAt,
      commentCount: sql<number>`coalesce((
        select count(*)::int from ${taskCommentsTable}
        where ${taskCommentsTable.taskId} = ${projectTasksTable.id}
      ), 0)`,
    })
    .from(projectTasksTable)
    .where(eq(projectTasksTable.projectId, projectId))
    .orderBy(desc(projectTasksTable.createdAt))
}

export async function upsertTask(
  data: TaskFormData,
  projectId: string,
  taskId?: string
) {
  const t = await getActionT("actions.projects")

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  const access = await verifyProjectAccess(
    projectId,
    session.user.id,
    session.user.role ?? null
  )
  if (!access.hasAccess)
    return { success: false as const, error: t("notFound") }

  if (!access.isOwner) {
    return { success: false as const, error: t("forbidden") }
  }

  try {
    await requirePermission("projects", "edit")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  const parsed = taskSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false as const,
      error: t("validationFailed"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const { name, description, cost, status, assigneeId } = parsed.data

  if (taskId) {
    await db
      .update(projectTasksTable)
      .set({
        name,
        description: description || null,
        cost: cost || null,
        status,
        assigneeId: assigneeId ?? null,
      })
      .where(
        and(
          eq(projectTasksTable.id, taskId),
          eq(projectTasksTable.projectId, projectId)
        )
      )
  } else {
    await db.insert(projectTasksTable).values({
      projectId,
      name,
      description: description || null,
      cost: cost || null,
      status,
      assigneeId: assigneeId ?? null,
    })
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true as const }
}

export async function updateTaskStatus(
  taskId: string,
  projectId: string,
  status: string
) {
  const t = await getActionT("actions.projects")

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  const access = await verifyProjectAccess(
    projectId,
    session.user.id,
    session.user.role ?? null
  )
  if (!access.hasAccess)
    return { success: false as const, error: t("notFound") }

  if (access.isOwner) {
    const parsed = ownerStatusSchema.safeParse(status)
    if (!parsed.success) {
      return { success: false as const, error: t("validationFailed") }
    }
    await db
      .update(projectTasksTable)
      .set({ status: parsed.data })
      .where(
        and(
          eq(projectTasksTable.id, taskId),
          eq(projectTasksTable.projectId, projectId)
        )
      )
  } else {
    const currentTask = await db
      .select({ status: projectTasksTable.status })
      .from(projectTasksTable)
      .where(
        and(
          eq(projectTasksTable.id, taskId),
          eq(projectTasksTable.projectId, projectId)
        )
      )
      .then((rows) => rows[0])

    if (!currentTask) {
      return { success: false as const, error: t("notFound") }
    }

    if (currentTask.status === "done") {
      return { success: false as const, error: t("forbidden") }
    }

    const parsed = collaboratorStatusSchema.safeParse(status)
    if (!parsed.success) {
      return { success: false as const, error: t("validationFailed") }
    }
    await db
      .update(projectTasksTable)
      .set({ status: parsed.data })
      .where(
        and(
          eq(projectTasksTable.id, taskId),
          eq(projectTasksTable.projectId, projectId)
        )
      )
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true as const }
}

export async function deleteTask(taskId: string, projectId: string) {
  const t = await getActionT("actions.projects")

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  const access = await verifyProjectAccess(
    projectId,
    session.user.id,
    session.user.role ?? null
  )
  if (!access.hasAccess)
    return { success: false as const, error: t("notFound") }

  if (!access.isOwner) {
    return { success: false as const, error: t("forbidden") }
  }

  try {
    await requirePermission("projects", "delete")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  await db
    .delete(projectTasksTable)
    .where(
      and(
        eq(projectTasksTable.id, taskId),
        eq(projectTasksTable.projectId, projectId)
      )
    )

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true as const }
}

export type MyTask = Awaited<ReturnType<typeof getMyTasks>>[number]

export async function getMyTasks(
  statusFilter?: string,
  projectIdFilter?: string
) {
  const t = await getActionT("actions.projects")

  try {
    await requirePermission("projects", "view")
  } catch {
    throw new Error(t("forbidden"))
  }

  const session = await auth()
  if (!session?.user) throw new Error(t("unauthorized"))

  const isSuper = isSuperUser(session)

  const conditions = []
  if (!isSuper) {
    conditions.push(eq(projectTasksTable.assigneeId, session.user.id))
  }
  if (statusFilter) {
    const validStatuses = ["todo", "in_progress", "in_review", "blocked", "done"] as const
    if (validStatuses.includes(statusFilter as typeof validStatuses[number])) {
      conditions.push(eq(projectTasksTable.status, statusFilter as typeof validStatuses[number]))
    }
  }
  if (projectIdFilter) {
    conditions.push(eq(projectTasksTable.projectId, projectIdFilter))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  return db
    .select({
      id: projectTasksTable.id,
      projectId: projectTasksTable.projectId,
      projectName: projectsTable.name,
      name: projectTasksTable.name,
      description: projectTasksTable.description,
      cost: projectTasksTable.cost,
      status: projectTasksTable.status,
      assigneeId: projectTasksTable.assigneeId,
      isOwner: sql<boolean>`coalesce((
        select true from ${projectOwnersTable}
        where ${projectOwnersTable.projectId} = ${projectTasksTable.projectId}
        and ${projectOwnersTable.userId} = ${session.user.id}
        limit 1
      ), false)`,
      commentCount: sql<number>`coalesce((
        select count(*)::int from ${taskCommentsTable}
        where ${taskCommentsTable.taskId} = ${projectTasksTable.id}
      ), 0)`,
      createdAt: projectTasksTable.createdAt,
      updatedAt: projectTasksTable.updatedAt,
    })
    .from(projectTasksTable)
    .innerJoin(
      projectsTable,
      eq(projectTasksTable.projectId, projectsTable.id)
    )
    .where(where)
    .orderBy(desc(projectTasksTable.createdAt))
}
