import { db } from "@/lib/drizzle/client"
import {
  projectMembershipTable,
  projectsTable,
  taskAssignmentDetailView,
  taskAssignmentsTable,
  taskCommentsTable,
  tasksTable,
  usersTable,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/drizzle/schema"
import { isTerminalStatus } from "@/lib/util/project-roles"
import {
  firstAssignmentWindow,
  sortAssignments,
  toTaskAssignmentDTO,
} from "@/lib/tasks/assignments"
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  notInArray,
  sql,
} from "drizzle-orm"
import {
  MyAssignmentSchema,
  type CreateTaskDTO,
  type MyAssignmentDTO,
  type MyTasksTab,
  type TaskAssignmentDTO,
  type TaskRecordDTO,
  type TaskWithAssignmentsDTO,
  type UpdateTaskDTO,
} from "./schemas"

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

// ---------- Leaf queries ----------

async function getTaskRowsByProject(projectId: string) {
  return db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.projectId, projectId))
    .orderBy(desc(tasksTable.createdAt))
}

async function getTaskRow(taskId: string) {
  return db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, taskId))
    .then((rows) => rows[0])
}

async function getAssignmentRowsByTaskIds(taskIds: string[]) {
  return db
    .select(ASSIGNMENT_VIEW_COLUMNS)
    .from(taskAssignmentDetailView)
    .where(inArray(taskAssignmentDetailView.taskId, taskIds))
}

async function getAssignmentRowsByTaskId(taskId: string) {
  return db
    .select(ASSIGNMENT_VIEW_COLUMNS)
    .from(taskAssignmentDetailView)
    .where(eq(taskAssignmentDetailView.taskId, taskId))
}

async function getAssignmentViewById(assignmentId: string) {
  return db
    .select(ASSIGNMENT_VIEW_COLUMNS)
    .from(taskAssignmentDetailView)
    .where(eq(taskAssignmentDetailView.assignmentId, assignmentId))
    .then((rows) => rows[0])
}

async function getCommentCountsByTaskIds(taskIds: string[]) {
  return db
    .select({
      taskId: taskCommentsTable.taskId,
      cnt: sql<number>`count(*)::int`,
    })
    .from(taskCommentsTable)
    .where(inArray(taskCommentsTable.taskId, taskIds))
    .groupBy(taskCommentsTable.taskId)
}

async function getProjectPrimaryOwnerId(
  projectId: string
): Promise<string | null> {
  const project = await db
    .select({ primaryOwnerId: projectsTable.primaryOwnerId })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .then((rows) => rows[0])

  return project?.primaryOwnerId ?? null
}

async function getProjectMemberIds(
  projectId: string
): Promise<string[]> {
  const members = await db
    .select({ userId: projectMembershipTable.userId })
    .from(projectMembershipTable)
    .where(eq(projectMembershipTable.projectId, projectId))

  return members.map((m) => m.userId)
}

async function getOpenAssignments(taskId: string) {
  return db
    .select({
      id: taskAssignmentsTable.id,
      userId: taskAssignmentsTable.userId,
    })
    .from(taskAssignmentsTable)
    .where(
      and(
        eq(taskAssignmentsTable.taskId, taskId),
        notInArray(taskAssignmentsTable.status, ["done", "cancelled"])
      )
    )
}

type AssignmentStatusRow = {
  id: string
  userId: string
  status: TaskStatus
  endDate: Date | null
  taskId: string
  taskEndDate: Date | null
  recurrence: "daily" | "weekly" | null
  interval: number
  daysOfWeek: string[] | null
  startTime: string | null
  endTime: string | null
}

