import type { CreateProjectDTO, UpdateProjectDTO } from "./schemas"
import { db } from "@/lib/drizzle/client"
import {
  categoryTable,
  expensesTable,
  invoicesTable,
  projectMembershipTable,
  projectsTable,
  taskAssignmentsTable,
  tasksTable,
  usersTable,
} from "@/lib/drizzle/schema"
import { and, desc, eq, inArray, or, sql } from "drizzle-orm"

async function getProjectOptions(userId: string) {
  return db
    .select({
      id: projectsTable.id,
      primaryOwnerId: projectsTable.primaryOwnerId,
      categoryId: projectsTable.categoryId,
      name: projectsTable.name,
      description: projectsTable.description,
      status: projectsTable.status,
      startDate: projectsTable.startDate,
      endDate: projectsTable.endDate,
      location: projectsTable.location,
      budget: projectsTable.budget,
      color: projectsTable.color,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
      categorySlug: categoryTable.slug,
      categoryName: categoryTable.name,
      ownerName: usersTable.name,
    })
    .from(projectsTable)
    .leftJoin(
      categoryTable,
      eq(projectsTable.categoryId, categoryTable.id)
    )
    .leftJoin(
      usersTable,
      eq(projectsTable.primaryOwnerId, usersTable.id)
    )
    .where(
      or(
        eq(projectsTable.primaryOwnerId, userId),
        sql`exists (select 1 from ${projectMembershipTable} where ${projectMembershipTable.projectId} = ${projectsTable.id} and ${projectMembershipTable.userId} = ${userId} and ${projectMembershipTable.role} = 'admin')`
      )
    )
    .orderBy(desc(projectsTable.createdAt))
}

async function getProjectsForUser(userId: string) {
  return db
    .select({
      id: projectsTable.id,
      primaryOwnerId: projectsTable.primaryOwnerId,
      categoryId: projectsTable.categoryId,
      name: projectsTable.name,
      description: projectsTable.description,
      status: projectsTable.status,
      startDate: projectsTable.startDate,
      endDate: projectsTable.endDate,
      location: projectsTable.location,
      budget: projectsTable.budget,
      color: projectsTable.color,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
      categorySlug: categoryTable.slug,
      categoryName: categoryTable.name,
    })
    .from(projectsTable)
    .leftJoin(
      categoryTable,
      eq(projectsTable.categoryId, categoryTable.id)
    )
    .where(
      or(
        eq(projectsTable.primaryOwnerId, userId),
        sql`exists (select 1 from ${projectMembershipTable} where ${projectMembershipTable.projectId} = ${projectsTable.id} and ${projectMembershipTable.userId} = ${userId} and ${projectMembershipTable.role} = 'admin')`
      )
    )
    .orderBy(desc(projectsTable.createdAt))
}

async function getProjectTaskCounts(projectIds: string[]) {
  return db
    .select({
      projectId: tasksTable.projectId,
      total: sql<number>`count(*)::int`,
      // Completed means every assignment is terminal; a task with an
      // open occurrence is not, and one with no assignments never is.
      completed: sql<number>`(count(*) filter (
        where exists (
          select 1 from ${taskAssignmentsTable}
          where ${taskAssignmentsTable.taskId} = ${tasksTable.id}
        )
        and not exists (
          select 1 from ${taskAssignmentsTable}
          where ${taskAssignmentsTable.taskId} = ${tasksTable.id}
          and ${taskAssignmentsTable.status} not in ('done', 'cancelled')
        )
      ))::int`,
    })
    .from(tasksTable)
    .where(inArray(tasksTable.projectId, projectIds))
    .groupBy(tasksTable.projectId)
}

async function getProjectExpenseTotals(projectIds: string[]) {
  return db
    .select({
      projectId: expensesTable.projectId,
      total: sql<string>`coalesce(sum(${expensesTable.amount}), '0')`,
    })
    .from(expensesTable)
    .where(inArray(expensesTable.projectId, projectIds))
    .groupBy(expensesTable.projectId)
}

