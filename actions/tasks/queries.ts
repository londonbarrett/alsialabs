import { db } from "@/lib/drizzle/client"
import {
  projectMembershipTable,
  projectsTable,
  taskAssignmentDetailView,
  taskAssignmentLatestView,
  taskAssignmentsTable,
  taskAssigneesTable,
  taskCommentsTable,
  tasksTable,
  usersTable,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/drizzle/schema"
import { isTerminalStatus } from "@/lib/util/project-roles"
import { computeNextOccurrence } from "@/lib/tasks/recurrence"
import {
  atTime,
  firstAssignmentWindow,
  sortAssignments,
  toTaskAssignmentDTO,
} from "@/lib/tasks/assignments"
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gt,
  inArray,
  isNotNull,
  notInArray,
  or,
  sql,
} from "drizzle-orm"
import {
  MyAssignmentSchema,
  type CreateTaskDTO,
  type MyAssignmentDTO,
  type MyTasksTab,
  type TaskAssignmentDTO,
  type TaskAssignmentHistoryDTO,
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
  cost: taskAssignmentDetailView.cost,
  startDate: taskAssignmentDetailView.startDate,
  endDate: taskAssignmentDetailView.endDate,
  userName: taskAssignmentDetailView.userName,
  userEmail: taskAssignmentDetailView.userEmail,
  userImage: taskAssignmentDetailView.userImage,
}

const LATEST_ASSIGNMENT_COLUMNS = {
  assignmentId: taskAssignmentLatestView.assignmentId,
  taskId: taskAssignmentLatestView.taskId,
  userId: taskAssignmentLatestView.userId,
  status: taskAssignmentLatestView.status,
  comment: taskAssignmentLatestView.comment,
  cost: taskAssignmentLatestView.cost,
  startDate: taskAssignmentLatestView.startDate,
  endDate: taskAssignmentLatestView.endDate,
  userName: taskAssignmentLatestView.userName,
  userEmail: taskAssignmentLatestView.userEmail,
  userImage: taskAssignmentLatestView.userImage,
}

const COMMENT_WITH_AUTHOR_COLUMNS = {
  id: taskCommentsTable.id,
  taskId: taskCommentsTable.taskId,
  authorId: taskCommentsTable.authorId,
  authorName: usersTable.name,
  authorImage: usersTable.image,
  content: taskCommentsTable.content,
  createdAt: taskCommentsTable.createdAt,
  updatedAt: taskCommentsTable.updatedAt,
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
    cost: row.cost,
    startDate: row.startDate,
    endDate: row.endDate,
    recurrence: row.recurrence,
    interval: row.interval,
    daysOfWeek: row.daysOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    archived: row.archived,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type QueryClient = typeof db | Transaction

type SpawnOptions = {
  anchor: Date
  /** Keep an occurrence that lands exactly on the anchor. */
  inclusive?: boolean
  client?: QueryClient
  onlyUserIds?: string[]
  closing?: { userId: string; endDate: Date | null }
}

// ---------- Leaf queries ----------

async function getTaskRowsByProject(projectId: string) {
  return db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.projectId, projectId))
    .orderBy(desc(tasksTable.createdAt))
}

async function getTaskRow(taskId: string, client: QueryClient = db) {
  return client
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, taskId))
    .then((rows) => rows[0])
}

async function getLatestAssignmentRowsByTaskIds(taskIds: string[]) {
  return db
    .select(LATEST_ASSIGNMENT_COLUMNS)
    .from(taskAssignmentLatestView)
    .where(inArray(taskAssignmentLatestView.taskId, taskIds))
}

async function getLatestAssignmentRowsByTaskId(taskId: string) {
  return db
    .select(LATEST_ASSIGNMENT_COLUMNS)
    .from(taskAssignmentLatestView)
    .where(eq(taskAssignmentLatestView.taskId, taskId))
}

async function getFullAssignmentRowsByTaskIds(taskIds: string[]) {
  return db
    .select(ASSIGNMENT_VIEW_COLUMNS)
    .from(taskAssignmentDetailView)
    .where(inArray(taskAssignmentDetailView.taskId, taskIds))
}

