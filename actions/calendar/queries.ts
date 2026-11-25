import { db } from "@/lib/drizzle/client"
import {
  projectMembershipTable,
  projectsTable,
  taskAssignmentDetailView,
  taskCommentsTable,
  usersTable,
} from "@/lib/drizzle/schema"
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm"
import { zonedDateKey } from "@/lib/time/zone"
import { CalendarAssignmentSchema } from "./schemas"

/**
 * Drizzle emits the detail view's columns unqualified, so the view query
 * stands alone — joining `project` or `project_membership` (shared column
 * names) here would make the statement ambiguous. Visibility against the
 * project comes from a keyed lookup instead.
 */
async function getViewAssignmentRows(from: Date, to: Date) {
  return db
    .select({
      assignmentId: taskAssignmentDetailView.assignmentId,
      taskId: taskAssignmentDetailView.taskId,
      taskName: taskAssignmentDetailView.taskName,
      status: taskAssignmentDetailView.status,
      priority: taskAssignmentDetailView.taskPriority,
      startDate: taskAssignmentDetailView.startDate,
      endDate: taskAssignmentDetailView.endDate,
      startTime: taskAssignmentDetailView.startTime,
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
}

async function getProjectVisibilityRows(
  projectIds: string[],
  userId: string
) {
  return db
    .select({
      id: projectsTable.id,
      projectName: projectsTable.name,
      projectColor: projectsTable.color,
      timeZone: projectsTable.timeZone,
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
    .where(inArray(projectsTable.id, projectIds))
}

async function getCommentCounts(taskIds: string[]) {
  return db
    .select({
      taskId: taskCommentsTable.taskId,
      cnt: sql<number>`count(*)::int`,
    })
    .from(taskCommentsTable)
    .where(inArray(taskCommentsTable.taskId, taskIds))
    .groupBy(taskCommentsTable.taskId)
}

async function getVisibleCalendarAssignments(
  userId: string,
  range: { from: Date; to: Date }
) {
  const viewRows = await getViewAssignmentRows(range.from, range.to)
  if (viewRows.length === 0) return []

  const projectIds = [...new Set(viewRows.map((row) => row.projectId))]
  const taskIds = [...new Set(viewRows.map((row) => row.taskId))]

  const [projectRows, countRows] = await Promise.all([
    getProjectVisibilityRows(projectIds, userId),
    getCommentCounts(taskIds),
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
    // Every visible row has a project; UTC is a safe fallback if a row is
    // orphaned, since the schema requires a valid IANA zone.
    const timeZone = project?.timeZone ?? "UTC"
    // Coerce the view's raw driver strings first: `startDate` must be a real
    // Date before it can be resolved in the project's zone. `dateKey` is a
    // placeholder here — the schema requires it, but it is set below.
    const parsed = CalendarAssignmentSchema.parse({
      ...row,
      projectName: project?.projectName ?? "",
      projectColor: project?.projectColor ?? "",
      projectOwnerName: project?.projectOwnerName ?? null,
      timeZone,
      dateKey: "",
      commentCount: countsByTask.get(row.taskId) ?? 0,
    })
    // The client has no Temporal: resolve the project-zone calendar date
    // here, while the instant is still a server-side Date.
    return {
      ...parsed,
      dateKey: parsed.startDate
        ? zonedDateKey(parsed.startDate, timeZone)
        : "",
    }
  })
}

const queries = { getVisibleCalendarAssignments }

export default queries
