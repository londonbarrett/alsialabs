"use server"

import {
  getProjectCollaborators,
  getProjectOwners,
} from "@/lib/actions/project-users"
import { getUserPermissions, isSuperUser } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import {
  categoryTable,
  expensesTable,
  projectCollaboratorsTable,
  projectOwnersTable,
  projectsTable,
  tasksTable,
  usersTable,
} from "@/lib/drizzle/schema"
import {
  projectScopedAction,
  returnActionError,
  sessionAction,
} from "@/lib/safe-action"
import {
  createProjectSchema,
  updateProjectSchema,
} from "@/lib/schemas/project"
import type { ProjectMember } from "@/lib/types"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import type { Session } from "next-auth"
import { revalidatePath } from "next/cache"
import { z } from "zod"

export const getProjects = sessionAction
  .metadata({ permission: { module: "projects", action: "view" } })
  .action(async ({ ctx }) => {
    const session = ctx.session
    if (isSuperUser(session as { user: { role: string | null } })) {
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
        .orderBy(desc(projectsTable.createdAt))
    }
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
        sql`exists (select 1 from ${projectOwnersTable} where ${projectOwnersTable.projectId} = ${projectsTable.id} and ${projectOwnersTable.userId} = ${session.user.id})`
      )
      .orderBy(desc(projectsTable.createdAt))
  })

export type ProjectWithCategory = NonNullable<
  Awaited<ReturnType<typeof getProjects>>["data"]
>[number]

export const getProjectsWithDetails = sessionAction
  .metadata({ permission: { module: "projects", action: "view" } })
  .action(async ({ ctx }) => {
    const session = ctx.session
    let filteredProjects: NonNullable<
      Awaited<ReturnType<typeof getProjects>>["data"]
    >

    if (isSuperUser(session as { user: { role: string | null } })) {
      filteredProjects = await db
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
        .orderBy(desc(projectsTable.createdAt))
    } else {
      filteredProjects = await db
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
          sql`exists (select 1 from ${projectOwnersTable} where ${projectOwnersTable.projectId} = ${projectsTable.id} and ${projectOwnersTable.userId} = ${session.user.id})`
        )
        .orderBy(desc(projectsTable.createdAt))
    }

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
      taskCostAggs,
      inProgressTasks,
      ownerData,
      collaboratorData,
    ] = await Promise.all([
      db
        .select({
          projectId: tasksTable.projectId,
          total: sql<number>`count(*) filter (where ${tasksTable.status} <> 'cancelled')`,
          completed: sql<number>`count(*) filter (where ${tasksTable.status} = 'done')`,
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
          projectId: tasksTable.projectId,
          total: sql<string>`coalesce(sum(${tasksTable.cost}), '0')`,
        })
        .from(tasksTable)
        .where(inArray(tasksTable.projectId, projectIds))
        .groupBy(tasksTable.projectId),
      db
        .select({
          id: tasksTable.id,
          projectId: tasksTable.projectId,
          name: tasksTable.name,
          assigneeName: usersTable.name,
          assigneeImage: usersTable.image,
        })
        .from(tasksTable)
        .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
        .where(
          and(
            inArray(tasksTable.projectId, projectIds),
            inArray(tasksTable.status, inProgressStatuses)
          )
        )
        .orderBy(tasksTable.createdAt)
        .limit(3),
      db
        .select({
          projectId: projectOwnersTable.projectId,
          userId: usersTable.id,
          name: usersTable.name,
          image: usersTable.image,
        })
        .from(projectOwnersTable)
        .innerJoin(
          usersTable,
          eq(projectOwnersTable.userId, usersTable.id)
        )
        .where(inArray(projectOwnersTable.projectId, projectIds)),
      db
        .select({
          projectId: projectCollaboratorsTable.projectId,
          userId: usersTable.id,
          name: usersTable.name,
          image: usersTable.image,
        })
        .from(projectCollaboratorsTable)
        .innerJoin(
          usersTable,
          eq(projectCollaboratorsTable.userId, usersTable.id)
        )
        .where(
          inArray(projectCollaboratorsTable.projectId, projectIds)
        ),
    ])

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
    const taskCostMap = new Map<string, number>()
    for (const agg of taskCostAggs) {
      taskCostMap.set(agg.projectId, Number(agg.total))
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
      list.push({
        id: task.id,
        title: task.name,
        assignee: task.assigneeName ?? "",
        assigneeImage: task.assigneeImage,
      })
      inProgressMap.set(task.projectId, list)
    }
    const ownerMap = new Map<
      string,
      { id: string; name: string; image: string | null }[]
    >()
    for (const o of ownerData) {
      const list = ownerMap.get(o.projectId) ?? []
      if (!list.find((x) => x.id === o.userId)) {
        list.push({ id: o.userId, name: o.name ?? "", image: o.image })
      }
      ownerMap.set(o.projectId, list)
    }
    const collaboratorMap = new Map<
      string,
      { id: string; name: string; image: string | null }[]
    >()
    for (const c of collaboratorData) {
      const list = collaboratorMap.get(c.projectId) ?? []
      if (!list.find((x) => x.id === c.userId)) {
        list.push({ id: c.userId, name: c.name ?? "", image: c.image })
      }
      collaboratorMap.set(c.projectId, list)
    }

    return filteredProjects.map((p) => {
      const tasks = taskMap.get(p.id) ?? { total: 0, completed: 0 }
      const expenses =
        (expenseMap.get(p.id) ?? 0) + (taskCostMap.get(p.id) ?? 0)
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
        owners: ownerMap.get(p.id) ?? [],
        collaborators: collaboratorMap.get(p.id) ?? [],
      }
    })
  })

