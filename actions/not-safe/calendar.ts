"use server"

import {
  CalendarAssignmentSchema,
  type CalendarAssignmentDTO,
} from "@/actions/schemas/calendar"
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
import { and, asc, eq, gte, isNotNull, lte, or, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

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

    const owners = alias(usersTable, "calendar_project_owner")
    const commentCounts = db
      .select({
        taskId: taskCommentsTable.taskId,
        cnt: sql<number>`count(*)::int`.as("cnt"),
      })
      .from(taskCommentsTable)
      .groupBy(taskCommentsTable.taskId)
      .as("calendar_comment_counts")

    const rows = await db
      .select({
        assignmentId: taskAssignmentDetailView.assignmentId,
        taskId: taskAssignmentDetailView.taskId,
        taskName: taskAssignmentDetailView.taskName,
        status: taskAssignmentDetailView.status,
        priority: taskAssignmentDetailView.taskPriority,
        startDate: taskAssignmentDetailView.startDate,
        endDate: taskAssignmentDetailView.endDate,
        projectId: taskAssignmentDetailView.projectId,
        projectName: projectsTable.name,
        projectColor: projectsTable.color,
        projectOwnerName: sql<
          string | null
        >`coalesce(${owners.name}, ${owners.email})`,
        userName: taskAssignmentDetailView.userName,
        userImage: taskAssignmentDetailView.userImage,
        comment: taskAssignmentDetailView.comment,
        commentCount: sql<number>`coalesce(${commentCounts.cnt}, 0)`,
        recurrence: taskAssignmentDetailView.taskRecurrence,
      })
      .from(taskAssignmentDetailView)
      .innerJoin(
        projectsTable,
        eq(taskAssignmentDetailView.projectId, projectsTable.id)
      )
      .leftJoin(owners, eq(projectsTable.primaryOwnerId, owners.id))
      .leftJoin(
        projectMembershipTable,
        and(
          eq(projectMembershipTable.projectId, projectsTable.id),
          eq(projectMembershipTable.userId, userId)
        )
      )
      .leftJoin(
        commentCounts,
        eq(commentCounts.taskId, taskAssignmentDetailView.taskId)
      )
      .where(
        and(
          isNotNull(taskAssignmentDetailView.startDate),
          gte(taskAssignmentDetailView.startDate, from),
          lte(taskAssignmentDetailView.startDate, to),
          or(
            eq(taskAssignmentDetailView.userId, userId),
            eq(projectsTable.primaryOwnerId, userId),
            eq(projectMembershipTable.role, "admin")
          )
        )
      )
      .orderBy(asc(taskAssignmentDetailView.startDate))

    return rows.map((row) => CalendarAssignmentSchema.parse(row))
  })
}