async function getFullAssignmentRowsByTaskId(taskId: string) {
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

/**
 * One row past the page reveals whether more history remains without a
 * count query; only terminal assignments are history. The project scope
 * binds in the WHERE — the chain validates the input projectId, this
 * enforces that the task actually belongs to it.
 */
async function getTaskAssignmentHistory(
  projectId: string,
  taskId: string,
  limit: number,
  offset: number
): Promise<TaskAssignmentHistoryDTO> {
  const rows = await db
    .select(ASSIGNMENT_VIEW_COLUMNS)
    .from(taskAssignmentDetailView)
    .where(
      and(
        eq(taskAssignmentDetailView.projectId, projectId),
        eq(taskAssignmentDetailView.taskId, taskId),
        inArray(taskAssignmentDetailView.status, ["done", "cancelled"])
      )
    )
    .orderBy(desc(taskAssignmentDetailView.createdAt))
    .limit(limit + 1)
    .offset(offset)

  return {
    assignments: rows.slice(0, limit).map(toTaskAssignmentDTO),
    hasMore: rows.length > limit,
  }
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

/**
 * The task-level closed-assignment total behind the status cell: every
 * terminal row, not just the ones a recurrence-aware fetch loads (one
 * row per assignee on repeating tasks), so rows paged away behind
 * Load More are still counted.
 */
async function getClosedCountsByTaskIds(taskIds: string[]) {
  return db
    .select({
      taskId: taskAssignmentsTable.taskId,
      cnt: sql<number>`count(*)::int`,
    })
    .from(taskAssignmentsTable)
    .where(
      and(
        inArray(taskAssignmentsTable.taskId, taskIds),
        inArray(taskAssignmentsTable.status, ["done", "cancelled"])
      )
    )
    .groupBy(taskAssignmentsTable.taskId)
}

/**
 * The task-row total: the sum of EVERY assignment's cost, with no status
 * filter and no pagination. Repeating tasks hide history behind Load More,
 * so deriving this from loaded rows would silently undercount.
 */
async function getCostTotalsByTaskIds(taskIds: string[]) {
  return db
    .select({
      taskId: taskAssignmentsTable.taskId,
      total: sql<string>`coalesce(sum(${taskAssignmentsTable.cost}), 0)::text`,
    })
    .from(taskAssignmentsTable)
    .where(inArray(taskAssignmentsTable.taskId, taskIds))
    .groupBy(taskAssignmentsTable.taskId)
}

async function getCostTotalByTaskId(taskId: string): Promise<number> {
  return db
    .select({
      total: sql<string>`coalesce(sum(${taskAssignmentsTable.cost}), 0)::text`,
    })
    .from(taskAssignmentsTable)
    .where(eq(taskAssignmentsTable.taskId, taskId))
    .then((rows) => Number(rows[0]?.total ?? 0))
}

async function getAssigneeUserIdsByTaskIds(taskIds: string[]) {
  return db
    .select({
      taskId: taskAssigneesTable.taskId,
      userId: taskAssigneesTable.userId,
    })
    .from(taskAssigneesTable)
    .where(inArray(taskAssigneesTable.taskId, taskIds))
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

async function getOpenAssignments(
  taskId: string,
  client: QueryClient = db
) {
  return client
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

async function hasLaterDatedAssignment(
  taskId: string,
  userId: string,
  endDate: Date | null,
  client: QueryClient = db
): Promise<boolean> {
  const rows = await client
    .select({ id: taskAssignmentsTable.id })
    .from(taskAssignmentsTable)
    .where(
      exists(
        client
          .select({ id: taskAssignmentsTable.id })
          .from(taskAssignmentsTable)
          .where(
            and(
              eq(taskAssignmentsTable.taskId, taskId),
              eq(taskAssignmentsTable.userId, userId),
              endDate === null
                ? isNotNull(taskAssignmentsTable.endDate)
                : gt(taskAssignmentsTable.endDate, endDate)
            )
          )
      )
    )
    .limit(1)

  return rows.length > 0
}

/**
 * The roster rows whose owner still holds a place on the project; the join
 * defends against a roster that drifted from membership. The primary owner
 * has no membership row (`createProject` never inserts one), so owning the
 * project counts as holding a place.
 */
async function getActiveAssigneeIds(
  taskId: string,
  projectId: string,
  client: QueryClient = db
): Promise<string[]> {
  const rows = await client
    .select({ userId: taskAssigneesTable.userId })
    .from(taskAssigneesTable)
    .innerJoin(projectsTable, eq(projectsTable.id, projectId))
    .leftJoin(
      projectMembershipTable,
      and(
        eq(projectMembershipTable.userId, taskAssigneesTable.userId),
        eq(projectMembershipTable.projectId, projectId)
      )
    )
    .where(
      and(
        eq(taskAssigneesTable.taskId, taskId),
        or(
          isNotNull(projectMembershipTable.userId),
          eq(projectsTable.primaryOwnerId, taskAssigneesTable.userId)
        )
      )
    )

  return rows.map((r) => r.userId)
}

type AssignmentStatusRow = {
  id: string
  userId: string
  status: TaskStatus
  endDate: Date | null
  taskId: string
  taskEndDate: Date | null
  archived: boolean
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
      archived: tasksTable.archived,
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
      cost: taskAssignmentDetailView.cost,
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

// ---------- Task comments ----------

async function getTaskRowInProject(taskId: string, projectId: string) {
  return db
    .select({
      id: tasksTable.id,
      archived: tasksTable.archived,
      startDate: tasksTable.startDate,
      endDate: tasksTable.endDate,
      recurrence: tasksTable.recurrence,
    })
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.id, taskId),
        eq(tasksTable.projectId, projectId)
      )
    )
    .then((rows) => rows[0])
}

async function getOpenAssignmentId(taskId: string, userId: string) {
  return db
    .select({ id: taskAssignmentsTable.id })
    .from(taskAssignmentsTable)
    .where(
      and(
        eq(taskAssignmentsTable.taskId, taskId),
        eq(taskAssignmentsTable.userId, userId),
        notInArray(taskAssignmentsTable.status, ["done", "cancelled"])
      )
    )
    .limit(1)
    .then((rows) => rows[0])
}

async function getUserProfile(userId: string) {
  return db
    .select({ name: usersTable.name, image: usersTable.image })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .then((rows) => rows[0])
}

async function getCommentRow(commentId: string) {
  return db
    .select({
      authorId: taskCommentsTable.authorId,
      taskId: taskCommentsTable.taskId,
    })
    .from(taskCommentsTable)
    .where(eq(taskCommentsTable.id, commentId))
    .then((rows) => rows[0])
}

async function getTaskComments(taskId: string) {
  return db
    .select(COMMENT_WITH_AUTHOR_COLUMNS)
    .from(taskCommentsTable)
    .innerJoin(
      usersTable,
      eq(taskCommentsTable.authorId, usersTable.id)
    )
    .where(eq(taskCommentsTable.taskId, taskId))
    .orderBy(asc(taskCommentsTable.createdAt))
}

async function getCommentWithAuthor(commentId: string) {
  return db
    .select(COMMENT_WITH_AUTHOR_COLUMNS)
    .from(taskCommentsTable)
    .innerJoin(
      usersTable,
      eq(taskCommentsTable.authorId, usersTable.id)
    )
    .where(eq(taskCommentsTable.id, commentId))
    .then((rows) => rows[0])
}

// ---------- Composed queries ----------

async function getTasksWithAssignments(
  projectId: string
): Promise<TaskWithAssignmentsDTO[]> {
  const taskRows = await getTaskRowsByProject(projectId)

  const ids = taskRows.map((t) => t.id)
  if (ids.length === 0) return []

  const fullIds: string[] = []
  const latestIds: string[] = []
  for (const row of taskRows) {
    if (row.recurrence === null) fullIds.push(row.id)
    else latestIds.push(row.id)
  }

  const [fullRows, latestRows, commentRows, closedRows, assigneeRows, costRows] =
    await Promise.all([
      fullIds.length > 0
        ? getFullAssignmentRowsByTaskIds(fullIds)
        : Promise.resolve([]),
      latestIds.length > 0
        ? getLatestAssignmentRowsByTaskIds(latestIds)
        : Promise.resolve([]),
      getCommentCountsByTaskIds(ids),
      getClosedCountsByTaskIds(ids),
      getAssigneeUserIdsByTaskIds(ids),
      getCostTotalsByTaskIds(ids),
    ])

  const assignmentRows = [...fullRows, ...latestRows]

  const assignmentsByTask = new Map<string, TaskAssignmentDTO[]>()
  for (const row of assignmentRows) {
    const list = assignmentsByTask.get(row.taskId) ?? []
    list.push(toTaskAssignmentDTO(row))
    assignmentsByTask.set(row.taskId, list)
  }

  const counts = new Map(commentRows.map((r) => [r.taskId, r.cnt]))
  const closedCounts = new Map(closedRows.map((r) => [r.taskId, r.cnt]))
  const costTotals = new Map(costRows.map((r) => [r.taskId, r.total]))
  const assigneesByTask = new Map<string, string[]>()
  for (const row of assigneeRows) {
    const list = assigneesByTask.get(row.taskId) ?? []
    list.push(row.userId)
    assigneesByTask.set(row.taskId, list)
  }

  return taskRows.map((row) => ({
    ...toTaskRecord(row),
    assignments: sortAssignments(assignmentsByTask.get(row.id) ?? []),
    assigneeIds: assigneesByTask.get(row.id) ?? [],
    commentCount: counts.get(row.id) ?? 0,
    closedCount: closedCounts.get(row.id) ?? 0,
    totalCost: Number(costTotals.get(row.id) ?? 0),
  }))
}

async function getTaskWithAssignments(taskId: string): Promise<{
  record: TaskRecordDTO
  assignments: TaskAssignmentDTO[]
  closedCount: number
  assigneeIds: string[]
  totalCost: number
} | null> {
  const row = await getTaskRow(taskId)
  if (!row) return null

  const [assignmentRows, closedRows, assigneeRows, totalCost] =
    await Promise.all([
      row.recurrence
        ? getLatestAssignmentRowsByTaskId(taskId)
        : getFullAssignmentRowsByTaskId(taskId),
      getClosedCountsByTaskIds([taskId]),
      getAssigneeUserIdsByTaskIds([taskId]),
      getCostTotalByTaskId(taskId),
    ])

  return {
    record: toTaskRecord(row),
    assignments: sortAssignments(
      assignmentRows.map(toTaskAssignmentDTO)
    ),
    closedCount: closedRows[0]?.cnt ?? 0,
    assigneeIds: assigneeRows.map((r) => r.userId),
    totalCost,
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
    cost,
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
        cost: cost || "0",
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
      await tx
        .insert(taskAssigneesTable)
        .values(assigneeIds.map((userId) => ({ taskId: row.id, userId })))

      const window = firstAssignmentWindow(row)
      await tx.insert(taskAssignmentsTable).values(
        assigneeIds.map((userId) => ({
          taskId: row.id,
          userId,
          status: "todo" as const,
          cost: cost || "0",
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
    cost,
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
      cost: cost || "0",
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
  taskRow: typeof tasksTable.$inferSelect,
  unassignAs?: Record<string, "done" | "cancelled">
): Promise<void> {
  const [roster, openAssignments] = await Promise.all([
    getAssigneeUserIdsByTaskIds([taskId]),
    getOpenAssignments(taskId),
  ])

  const memberIds = new Set(roster.map((r) => r.userId))
  const openUserIds = new Set(openAssignments.map((a) => a.userId))
  const wanted = new Set(assigneeIds)
  const added = assigneeIds.filter((id) => !memberIds.has(id))
  const removed = [...memberIds].filter((id) => !wanted.has(id))
  const removedSet = new Set(removed)
  const toClose = openAssignments.filter((a) => removedSet.has(a.userId))

  // Removals group by their recorded disposition — at most two UPDATEs,
  // closed rows keep dates/comment/id intact; only membership is deleted.
  const removalGroups = new Map<"done" | "cancelled", string[]>()
  for (const assignment of toClose) {
    const disposition =
      unassignAs?.[assignment.userId] ?? "cancelled"
    const ids = removalGroups.get(disposition) ?? []
    ids.push(assignment.id)
    removalGroups.set(disposition, ids)
  }

  await db.transaction(async (tx) => {
    if (removed.length > 0) {
      await tx
        .delete(taskAssigneesTable)
        .where(
          and(
            eq(taskAssigneesTable.taskId, taskId),
            inArray(taskAssigneesTable.userId, removed)
          )
        )
    }
    for (const [status, ids] of removalGroups) {
      await tx
        .update(taskAssignmentsTable)
        .set({ status })
        .where(inArray(taskAssignmentsTable.id, ids))
    }
    if (added.length === 0) return

    await tx
      .insert(taskAssigneesTable)
      .values(added.map((userId) => ({ taskId, userId })))

    if (taskRow.recurrence) {
      await spawnEligibleAssignments(taskId, {
        anchor: new Date(),
        client: tx,
        onlyUserIds: added,
      })
      return
    }

    // An archived task takes the membership row but never an open assignment.
    const needsRow = taskRow.archived
      ? []
      : added.filter((id) => !openUserIds.has(id))
    if (needsRow.length > 0) {
      const window = firstAssignmentWindow(taskRow)
      await tx.insert(taskAssignmentsTable).values(
        needsRow.map((userId) => ({
          taskId,
          userId,
          status: "todo" as const,
          cost: taskRow.cost,
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
  cost: string
  startDate: Date
  endDate: Date
}

async function insertAssignmentRows(
  rows: AssignmentSpawn[],
  client: QueryClient = db
): Promise<string[]> {
  const inserted = await client
    .insert(taskAssignmentsTable)
    .values(rows.map((row) => ({ ...row, status: "todo" as const })))
    .returning({ id: taskAssignmentsTable.id })

  return inserted.map((r) => r.id)
}

/**
 * The one place a repeating task's next occurrence is decided. Rule 0: an
 * archived task spawns nothing. Rule 1: only active assignees (roster row
 * plus current membership). Rule 2: no open assignment already. Rule 3: the
 * schedule yields an in-range occurrence after the trigger's anchor.
 */
async function spawnEligibleAssignments(
  taskId: string,
  opts: SpawnOptions
): Promise<string[]> {
  const task = await getTaskRow(taskId, opts.client)
  if (!task || task.archived || !task.recurrence) return []

  const [activeIds, openAssignments] = await Promise.all([
    getActiveAssigneeIds(taskId, task.projectId, opts.client),
    getOpenAssignments(taskId, opts.client),
  ])

  const openUserIds = new Set(openAssignments.map((a) => a.userId))
  const scope = opts.onlyUserIds ? new Set(opts.onlyUserIds) : null
  const candidates = activeIds.filter(
    (userId) =>
      !openUserIds.has(userId) && (scope === null || scope.has(userId))
  )

  const next = computeNextOccurrence(
    {
      recurrence: task.recurrence,
      interval: task.interval,
      daysOfWeek: task.daysOfWeek,
      startTime: task.startTime,
      endDate: task.endDate,
    },
    opts.anchor,
    { inclusive: opts.inclusive }
  )
  if (!next || candidates.length === 0) return []

  const spawns: AssignmentSpawn[] = []
  for (const userId of candidates) {
    if (
      opts.closing?.userId === userId &&
      (await hasLaterDatedAssignment(
        taskId,
        userId,
        opts.closing.endDate,
        opts.client
      ))
    ) {
      continue
    }
    spawns.push({
      taskId,
      userId,
      // Snapshot the task's CURRENT default: later edits never rewrite rows.
      cost: task.cost,
      startDate: next,
      endDate: atTime(next, task.endTime),
    })
  }
  if (spawns.length === 0) return []

  return insertAssignmentRows(spawns, opts.client)
}

/**
 * What the action hands over so the cascade runs with the status write:
 * the task to spawn for, the anchor after which the next occurrence is
 * due, and the closing assignee whose later-dated rows still guard their
 * own successor. `null` means this close spawns nothing.
 */
type SpawnDescriptor = {
  taskId: string
  anchor: Date
  closing: { userId: string; endDate: Date | null }
} | null

async function updateAssignmentStatus(
  assignmentId: string,
  status: TaskStatus,
  spawn: SpawnDescriptor
): Promise<string[]> {
  let spawnedIds: string[] = []

  await db.transaction(async (tx) => {
    await tx
      .update(taskAssignmentsTable)
      .set({ status })
      .where(eq(taskAssignmentsTable.id, assignmentId))

    if (spawn) {
      spawnedIds = await spawnEligibleAssignments(spawn.taskId, {
        anchor: spawn.anchor,
        closing: spawn.closing,
        client: tx,
      })
    }
  })

  return spawnedIds
}

async function updateAssignmentCost(
  assignmentId: string,
  cost: string
): Promise<void> {
  await db
    .update(taskAssignmentsTable)
    .set({ cost })
    .where(eq(taskAssignmentsTable.id, assignmentId))
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

/**
 * Archive in one transaction: set `archived = true` and close every open
 * assignment with the chosen disposition. Dates and times are left untouched.
 * Direct UPDATEs only — no spawn cascade, no membership writes, so archiving
 * spawns nothing.
 */
async function archiveTaskRow(
  taskId: string,
  projectId: string,
  closeAs: "done" | "cancelled"
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(tasksTable)
      .set({ archived: true })
      .where(
        and(
          eq(tasksTable.id, taskId),
          eq(tasksTable.projectId, projectId),
          eq(tasksTable.archived, false)
        )
      )

    await tx
      .update(taskAssignmentsTable)
      .set({ status: closeAs })
      .where(
        and(
          eq(taskAssignmentsTable.taskId, taskId),
          notInArray(taskAssignmentsTable.status, ["done", "cancelled"])
        )
      )
  })
}

/**
 * Unarchive in one transaction: unfreeze the task, then run trigger (a) — the
 * spawn helper decides (repeating, in-range, active assignee, no open row)
 * whether open assignments reopen. The helper re-reads the task inside the
 * transaction, so rule 0 sees `archived = false` as written here. Membership
 * rows are untouched; closed history stays as-is. Returns `null` when no
 * archived row was flipped (deleted or already unarchived by a racing call).
 */
async function unarchiveTaskRow(
  taskId: string,
  projectId: string,
  anchor: Date
): Promise<string[] | null> {
  let spawnedIds: string[] | null = null

  await db.transaction(async (tx) => {
    const flipped = await tx
      .update(tasksTable)
      .set({ archived: false })
      .where(
        and(
          eq(tasksTable.id, taskId),
          eq(tasksTable.projectId, projectId),
          eq(tasksTable.archived, true)
        )
      )
      .returning({ id: tasksTable.id })

    if (flipped.length === 0) return

    spawnedIds = await spawnEligibleAssignments(taskId, {
      anchor,
      client: tx,
    })
  })

  return spawnedIds
}

async function createComment(
  taskId: string,
  authorId: string,
  content: string
) {
  const [inserted] = await db
    .insert(taskCommentsTable)
    .values({
      taskId,
      authorId,
      content,
    })
    .returning()

  return inserted
}

async function updateCommentContent(
  commentId: string,
  content: string
): Promise<void> {
  await db
    .update(taskCommentsTable)
    .set({ content })
    .where(eq(taskCommentsTable.id, commentId))
}

async function deleteComment(commentId: string): Promise<void> {
  await db
    .delete(taskCommentsTable)
    .where(eq(taskCommentsTable.id, commentId))
}

const queries = {
  getProjectPrimaryOwnerId,
  getProjectMemberIds,
  getAssignmentViewById,
  getAssignmentForRow,
  getTaskAssignmentHistory,
  hasLaterDatedAssignment,
  getAssignmentForComment,
  getTasksWithAssignments,
  getTaskWithAssignments,
  getAssigneeUserIdsByTaskIds,
  getMyTasks,
  createTask,
  updateTaskRow,
  syncTaskAssignments,
  spawnEligibleAssignments,
  updateAssignmentStatus,
  updateAssignmentComment,
  updateTaskPriority,
  deleteTask,
  archiveTaskRow,
  unarchiveTaskRow,
  getCostTotalsByTaskIds,
  getCostTotalByTaskId,
  updateAssignmentCost,
  getTaskRowInProject,
  getOpenAssignmentId,
  getUserProfile,
  getCommentRow,
  getTaskComments,
  getCommentWithAuthor,
  createComment,
  updateCommentContent,
  deleteComment,
}

export default queries
