"use server"

import {
  CalendarAssignmentSchema,
  type CalendarAssignmentDTO,
} from "@/actions/legacy/schemas/calendar"
import { runAction, throwActionError } from "@/lib/action-result"
import { auth } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import {
  projectMembershipTable,
  projectsTable,
  taskAssignmentDetailView,
  taskCommentsTable,
  usersTable,
} from "@/lib/drizzle/schema"
import { parseISODate, startOfDay } from "@/lib/util/schedule"
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm"

const RANGE_DAYS = 90

function parseRangeDate(value?: string): Date | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = parseISODate(value)
  if (Number.isNaN(date.getTime())) return null
  return startOfDay(date)
}

export async function getCalendarAssignments(range?: {
  from?: string
  to?: string
}): Promise<ReturnType<typeof runAction<CalendarAssignmentDTO[]>>> {
  return runAction<CalendarAssignmentDTO[]>(async () => {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) throwActionError("UNAUTHORIZED")

    const from =
      parseRangeDate(range?.from) ??
      (() => {
        const date = startOfDay(new Date())
        date.setDate(date.getDate() - RANGE_DAYS)
        return date
      })()
    const to =
      parseRangeDate(range?.to) ??
      (() => {
        const date = startOfDay(new Date())
        date.setDate(date.getDate() + RANGE_DAYS)
        date.setHours(23, 59, 59, 999)
        return date
      })()

    /**
     * Drizzle emits the detail view's columns unqualified, so the view query
     * stands alone — joining `project` or `project_membership` (shared column
     * names) here would make the statement ambiguous. Visibility against the
     * project comes from a keyed lookup instead.
     */
    const viewRows = await db
      .select({
        assignmentId: taskAssignmentDetailView.assignmentId,
        taskId: taskAssignmentDetailView.taskId,
        taskName: taskAssignmentDetailView.taskName,
        status: taskAssignmentDetailView.status,
        priority: taskAssignmentDetailView.taskPriority,
        startDate: taskAssignmentDetailView.startDate,
        endDate: taskAssignmentDetailView.endDate,
        projectId: taskAssignmentDetailView.projectId,
        userId: taskAssignmentDetailView.userId,
        comment: taskAssignmentDetailView.comment,
        userName: taskAssignmentDetailView.userName,
        userImage: taskAssignmentDetailView.userImage,
        recurrence: taskAssignmentDetailView.taskRecurrence,
      })
      .from(taskAssignmentDetailView)
      .where(
        and(
          isNotNull(taskAssignmentDetailView.startDate),
          // The view's date columns carry no type for drizzle, so a Date
          // parameter cannot be serialized against them: the bounds cross as
          // ISO strings, which Postgres compares as timestamps.
          sql`${taskAssignmentDetailView.startDate} >= ${from.toISOString()}`,
          sql`${taskAssignmentDetailView.startDate} <= ${to.toISOString()}`
        )
      )
      .orderBy(asc(taskAssignmentDetailView.startDate))

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

    const visible = viewRows.filter((row) => {
      const project = projectsById.get(row.projectId)
      return (
        row.userId === userId ||
        project?.primaryOwnerId === userId ||
        project?.memberRole === "admin"
      )
    })

    return visible.map((row) => {
      const project = projectsById.get(row.projectId)
      return CalendarAssignmentSchema.parse({
        ...row,
        projectName: project?.projectName ?? "",
        projectColor: project?.projectColor ?? "",
        projectOwnerName: project?.projectOwnerName ?? null,
        commentCount: countsByTask.get(row.taskId) ?? 0,
      })
    })
  })
}
