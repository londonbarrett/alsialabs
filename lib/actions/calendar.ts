"use server"

import { auth, isSuperUser, requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import {
  projectOwnersTable,
  projectsTable,
  routinesTable,
  taskCommentsTable,
  tasksTable,
  usersTable,
} from "@/lib/drizzle/schema"
import type { CalendarRoutineData, CalendarTaskData } from "@/lib/types"
import { getActionT } from "@/lib/util/i18n-actions"
import { endOfDay, parseISODate, startOfDay } from "@/lib/util/schedule"
import { and, eq, exists, or, sql } from "drizzle-orm"

const RANGE_DAYS = 90
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function parseRangeDate(value: string | undefined): Date | null {
  if (!value || !ISO_DATE_PATTERN.test(value)) return null
  return parseISODate(value)
}

/**
 * Returns the tasks with a due date inside the requested range. Raw rows
 * only; event building happens on the client.
 */
export async function getCalendarTasks(range?: {
  from?: string
  to?: string
}): Promise<CalendarTaskData[]> {
  const t = await getActionT("actions.projects")

  try {
    await requirePermission("projects", "view")
  } catch {
    throw new Error(t("forbidden"))
  }

  const session = await auth()
  if (!session?.user) throw new Error(t("unauthorized"))

  const defaultFrom = startOfDay(new Date())
  defaultFrom.setDate(defaultFrom.getDate() - RANGE_DAYS)
  const defaultTo = endOfDay(new Date())
  defaultTo.setDate(defaultTo.getDate() + RANGE_DAYS)

  const from = parseRangeDate(range?.from) ?? defaultFrom
  const parsedTo = parseRangeDate(range?.to)
  const to = parsedTo ? endOfDay(parsedTo) : defaultTo

  const tasks = await getVisibleTasks(session.user.id)
  return tasks.filter((task) => {
    if (!task.dueDate) return false
    const time = task.dueDate.getTime()
    return time >= from.getTime() && time <= to.getTime()
  })
}

/**
 * Tasks assigned to the user or belonging to projects they own
 * (co-owners included); superusers see everything.
 */
async function getVisibleTasks(userId: string) {
  const session = await auth()
  if (!session?.user) return []
  const isSuper = isSuperUser(session)

  const conditions = []
  if (!isSuper) {
    conditions.push(
      or(
        eq(tasksTable.assigneeId, userId),
        exists(
          db
            .select({ one: sql`1` })
            .from(projectOwnersTable)
            .where(
              and(
                eq(projectOwnersTable.projectId, tasksTable.projectId),
                eq(projectOwnersTable.userId, userId)
              )
            )
        )
      )
    )
  }

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
      name: tasksTable.name,
      projectId: tasksTable.projectId,
      projectName: projectsTable.name,
      projectOwnerName: sql<
        string | null
      >`coalesce(${ownerUsers.userName}, ${ownerUsers.userEmail})`,
      description: tasksTable.description,
      cost: tasksTable.cost,
      status: tasksTable.status,
      priority: tasksTable.priority,
      routineId: tasksTable.routineId,
      dueDate: tasksTable.dueDate,
      assigneeName: sql<
        string | null
      >`coalesce(${usersTable.name}, ${usersTable.email})`,
      commentCount: sql<number>`coalesce(${commentCounts.cnt}, 0)`,
    })
    .from(tasksTable)
    .innerJoin(
      projectsTable,
      eq(tasksTable.projectId, projectsTable.id)
    )
    .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
    .leftJoin(commentCounts, eq(tasksTable.id, commentCounts.taskId))
    .leftJoin(
      primaryOwners,
      eq(tasksTable.projectId, primaryOwners.projectId)
    )
    .leftJoin(ownerUsers, eq(primaryOwners.userId, ownerUsers.userId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
}

/**
 * Returns the raw routine rows visible to the current user. Occurrence
 * expansion happens on the client so navigation never hits the server.
 */
export async function getCalendarRoutines(): Promise<
  CalendarRoutineData[]
> {
  const t = await getActionT("actions.projects")

  try {
    await requirePermission("projects", "view")
  } catch {
    throw new Error(t("forbidden"))
  }

  const session = await auth()
  if (!session?.user) throw new Error(t("unauthorized"))

  return getVisibleRoutines(session.user.id)
}

async function getVisibleRoutines(userId: string) {
  const session = await auth()
  if (!session?.user) return []
  const isSuper = isSuperUser(session)

  const conditions = []
  if (!isSuper) {
    conditions.push(
      or(
        eq(routinesTable.assigneeId, userId),
        exists(
          db
            .select({ one: sql`1` })
            .from(projectOwnersTable)
            .where(
              and(
                eq(
                  projectOwnersTable.projectId,
                  routinesTable.projectId
                ),
                eq(projectOwnersTable.userId, userId)
              )
            )
        )
      )
    )
  }

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
      id: routinesTable.id,
      name: routinesTable.name,
      description: routinesTable.description,
      cost: routinesTable.cost,
      projectId: routinesTable.projectId,
      projectName: projectsTable.name,
      projectOwnerName: sql<
        string | null
      >`coalesce(${ownerUsers.userName}, ${ownerUsers.userEmail})`,
      assigneeName: sql<
        string | null
      >`coalesce(${usersTable.name}, ${usersTable.email})`,
      recurrence: routinesTable.recurrence,
      interval: routinesTable.interval,
      daysOfWeek: routinesTable.daysOfWeek,
      time: routinesTable.time,
      startDate: routinesTable.startDate,
      endDate: routinesTable.endDate,
    })
    .from(routinesTable)
    .innerJoin(
      projectsTable,
      eq(routinesTable.projectId, projectsTable.id)
    )
    .leftJoin(usersTable, eq(routinesTable.assigneeId, usersTable.id))
    .leftJoin(
      primaryOwners,
      eq(routinesTable.projectId, primaryOwners.projectId)
    )
    .leftJoin(ownerUsers, eq(primaryOwners.userId, ownerUsers.userId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
}
