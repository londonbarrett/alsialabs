"use server"

import { getProjectCategories } from "@/actions/categories"
import { getProjectMembers } from "@/actions/project-membership"
import { SuccessSchema } from "@/actions/schemas/common"
import {
  CreateProjectSchema,
  ProjectContextSchema,
  ProjectDetailSchema,
  ProjectOptionSchema,
  ProjectRecordSchema,
  ProjectSummarySchema,
  UpdateProjectSchema,
} from "@/actions/schemas/project"
import { getUserPermissions } from "@/lib/auth"
import { canManageProject, canViewProject } from "@/lib/project-roles"
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
import {
  projectAction,
  returnActionError,
  sessionAction,
} from "@/lib/safe-action"
import { unwrapResponse } from "@/lib/util/unwrap"
import { and, desc, eq, inArray, or, sql } from "drizzle-orm"
import { z } from "zod"

export const getProjects = sessionAction
  .metadata({})
  .outputSchema(z.array(ProjectOptionSchema))
  .action(async ({ ctx }) => {
    const session = ctx.session
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
          eq(projectsTable.primaryOwnerId, session.user.id),
          sql`exists (select 1 from ${projectMembershipTable} where ${projectMembershipTable.projectId} = ${projectsTable.id} and ${projectMembershipTable.userId} = ${session.user.id} and ${projectMembershipTable.role} = 'admin')`
        )
      )
      .orderBy(desc(projectsTable.createdAt))
  })

export const getProjectsWithDetails = sessionAction
  .metadata({})
  .outputSchema(z.array(ProjectSummarySchema))
  .action(async ({ ctx }) => {
    const session = ctx.session
    const filteredProjects = await db
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
          eq(projectsTable.primaryOwnerId, session.user.id),
          sql`exists (select 1 from ${projectMembershipTable} where ${projectMembershipTable.projectId} = ${projectsTable.id} and ${projectMembershipTable.userId} = ${session.user.id} and ${projectMembershipTable.role} = 'admin')`
        )
      )
      .orderBy(desc(projectsTable.createdAt))

    const projectIds = filteredProjects.map((p) => p.id)
    if (projectIds.length === 0) return []

    const inProgressStatuses = [
      "in_progress",
      "in_review",
      "blocked",
    ] as const

    const [
      taskAggs,
      expenseAggs,
      invoicePaidAggs,
      inProgressTasks,
      ownerData,
      memberData,
    ] = await Promise.all([
      db
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
        .groupBy(tasksTable.projectId),
      db
        .select({
          projectId: expensesTable.projectId,
          total: sql<string>`coalesce(sum(${expensesTable.amount}), '0')`,
        })
        .from(expensesTable)
        .where(inArray(expensesTable.projectId, projectIds))
        .groupBy(expensesTable.projectId),
      db
        .select({
          projectId: invoicesTable.projectId,
          total: sql<string>`coalesce(sum(${invoicesTable.paidAmount}), '0')`,
        })
        .from(invoicesTable)
        .where(inArray(invoicesTable.projectId, projectIds))
        .groupBy(invoicesTable.projectId),
      db
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
        .limit(3),
      db
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
        .where(inArray(projectsTable.id, projectIds)),
      db
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
        .where(inArray(projectMembershipTable.projectId, projectIds)),
    ])

    const inProgressIds = inProgressTasks.map((task) => task.id)
    const assigneeRows =
      inProgressIds.length > 0
        ? await db
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
                inArray(taskAssignmentsTable.taskId, inProgressIds),
                inArray(taskAssignmentsTable.status, inProgressStatuses)
              )
            )
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
  })

export const getProjectById = projectAction(
  z.object({ projectId: z.uuid() })
)
  .metadata({})
  .outputSchema(ProjectDetailSchema)
  .action(async ({ parsedInput }) => {
    const { projectId } = parsedInput
    const project = await db
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
    if (!project) returnActionError("NOT_FOUND")
    return project
  })

export const createProject = sessionAction
  .metadata({ revalidate: ["/app/proyectos"] })
  .inputSchema(CreateProjectSchema)
  .outputSchema(ProjectRecordSchema)
  .action(async ({ parsedInput, ctx }) => {
    const session = ctx.session
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
    } = parsedInput
    const [created] = await db
      .insert(projectsTable)
      .values({
        primaryOwnerId: session.user.id,
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
  })

export const updateProject = projectAction(UpdateProjectSchema)
  .metadata({
    // :projectId interpolated from input AFTER the action commits
    revalidate: ["/app/proyectos", "/app/proyectos/:projectId"],
  })
  .outputSchema(ProjectRecordSchema)
  .action(async ({ parsedInput, ctx }) => {
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
    } = parsedInput
    if (!canManageProject(ctx.projectRole))
      returnActionError("FORBIDDEN")
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
    if (!updated) returnActionError("NOT_FOUND")
    return updated
  })

export const getProjectForEdit = projectAction(
  z.object({ projectId: z.uuid() })
)
  .metadata({})
  .outputSchema(ProjectRecordSchema)
  .action(async ({ parsedInput }) => {
    const { projectId } = parsedInput
    const project = await db
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
      })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .then((rows) => rows[0])
    if (!project) returnActionError("NOT_FOUND")
    return project
  })

export const deleteProject = projectAction(
  z.object({ projectId: z.uuid() })
)
  .metadata({ revalidate: ["/app/proyectos"] })
  .outputSchema(SuccessSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { projectId } = parsedInput
    const project = await db
      .select({ primaryOwnerId: projectsTable.primaryOwnerId })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .then((rows) => rows[0])
    if (!project) returnActionError("NOT_FOUND")
    if (!canManageProject(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }
    await db
      .delete(projectsTable)
      .where(eq(projectsTable.id, projectId))
    return { success: true }
  })

export const getProjectContext = projectAction(
  z.object({ projectId: z.uuid() })
)
  .metadata({})
  .outputSchema(ProjectContextSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { projectId } = parsedInput
    const session = ctx.session
    if (!canViewProject(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const projectResult = await getProjectById({ projectId })
    if (projectResult.serverError?.code === "FORBIDDEN") {
      returnActionError("FORBIDDEN")
    }
    if (!projectResult.data) {
      returnActionError("NOT_FOUND")
    }
    const project = projectResult.data!
    const [members, permissions, categoriesResult] = await Promise.all([
      getProjectMembers({ projectId }),
      getUserPermissions(session.user.id),
      getProjectCategories(),
    ])
    return {
      project,
      members: unwrapResponse(members),
      permissions,
      session,
      currentRole: ctx.projectRole!,
      currentUserId: session.user.id,
      categories: unwrapResponse(categoriesResult),
    }
  })