export const getProjectById = projectScopedAction(
  z.object({ projectId: z.uuid() })
)
  .metadata({ permission: { module: "projects", action: "view" } })
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

export type ProjectDetail = NonNullable<
  Awaited<ReturnType<typeof getProjectById>>["data"]
>

export const createProject = sessionAction
  .metadata({
    permission: { module: "projects", action: "create" },
    revalidate: ["/dashboard/projects"],
  })
  .inputSchema(createProjectSchema)
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
      .returning({ id: projectsTable.id })
    await db
      .insert(projectOwnersTable)
      .values({ projectId: created.id, userId: session.user.id })
    revalidatePath(`/dashboard/projects/${created.id}`)
    return created
  })

export const updateProject = projectScopedAction(updateProjectSchema)
  .metadata({
    permission: { module: "projects", action: "edit" },
    revalidate: ["/dashboard/projects"],
  })
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
    if (!ctx.isProjectOwner) returnActionError("FORBIDDEN")
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
      .returning({ id: projectsTable.id })
    if (!updated) returnActionError("NOT_FOUND")
    revalidatePath(`/dashboard/projects/${projectId}`)
    return updated
  })

export const getProjectForEdit = projectScopedAction(
  z.object({ projectId: z.uuid() })
)
  .metadata({ permission: { module: "projects", action: "view" } })
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

export const deleteProject = projectScopedAction(
  z.object({ projectId: z.uuid() })
)
  .metadata({
    permission: { module: "projects", action: "delete" },
    revalidate: ["/dashboard/projects"],
  })
  .action(async ({ parsedInput, ctx }) => {
    const { projectId } = parsedInput
    const project = await db
      .select({ primaryOwnerId: projectsTable.primaryOwnerId })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .then((rows) => rows[0])
    if (!project) returnActionError("NOT_FOUND")
    if (
      project.primaryOwnerId !== ctx.session.user.id &&
      !isSuperUser(ctx.session as { user: { role: string | null } })
    ) {
      returnActionError("FORBIDDEN")
    }
    await db
      .delete(projectsTable)
      .where(eq(projectsTable.id, projectId))
    revalidatePath(`/dashboard/projects/${projectId}`)
    return { success: true as const }
  })

export interface ProjectPageContext {
  project: ProjectDetail
  owners: ProjectMember[]
  collaborators: ProjectMember[]
  permissions: string[]
  session: Session
  isCurrentUserAdmin: boolean
}

export const getProjectContext = sessionAction
  .metadata({ permission: { module: "projects", action: "view" } })
  .inputSchema(z.object({ projectId: z.uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    const { projectId } = parsedInput
    const session = ctx.session
    const projectResult = await getProjectById({ projectId })
    if (projectResult.serverError?.code === "FORBIDDEN") {
      returnActionError("FORBIDDEN")
    }
    if (!projectResult.data) {
      returnActionError("NOT_FOUND")
    }
    const project = projectResult.data!
    const [owners, collaborators, permissions] = await Promise.all([
      getProjectOwners(projectId),
      getProjectCollaborators(projectId),
      getUserPermissions(session.user.id),
    ])
    return {
      project,
      owners,
      collaborators,
      permissions,
      session,
      isCurrentUserAdmin: isSuperUser(
        session as { user: { role: string | null } }
      ),
    }
  })
