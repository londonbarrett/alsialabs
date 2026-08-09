"use server"

import { verifyProjectAccess } from "@/lib/actions/project-access"
import { auth, requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import {
  routinesTable,
  tasksTable,
  usersTable,
} from "@/lib/drizzle/schema"
import { getActionT } from "@/lib/util/i18n-actions"
import {
  computeScheduledFor,
  parseISODate,
  startOfDay,
  type ScheduleConfig,
} from "@/lib/util/schedule"
import { and, desc, eq, notInArray, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const routineFields = z.object({
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
  recurrence: z.enum(["daily", "weekly"]).default("weekly"),
  interval: z.coerce.number().int().min(1).max(365).default(1),
  daysOfWeek: z.array(z.string()).optional().default([]),
  time: z.string().optional().default(""),
  startDate: z.string().optional().default(""),
  endDate: z.string().optional().default(""),
  assigneeId: z.string().nullable().optional(),
})

const endAfterStartRefine = (data: z.infer<typeof routineFields>) =>
  !data.startDate || !data.endDate || data.endDate >= data.startDate

const startNotPastRefine = (data: z.infer<typeof routineFields>) =>
  !data.startDate ||
  parseISODate(data.startDate).getTime() >=
    startOfDay(new Date()).getTime()

const endFutureRefine = (data: z.infer<typeof routineFields>) =>
  !data.endDate ||
  parseISODate(data.endDate).getTime() >
    startOfDay(new Date()).getTime()

const routineSchema = routineFields
  .refine(endAfterStartRefine, {
    message: "End date must be after start date",
    path: ["endDate"],
  })
  .refine(startNotPastRefine, {
    message: "Start date cannot be in the past",
    path: ["startDate"],
  })
  .refine(endFutureRefine, {
    message: "End date must be in the future",
    path: ["endDate"],
  })

const updateRoutineSchema = routineFields.refine(endAfterStartRefine, {
  message: "End date must be after start date",
  path: ["endDate"],
})

export type RoutineFormData = z.infer<typeof routineSchema>

export async function getProjectRoutines(projectId: string) {
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
      id: routinesTable.id,
      projectId: routinesTable.projectId,
      name: routinesTable.name,
      description: routinesTable.description,
      cost: routinesTable.cost,
      recurrence: routinesTable.recurrence,
      interval: routinesTable.interval,
      daysOfWeek: routinesTable.daysOfWeek,
      time: routinesTable.time,
      startDate: routinesTable.startDate,
      endDate: routinesTable.endDate,
      assigneeId: routinesTable.assigneeId,
      assigneeName: sql<string>`coalesce(${usersTable.name}, ${usersTable.email})`,
      createdAt: routinesTable.createdAt,
      updatedAt: routinesTable.updatedAt,
    })
    .from(routinesTable)
    .leftJoin(usersTable, eq(routinesTable.assigneeId, usersTable.id))
    .where(eq(routinesTable.projectId, projectId))
    .orderBy(desc(routinesTable.createdAt))
}

export async function createRoutine(
  data: RoutineFormData,
  projectId: string
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

  const parsed = routineSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false as const,
      error: t("validationFailed"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const {
    name,
    description,
    cost,
    recurrence,
    interval,
    daysOfWeek,
    time,
    startDate,
    endDate,
    assigneeId,
  } = parsed.data

  const rows = await db
    .insert(routinesTable)
    .values({
      projectId,
      name,
      description: description || null,
      cost: cost || null,
      recurrence,
      interval,
      daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : null,
      time: time || null,
      startDate: startDate || null,
      endDate: endDate || null,
      assigneeId: assigneeId ?? null,
    })
    .returning()
  const routine = rows[0]

  const spawned = await createNextRoutineTask(routine.id)

  revalidatePath(`/dashboard/projects/${projectId}`)
  return {
    success: true as const,
    data: routine,
    task: spawned.success && spawned.spawned ? spawned.task : null,
  }
}

export async function updateRoutine(
  data: RoutineFormData,
  routineId: string,
  projectId: string
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

  const parsed = updateRoutineSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false as const,
      error: t("validationFailed"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const {
    name,
    description,
    cost,
    recurrence,
    interval,
    daysOfWeek,
    time,
    startDate,
    endDate,
    assigneeId,
  } = parsed.data

  const rows = await db
    .update(routinesTable)
    .set({
      name,
      description: description || null,
      cost: cost || null,
      recurrence,
      interval,
      daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : null,
      time: time || null,
      startDate: startDate || null,
      endDate: endDate || null,
      assigneeId: assigneeId ?? null,
    })
    .where(
      and(
        eq(routinesTable.id, routineId),
        eq(routinesTable.projectId, projectId)
      )
    )
    .returning()
  const routine = rows[0]

  if (!routine) {
    return { success: false as const, error: t("notFound") }
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true as const, data: routine }
}

export async function deleteRoutine(
  routineId: string,
  projectId: string
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
    await requirePermission("projects", "delete")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  await db
    .delete(routinesTable)
    .where(
      and(
        eq(routinesTable.id, routineId),
        eq(routinesTable.projectId, projectId)
      )
    )

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true as const }
}

export async function createNextRoutineTask(
  routineId: string,
  after?: Date | null
) {
  const t = await getActionT("actions.projects")

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  const routine = await db
    .select()
    .from(routinesTable)
    .where(eq(routinesTable.id, routineId))
    .then((rows) => rows[0])

  if (!routine) return { success: false as const, error: t("notFound") }

  const access = await verifyProjectAccess(
    routine.projectId,
    session.user.id,
    session.user.role ?? null
  )
  if (!access.hasAccess || !access.isOwner) {
    return { success: false as const, error: t("forbidden") }
  }

  const openInstance = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.routineId, routineId),
        notInArray(tasksTable.status, ["done", "cancelled"])
      )
    )
    .limit(1)
    .then((rows) => rows[0])

  if (openInstance) return { success: true as const, spawned: false }

  const schedule: ScheduleConfig = {
    recurrence: routine.recurrence,
    interval: routine.interval,
    daysOfWeek: routine.daysOfWeek ?? [],
    time: routine.time,
  }
  const startDate = routine.startDate
    ? parseISODate(routine.startDate)
    : null
  const endDate = routine.endDate ? parseISODate(routine.endDate) : null

  let anchor = after ?? new Date()
  if (startDate && anchor < startDate) {
    anchor = new Date(startDate.getTime() - 1)
  }
  const dueDate = computeScheduledFor(anchor, schedule)

  if (dueDate && endDate && startOfDay(dueDate) > endDate) {
    return { success: true as const, spawned: false }
  }

  const rows = await db
    .insert(tasksTable)
    .values({
      projectId: routine.projectId,
      routineId: routine.id,
      name: routine.name,
      description: routine.description,
      cost: routine.cost,
      status: "todo",
      priority: null,
      dueDate,
      assigneeId: routine.assigneeId,
    })
    .returning()
  const task = rows[0]

  revalidatePath(`/dashboard/projects/${routine.projectId}`)
  return { success: true as const, spawned: true, task }
}
