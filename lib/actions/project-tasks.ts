"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/drizzle/client"
import {
  projectTasksTable,
  projectsTable,
  clientsTable,
} from "@/lib/drizzle/schema"
import { eq, and, desc } from "drizzle-orm"
import { requirePermission, auth } from "@/lib/auth"
import { z } from "zod"
import { getActionT } from "@/lib/i18n-actions"

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
})

const statusSchema = z.enum([
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
])

export type TaskFormData = z.infer<typeof taskSchema>

async function getClientScope(
  sessionUserId: string,
  role: string | null
) {
  if (role !== "client") return null
  const client = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(eq(clientsTable.userId, sessionUserId))
    .then((rows) => rows[0])
  return client?.id ?? null
}

async function verifyProjectAccess(
  projectId: string,
  sessionUserId: string,
  role: string | null
) {
  const clientId = await getClientScope(sessionUserId, role)
  const conditions = [eq(projectsTable.id, projectId)]
  if (clientId) {
    conditions.push(eq(projectsTable.clientId, clientId))
  }
  return db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(...conditions))
    .then((rows) => rows[0])
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

  const project = await verifyProjectAccess(
    projectId,
    session.user.id,
    session.user.role ?? null
  )
  if (!project) throw new Error(t("notFound"))

  return db
    .select()
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
  try {
    await requirePermission("projects", taskId ? "edit" : "edit")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  const project = await verifyProjectAccess(
    projectId,
    session.user.id,
    session.user.role ?? null
  )
  if (!project) return { success: false as const, error: t("notFound") }

  const parsed = taskSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false as const,
      error: t("validationFailed"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const { name, description, cost, status } = parsed.data

  if (taskId) {
    await db
      .update(projectTasksTable)
      .set({
        name,
        description: description || null,
        cost: cost || null,
        status,
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
  try {
    await requirePermission("projects", "edit")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  const project = await verifyProjectAccess(
    projectId,
    session.user.id,
    session.user.role ?? null
  )
  if (!project) return { success: false as const, error: t("notFound") }

  const parsed = statusSchema.safeParse(status)
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

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true as const }
}

export async function deleteTask(taskId: string, projectId: string) {
  const t = await getActionT("actions.projects")
  try {
    await requirePermission("projects", "delete")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  const project = await verifyProjectAccess(
    projectId,
    session.user.id,
    session.user.role ?? null
  )
  if (!project) return { success: false as const, error: t("notFound") }

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
