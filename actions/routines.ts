"use server"

import { verifyProjectAccess } from "@/actions/project-access"
import { db } from "@/lib/drizzle/client"
import {
  routinesTable,
  tasksTable,
  usersTable,
} from "@/lib/drizzle/schema"
import {
  createRoutineSchema,
  deleteRoutineSchema,
  spawnRoutineTaskSchema,
  updateRoutineSchema,
  type RoutineFormData,
} from "@/lib/schemas/routine"
import {
  projectScopedAction,
  returnActionError,
  sessionAction,
} from "@/lib/safe-action"
import {
  computeScheduledFor,
  parseISODate,
  startOfDay,
  type ScheduleConfig,
} from "@/lib/util/schedule"
import { and, desc, eq, notInArray, sql } from "drizzle-orm"
import { returnServerError } from "next-safe-action"
import { z } from "zod"

// ---------- Query actions ----------

export const getProjectRoutines = projectScopedAction(
  z.object({ projectId: z.uuid() })
)
  .metadata({ permission: { module: "projects", action: "view" } })
  .action(async ({ parsedInput }) => {
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
      .where(eq(routinesTable.projectId, parsedInput.projectId))
      .orderBy(desc(routinesTable.createdAt))
  })

// ---------- Mutation actions ----------

/** Create/edit/delete are owner-only: `projectScopedAction` guarantees
 * membership, not ownership. */
function requireProjectOwner(ctx: { isProjectOwner: boolean }): void {
  if (!ctx.isProjectOwner) {
    returnActionError("FORBIDDEN")
  }
}

/** Validated form fields onto routine columns, shared by create and update:
 * empty strings collapse to NULL. */
function routineValues(data: RoutineFormData) {
  return {
    name: data.name,
    description: data.description || null,
    cost: data.cost || null,
    recurrence: data.recurrence,
    interval: data.interval,
    daysOfWeek: data.daysOfWeek.length > 0 ? data.daysOfWeek : null,
    time: data.time || null,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    assigneeId: data.assigneeId ?? null,
  }
}

const ROUTINE_EDIT_METADATA = {
  permission: { module: "projects", action: "edit" },
  revalidate: ["/app/proyectos/:projectId"],
}

export const createRoutine = projectScopedAction(createRoutineSchema)
  .metadata(ROUTINE_EDIT_METADATA)
  .action(async ({ parsedInput, ctx }) => {
    requireProjectOwner(ctx)

    const { projectId, ...fields } = parsedInput

    const [routine] = await db
      .insert(routinesTable)
      .values({ projectId, ...routineValues(fields) })
      .returning()

    if (!routine) {
      returnActionError("NOT_FOUND")
    }

    const spawned = await createNextRoutineTask({
      routineId: routine.id,
    })
    if (spawned.serverError) {
      returnServerError(spawned.serverError)
    }

    return routine
  })

export const updateRoutine = projectScopedAction(updateRoutineSchema)
  .metadata(ROUTINE_EDIT_METADATA)
  .action(async ({ parsedInput, ctx }) => {
    requireProjectOwner(ctx)

    const { projectId, routineId, ...fields } = parsedInput

    const [routine] = await db
      .update(routinesTable)
      .set(routineValues(fields))
      .where(
        and(
          eq(routinesTable.id, routineId),
          eq(routinesTable.projectId, projectId)
        )
      )
      .returning()

    if (!routine) {
      returnActionError("NOT_FOUND")
    }

    return routine
  })

export const deleteRoutine = projectScopedAction(deleteRoutineSchema)
  .metadata({
    permission: { module: "projects", action: "delete" },
    revalidate: ["/app/proyectos/:projectId"],
  })
  .action(async ({ parsedInput, ctx }) => {
    requireProjectOwner(ctx)

    const { projectId, routineId } = parsedInput

    // No existence check: a routine deleted from another tab must still
    // settle as success so the optimistic row can be dropped.
    await db
      .delete(routinesTable)
      .where(
        and(
          eq(routinesTable.id, routineId),
          eq(routinesTable.projectId, projectId)
        )
      )
  })

// ---------- Routine spawning ----------

/**
 * Spawns the next open instance of a routine. Called server-to-server from
 * `createRoutine` and from `updateTaskStatus` (both already revalidate the
 * project page, so this action declares no `revalidate` metadata). The
 * routine's project — not a caller-supplied one — decides access, and only
 * owners may spawn.
 */
export const createNextRoutineTask = sessionAction
  .metadata({})
  .inputSchema(spawnRoutineTaskSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { routineId, after } = parsedInput

    const routine = await db
      .select()
      .from(routinesTable)
      .where(eq(routinesTable.id, routineId))
      .then((rows) => rows[0])

    if (!routine) {
      returnActionError("NOT_FOUND")
    }

    const access = await verifyProjectAccess(
      routine.projectId,
      ctx.session.user.id,
      ctx.session.user.role ?? null
    )
    if (!access.hasAccess || !access.isOwner) {
      returnActionError("FORBIDDEN")
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

    if (openInstance) {
      return { spawned: false as const }
    }

    const schedule: ScheduleConfig = {
      recurrence: routine.recurrence,
      interval: routine.interval,
      daysOfWeek: routine.daysOfWeek ?? [],
      time: routine.time,
    }
    const startDate = routine.startDate
      ? parseISODate(routine.startDate)
      : null
    const endDate = routine.endDate
      ? parseISODate(routine.endDate)
      : null

    let anchor = after ?? new Date()
    if (startDate && anchor < startDate) {
      anchor = new Date(startDate.getTime() - 1)
    }
    const dueDate = computeScheduledFor(anchor, schedule)

    if (dueDate && endDate && startOfDay(dueDate) > endDate) {
      return { spawned: false as const }
    }

    const [task] = await db
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

    if (!task) {
      returnActionError("NOT_FOUND")
    }

    return { spawned: true as const, task }
  })