async function getProjectInvoicePaidTotals(projectIds: string[]) {
  return db
    .select({
      projectId: invoicesTable.projectId,
      total: sql<string>`coalesce(sum(${invoicesTable.paidAmount}), '0')`,
    })
    .from(invoicesTable)
    .where(inArray(invoicesTable.projectId, projectIds))
    .groupBy(invoicesTable.projectId)
}

async function getProjectInProgressTasks(projectIds: string[]) {
  return db
    .select({
      id: tasksTable.id,
      projectId: tasksTable.projectId,
      name: tasksTable.name,
    })
    .from(tasksTable)
    .where(
      and(
        inArray(tasksTable.projectId, projectIds),
        sql`exists (
          select 1 from ${taskAssignmentsTable}
          where ${taskAssignmentsTable.taskId} = ${tasksTable.id}
          and ${taskAssignmentsTable.status} in ('in_progress', 'in_review', 'blocked')
        )`
      )
    )
    .orderBy(tasksTable.createdAt)
    .limit(3)
}

async function getProjectOwners(projectIds: string[]) {
  return db
    .select({
      projectId: projectsTable.id,
      userId: usersTable.id,
      name: usersTable.name,
      image: usersTable.image,
    })
    .from(projectsTable)
    .innerJoin(
      usersTable,
      eq(projectsTable.primaryOwnerId, usersTable.id)
    )
    .where(inArray(projectsTable.id, projectIds))
}

async function getProjectMemberships(projectIds: string[]) {
  return db
    .select({
      projectId: projectMembershipTable.projectId,
      userId: projectMembershipTable.userId,
      role: projectMembershipTable.role,
      name: usersTable.name,
      image: usersTable.image,
    })
    .from(projectMembershipTable)
    .innerJoin(
      usersTable,
      eq(projectMembershipTable.userId, usersTable.id)
    )
    .where(inArray(projectMembershipTable.projectId, projectIds))
}

async function getInProgressTaskAssignees(taskIds: string[]) {
  const inProgressStatuses = [
    "in_progress",
    "in_review",
    "blocked",
  ] as const

  return db
    .select({
      taskId: taskAssignmentsTable.taskId,
      assigneeName: usersTable.name,
      assigneeImage: usersTable.image,
    })
    .from(taskAssignmentsTable)
    .innerJoin(
      usersTable,
      eq(taskAssignmentsTable.userId, usersTable.id)
    )
    .where(
      and(
        inArray(taskAssignmentsTable.taskId, taskIds),
        inArray(taskAssignmentsTable.status, inProgressStatuses)
      )
    )
}