async function getAssignmentForRow(
  assignmentId: string,
  projectId: string
): Promise<AssignmentStatusRow | undefined> {
  return db
    .select({
      id: taskAssignmentsTable.id,
      userId: taskAssignmentsTable.userId,
      status: taskAssignmentsTable.status,
      endDate: taskAssignmentsTable.endDate,
      taskId: tasksTable.id,
      taskEndDate: tasksTable.endDate,
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
}

async function getAssignmentForComment(
  assignmentId: string,
  projectId: string
) {
  return db
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
}

/**
 * Drizzle emits the detail view's columns unqualified, so the view query
 * runs on its own: joining `project` (status, start_date...) or
 * `project_membership` (user_id...) here would make the statement
 * ambiguous. Projects and comment counts come back as keyed lookups.
 */
async function getMyAssignmentRows(userId: string, view: MyTasksTab) {
  return db
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
}

async function getProjectsForMyAssignments(
  projectIds: string[],
  userId: string
) {
  return db
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
    .where(inArray(projectsTable.id, projectIds))
}

// ---------- Composed queries ----------

async function getTasksWithAssignments(
  projectId: string
): Promise<TaskWithAssignmentsDTO[]> {
  const taskRows = await getTaskRowsByProject(projectId)

  const ids = taskRows.map((t) => t.id)
  if (ids.length === 0) return []

  const [assignmentRows, commentRows] = await Promise.all([
    getAssignmentRowsByTaskIds(ids),
    getCommentCountsByTaskIds(ids),
  ])

  const assignmentsByTask = new Map<string, TaskAssignmentDTO[]>()
  for (const row of assignmentRows) {
    const list = assignmentsByTask.get(row.taskId) ?? []
    list.push(toTaskAssignmentDTO(row))
    assignmentsByTask.set(row.taskId, list)
  }

  const counts = new Map(commentRows.map((r) => [r.taskId, r.cnt]))

  return taskRows.map((row) => ({
    ...toTaskRecord(row),
    assignments: sortAssignments(assignmentsByTask.get(row.id) ?? []),
    commentCount: counts.get(row.id) ?? 0,
  }))
}

async function getTaskWithAssignments(taskId: string): Promise<{
  record: TaskRecordDTO
  assignments: TaskAssignmentDTO[]
} | null> {
  const row = await getTaskRow(taskId)
  if (!row) return null

  const assignmentRows = await getAssignmentRowsByTaskId(taskId)

  return {
    record: toTaskRecord(row),
    assignments: sortAssignments(
      assignmentRows.map(toTaskAssignmentDTO)
    ),
  }
}

async function getMyTasks(
  userId: string,
  view: MyTasksTab
): Promise<MyAssignmentDTO[]> {
  const viewRows = await getMyAssignmentRows(userId, view)

  if (viewRows.length === 0) return []

  const projectIds = [...new Set(viewRows.map((row) => row.projectId))]
  const taskIds = [...new Set(viewRows.map((row) => row.taskId))]

  const [projectRows, countRows] = await Promise.all([
    getProjectsForMyAssignments(projectIds, userId),
    getCommentCountsByTaskIds(taskIds),
  ])

  const projectsById = new Map(projectRows.map((row) => [row.id, row]))
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
      : (project?.memberRole ?? ("collaborator" as const))
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
}

// ---------- Writes ----------

async function createTask(
  values: CreateTaskDTO,
  assigneeIds: string[]
): Promise<typeof tasksTable.$inferSelect> {
  const {
    projectId,
    name,
    description,
    priority,
    startDate,
    endDate,
    recurrence,
    interval,
    daysOfWeek,
    startTime,
    endTime,
  } = values

  let created!: typeof tasksTable.$inferSelect
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(tasksTable)
      .values({
        projectId,
        name,
        description: description || null,
        priority: priority ?? null,
        startDate: startDate
          ? new Date(startDate)
          : recurrence
            ? new Date()
            : null,
        endDate: endDate ? new Date(endDate) : null,
        recurrence: recurrence ?? null,
        interval,
        daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : null,
        startTime: startTime || null,
        endTime: endTime || null,
      })
      .returning()

    created = row

    if (assigneeIds.length > 0) {
      const window = firstAssignmentWindow(row)
      await tx.insert(taskAssignmentsTable).values(
        assigneeIds.map((userId) => ({
          taskId: row.id,
          userId,
          status: "todo" as const,
          startDate: window.startDate,
          endDate: window.endDate,
        }))
      )
    }
  })

  return created
}