async function getProjectSummaries(userId: string) {
  const filteredProjects = await getProjectsForUser(userId)

  const projectIds = filteredProjects.map((p) => p.id)
  if (projectIds.length === 0) return []

  const [
    taskAggs,
    expenseAggs,
    invoicePaidAggs,
    inProgressTasks,
    ownerData,
    memberData,
  ] = await Promise.all([
    getProjectTaskCounts(projectIds),
    getProjectExpenseTotals(projectIds),
    getProjectInvoicePaidTotals(projectIds),
    getProjectInProgressTasks(projectIds),
    getProjectOwners(projectIds),
    getProjectMemberships(projectIds),
  ])

  const inProgressIds = inProgressTasks.map((task) => task.id)
  const assigneeRows =
    inProgressIds.length > 0
      ? await getInProgressTaskAssignees(inProgressIds)
      : []
  const assigneeByTask = new Map<
    string,
    { name: string | null; image: string | null }
  >()
  for (const row of assigneeRows) {
    if (!assigneeByTask.has(row.taskId)) {
      assigneeByTask.set(row.taskId, {
        name: row.assigneeName,
        image: row.assigneeImage,
      })
    }
  }

  const taskMap = new Map<
    string,
    { total: number; completed: number }
  >()
  for (const agg of taskAggs) {
    taskMap.set(agg.projectId, {
      total: agg.total,
      completed: agg.completed,
    })
  }
  const expenseMap = new Map<string, number>()
  for (const agg of expenseAggs) {
    expenseMap.set(agg.projectId, Number(agg.total))
  }
  const invoicePaidMap = new Map<string, number>()
  for (const agg of invoicePaidAggs) {
    if (agg.projectId === null) continue
    invoicePaidMap.set(agg.projectId, Number(agg.total))
  }
  const inProgressMap = new Map<
    string,
    {
      id: string
      title: string
      assignee: string
      assigneeImage: string | null
    }[]
  >()
  for (const task of inProgressTasks) {
    const list = inProgressMap.get(task.projectId) ?? []
    const assignee = assigneeByTask.get(task.id)
    list.push({
      id: task.id,
      title: task.name,
      assignee: assignee?.name ?? "",
      assigneeImage: assignee?.image ?? null,
    })
    inProgressMap.set(task.projectId, list)
  }
  const memberMap = new Map<
    string,
    {
      id: string
      name: string
      image: string | null
      role: "owner" | "admin" | "collaborator"
    }[]
  >()
  for (const o of ownerData) {
    memberMap.set(o.projectId, [
      {
        id: o.userId,
        name: o.name ?? "",
        image: o.image,
        role: "owner",
      },
    ])
  }
  for (const m of memberData) {
    const list = memberMap.get(m.projectId) ?? []
    if (!list.find((x) => x.id === m.userId)) {
      list.push({
        id: m.userId,
        name: m.name ?? "",
        image: m.image,
        role: m.role,
      })
    }
    memberMap.set(m.projectId, list)
  }

  return filteredProjects.map((p) => {
    const tasks = taskMap.get(p.id) ?? { total: 0, completed: 0 }
    const expenses =
      (expenseMap.get(p.id) ?? 0) + (invoicePaidMap.get(p.id) ?? 0)
    const budget = p.budget ? Number(p.budget) : 0
    return {
      id: p.id,
      primaryOwnerId: p.primaryOwnerId,
      name: p.name,
      description: p.description,
      status: p.status,
      color: p.color,
      categorySlug: p.categorySlug,
      startDate: p.startDate,
      endDate: p.endDate ?? "",
      location: p.location,
      budget,
      expenses,
      tasksTotal: tasks.total,
      tasksCompleted: tasks.completed,
      inProgressTasks: inProgressMap.get(p.id) ?? [],
      members: memberMap.get(p.id) ?? [],
    }
  })
}

async function getProjectById(projectId: string) {
  return db
    .select({
      id: projectsTable.id,
      primaryOwnerId: projectsTable.primaryOwnerId,
      categoryId: projectsTable.categoryId,
      name: projectsTable.name,
      description: projectsTable.description,
      status: projectsTable.status,
      startDate: projectsTable.startDate,
      endDate: projectsTable.endDate,
      location: projectsTable.location,
      budget: projectsTable.budget,
      color: projectsTable.color,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
      categorySlug: categoryTable.slug,
      categoryName: categoryTable.name,
    })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .leftJoin(
      categoryTable,
      eq(projectsTable.categoryId, categoryTable.id)
    )
    .then((rows) => rows[0])
}

async function createProject(
  values: CreateProjectDTO,
  primaryOwnerId: string
) {
  const {
    name,
    categoryId,
    status,
    description,
    startDate,
    endDate,
    location,
    budget,
    color,
  } = values
  const [created] = await db
    .insert(projectsTable)
    .values({
      primaryOwnerId,
      categoryId,
      name,
      status,
      description: description || null,
      startDate,
      endDate: endDate || null,
      location: location || null,
      budget: budget ? budget : null,
      color,
    })
    .returning()
  return created
}

async function updateProject(values: UpdateProjectDTO) {
  const {
    projectId,
    name,
    categoryId,
    status,
    description,
    startDate,
    endDate,
    location,
    budget,
    color,
  } = values
  const [updated] = await db
    .update(projectsTable)
    .set({
      name,
      categoryId,
      status,
      description: description || null,
      startDate,
      endDate: endDate || null,
      location: location || null,
      budget: budget ? budget : null,
      color,
    })
    .where(eq(projectsTable.id, projectId))
    .returning()
  return updated
}