async function updateTaskRow(
  values: UpdateTaskDTO
): Promise<typeof tasksTable.$inferSelect | undefined> {
  const {
    projectId,
    taskId,
    name,
    description,
    priority,
    startDate,
    endDate,
    recurrence,
    interval,
    daysOfWeek,
    startTime,
    endTime,
  } = values

  const [row] = await db
    .update(tasksTable)
    .set({
      name,
      description: description || null,
      priority: priority ?? null,
      startDate: startDate
        ? new Date(startDate)
        : recurrence
          ? new Date()
          : null,
      endDate: endDate ? new Date(endDate) : null,
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

  return row
}

async function syncTaskAssignments(
  taskId: string,
  assigneeIds: string[],
  taskRow: typeof tasksTable.$inferSelect
): Promise<void> {
  const openAssignments = await getOpenAssignments(taskId)

  const openUserIds = new Set(openAssignments.map((a) => a.userId))
  const toAdd = assigneeIds.filter((id) => !openUserIds.has(id))
  const toRemove = openAssignments
    .filter((a) => !assigneeIds.includes(a.userId))
    .map((a) => a.id)

  await db.transaction(async (tx) => {
    if (toRemove.length > 0) {
      await tx
        .delete(taskAssignmentsTable)
        .where(inArray(taskAssignmentsTable.id, toRemove))
    }
    if (toAdd.length > 0) {
      const window = firstAssignmentWindow(taskRow)
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
}

type AssignmentSpawn = {
  taskId: string
  userId: string
  startDate: Date
  endDate: Date
}

async function updateAssignmentStatus(
  assignmentId: string,
  status: TaskStatus,
  spawn: AssignmentSpawn | null
): Promise<string | null> {
  let spawnedId: string | null = null

  await db.transaction(async (tx) => {
    await tx
      .update(taskAssignmentsTable)
      .set({ status })
      .where(eq(taskAssignmentsTable.id, assignmentId))

    if (spawn) {
      const [inserted] = await tx
        .insert(taskAssignmentsTable)
        .values({
          taskId: spawn.taskId,
          userId: spawn.userId,
          status: "todo",
          startDate: spawn.startDate,
          endDate: spawn.endDate,
        })
        .returning()
      spawnedId = inserted.id
    }
  })

  return spawnedId
}

async function updateAssignmentComment(
  assignmentId: string,
  comment: string | null
): Promise<void> {
  await db
    .update(taskAssignmentsTable)
    .set({ comment })
    .where(eq(taskAssignmentsTable.id, assignmentId))
}

async function updateTaskPriority(
  taskId: string,
  projectId: string,
  priority: TaskPriority | null
): Promise<void> {
  await db
    .update(tasksTable)
    .set({ priority })
    .where(
      and(
        eq(tasksTable.id, taskId),
        eq(tasksTable.projectId, projectId)
      )
    )
}

async function deleteTask(
  taskId: string,
  projectId: string
): Promise<void> {
  await db
    .delete(tasksTable)
    .where(
      and(
        eq(tasksTable.id, taskId),
        eq(tasksTable.projectId, projectId)
      )
    )
}

const queries = {
  getProjectPrimaryOwnerId,
  getProjectMemberIds,
  getAssignmentViewById,
  getAssignmentForRow,
  getAssignmentForComment,
  getTasksWithAssignments,
  getTaskWithAssignments,
  getMyTasks,
  createTask,
  updateTaskRow,
  syncTaskAssignments,
  updateAssignmentStatus,
  updateAssignmentComment,
  updateTaskPriority,
  deleteTask,
}

export default queries