async function deleteProject(projectId: string): Promise<void> {
  await db.delete(projectsTable).where(eq(projectsTable.id, projectId))
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

async function getProjectMembershipRole(
  projectId: string,
  userId: string
): Promise<"admin" | "collaborator" | null> {
  const membership = await db
    .select({ role: projectMembershipTable.role })
    .from(projectMembershipTable)
    .where(
      and(
        eq(projectMembershipTable.projectId, projectId),
        eq(projectMembershipTable.userId, userId)
      )
    )
    .then((rows) => rows[0] ?? null)

  return membership?.role ?? null
}

async function getUserById(userId: string) {
  return db
    .select({
      userId: usersTable.id,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userImage: usersTable.image,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .then((rows) => rows[0])
}

async function getProjectMembershipRows(projectId: string) {
  return db
    .select({
      userId: projectMembershipTable.userId,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userImage: usersTable.image,
      role: projectMembershipTable.role,
    })
    .from(projectMembershipTable)
    .innerJoin(
      usersTable,
      eq(projectMembershipTable.userId, usersTable.id)
    )
    .where(eq(projectMembershipTable.projectId, projectId))
}

async function getProjectMembers(projectId: string) {
  const primaryOwnerId = await getProjectPrimaryOwnerId(projectId)
  if (primaryOwnerId === null) return null

  const owner = await getUserById(primaryOwnerId)
  const members = await getProjectMembershipRows(projectId)

  const ordered = [...members].sort((a, b) => {
    if (a.role !== b.role) return a.role === "admin" ? -1 : 1
    const aName = a.userName ?? a.userEmail ?? a.userId
    const bName = b.userName ?? b.userEmail ?? b.userId
    return aName.localeCompare(bName)
  })

  return [
    ...(owner
      ? [
          {
            ...owner,
            role: "owner" as const,
            isPrimaryOwner: true,
          },
        ]
      : []),
    ...ordered.map((member) => ({
      ...member,
      isPrimaryOwner: false,
    })),
  ]
}

async function createProjectMembership(
  projectId: string,
  userId: string,
  role: "admin" | "collaborator"
) {
  const [row] = await db
    .insert(projectMembershipTable)
    .values({ projectId, userId, role })
    .returning()
  return row
}

async function deleteProjectMembership(
  projectId: string,
  userId: string,
  role: "admin" | "collaborator"
) {
  const [removed] = await db
    .delete(projectMembershipTable)
    .where(
      and(
        eq(projectMembershipTable.projectId, projectId),
        eq(projectMembershipTable.userId, userId),
        eq(projectMembershipTable.role, role)
      )
    )
    .returning()
  return removed
}

async function updateProjectMembershipRole(
  projectId: string,
  userId: string,
  role: "admin" | "collaborator"
) {
  const [row] = await db
    .update(projectMembershipTable)
    .set({ role })
    .where(
      and(
        eq(projectMembershipTable.projectId, projectId),
        eq(projectMembershipTable.userId, userId)
      )
    )
    .returning()
  return row
}

async function transferProjectOwnership(
  projectId: string,
  currentOwnerId: string,
  newOwnerId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(projectMembershipTable)
      .where(
        and(
          eq(projectMembershipTable.projectId, projectId),
          eq(projectMembershipTable.userId, newOwnerId)
        )
      )
    await tx.insert(projectMembershipTable).values({
      projectId,
      userId: currentOwnerId,
      role: "admin",
    })
    await tx
      .update(projectsTable)
      .set({ primaryOwnerId: newOwnerId })
      .where(eq(projectsTable.id, projectId))
  })
}

const queries = {
  getProjectOptions,
  getProjectsForUser,
  getProjectTaskCounts,
  getProjectExpenseTotals,
  getProjectInvoicePaidTotals,
  getProjectInProgressTasks,
  getProjectOwners,
  getProjectMemberships,
  getInProgressTaskAssignees,
  getProjectSummaries,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectPrimaryOwnerId,
  getProjectMembershipRole,
  getUserById,
  getProjectMembershipRows,
  getProjectMembers,
  createProjectMembership,
  deleteProjectMembership,
  updateProjectMembershipRole,
  transferProjectOwnership,
}

export default queries
