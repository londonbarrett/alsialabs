'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/drizzle/client'
import {
  projectsTable,
  projectCategoriesTable,
  projectTasksTable,
  expensesTable,
  projectOwnersTable,
  projectCollaboratorsTable,
  usersTable,
} from '@/lib/drizzle/schema'
import { eq, and, desc, inArray, sql } from 'drizzle-orm'
import { requirePermission, auth, isSuperUser } from '@/lib/auth'
import { z } from 'zod'
import { getActionT } from '@/lib/i18n-actions'

const projectSchema = z.object({
  name: z.string().min(1, 'Name is required').transform((v) => v.trim()),
  categoryId: z.string().min(1, 'Category is required'),
  status: z.enum(['active', 'completed', 'cancelled', 'archived']).optional().default('active'),
  description: z.string().transform((v) => v.trim()).optional().default(''),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional().default(''),
  location: z.string().min(1, 'Location is required').transform((v) => v.trim()),
  budget: z.string().optional().default(''),
})

export type ProjectFormData = z.infer<typeof projectSchema>

async function getUserProjectIds(userId: string): Promise<string[]> {
  const [owned, collaborated] = await Promise.all([
    db
      .select({ projectId: projectOwnersTable.projectId })
      .from(projectOwnersTable)
      .where(eq(projectOwnersTable.userId, userId)),
    db
      .select({ projectId: projectCollaboratorsTable.projectId })
      .from(projectCollaboratorsTable)
      .where(eq(projectCollaboratorsTable.userId, userId)),
  ])

  const ids = new Set<string>()
  for (const row of owned) ids.add(row.projectId)
  for (const row of collaborated) ids.add(row.projectId)
  return Array.from(ids)
}

async function isProjectOwner(projectId: string, userId: string): Promise<boolean> {
  const owner = await db
    .select()
    .from(projectOwnersTable)
    .where(
      and(
        eq(projectOwnersTable.projectId, projectId),
        eq(projectOwnersTable.userId, userId)
      )
    )
    .then((rows) => rows[0])
  return !!owner
}

export type ProjectWithCategory = Awaited<ReturnType<typeof getProjects>>[number]

export async function getProjects() {
  const t = await getActionT('actions.projects')
  try {
    await requirePermission('projects', 'view')
  } catch {
    throw new Error(t('forbidden'))
  }

  const session = await auth()
  if (!session?.user) throw new Error(t('unauthorized'))

  const isAdmin = isSuperUser(session)

  const projects = await db
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
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
      categorySlug: projectCategoriesTable.slug,
    })
    .from(projectsTable)
    .leftJoin(projectCategoriesTable, eq(projectsTable.categoryId, projectCategoriesTable.id))
    .orderBy(desc(projectsTable.createdAt))

  if (isAdmin) return projects

  const userProjectIds = await getUserProjectIds(session.user.id)
  if (userProjectIds.length === 0) return []

  return projects.filter((p) => userProjectIds.includes(p.id))
}

export async function getProjectsWithDetails() {
  const t = await getActionT('actions.projects')
  try {
    await requirePermission('projects', 'view')
  } catch {
    throw new Error(t('forbidden'))
  }

  const session = await auth()
  if (!session?.user) throw new Error(t('unauthorized'))

  const isAdmin = isSuperUser(session)

  const baseProjects = await db
    .select({
      id: projectsTable.id,
      primaryOwnerId: projectsTable.primaryOwnerId,
      name: projectsTable.name,
      description: projectsTable.description,
      status: projectsTable.status,
      startDate: projectsTable.startDate,
      endDate: projectsTable.endDate,
      location: projectsTable.location,
      budget: projectsTable.budget,
      categorySlug: projectCategoriesTable.slug,
    })
    .from(projectsTable)
    .leftJoin(projectCategoriesTable, eq(projectsTable.categoryId, projectCategoriesTable.id))
    .orderBy(desc(projectsTable.createdAt))

  let filteredProjects = baseProjects
  if (!isAdmin) {
    const userProjectIds = await getUserProjectIds(session.user.id)
    filteredProjects = baseProjects.filter((p) => userProjectIds.includes(p.id))
  }

  const projectIds = filteredProjects.map((p) => p.id)
  if (projectIds.length === 0) return []

  const inProgressStatuses = ['in_progress', 'in_review', 'blocked'] as const

  const [taskAggs, expenseAggs, inProgressTasks, ownerData, collaboratorData] = await Promise.all([
    db
      .select({
        projectId: projectTasksTable.projectId,
        total: sql<number>`count(*)`,
        completed: sql<number>`count(*) filter (where ${projectTasksTable.status} = 'done')`,
      })
      .from(projectTasksTable)
      .where(inArray(projectTasksTable.projectId, projectIds))
      .groupBy(projectTasksTable.projectId),

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
        id: projectTasksTable.id,
        projectId: projectTasksTable.projectId,
        name: projectTasksTable.name,
        assigneeName: usersTable.name,
        assigneeImage: usersTable.image,
      })
      .from(projectTasksTable)
      .leftJoin(usersTable, eq(projectTasksTable.assigneeId, usersTable.id))
      .where(
        and(
          inArray(projectTasksTable.projectId, projectIds),
          inArray(projectTasksTable.status, inProgressStatuses),
        ),
      )
      .orderBy(projectTasksTable.createdAt)
      .limit(3),

    db
      .select({
        projectId: projectOwnersTable.projectId,
        userId: usersTable.id,
        name: usersTable.name,
        image: usersTable.image,
      })
      .from(projectOwnersTable)
      .innerJoin(usersTable, eq(projectOwnersTable.userId, usersTable.id))
      .where(inArray(projectOwnersTable.projectId, projectIds)),

    db
      .select({
        projectId: projectCollaboratorsTable.projectId,
        userId: usersTable.id,
        name: usersTable.name,
        image: usersTable.image,
      })
      .from(projectCollaboratorsTable)
      .innerJoin(usersTable, eq(projectCollaboratorsTable.userId, usersTable.id))
      .where(inArray(projectCollaboratorsTable.projectId, projectIds)),
  ])

  const taskMap = new Map<string, { total: number; completed: number }>()
  for (const agg of taskAggs) {
    taskMap.set(agg.projectId, { total: agg.total, completed: agg.completed })
  }

  const expenseMap = new Map<string, number>()
  for (const agg of expenseAggs) {
    expenseMap.set(agg.projectId, Number(agg.total))
  }

  const inProgressMap = new Map<string, { id: string; title: string; assignee: string; assigneeImage: string | null }[]>()
  for (const task of inProgressTasks) {
    const list = inProgressMap.get(task.projectId) ?? []
    list.push({
      id: task.id,
      title: task.name,
      assignee: task.assigneeName ?? '',
      assigneeImage: task.assigneeImage,
    })
    inProgressMap.set(task.projectId, list)
  }

  const ownerMap = new Map<string, { id: string; name: string; image: string | null }[]>()
  for (const o of ownerData) {
    const list = ownerMap.get(o.projectId) ?? []
    if (!list.find((x) => x.id === o.userId)) {
      list.push({ id: o.userId, name: o.name ?? '', image: o.image })
    }
    ownerMap.set(o.projectId, list)
  }

  const collaboratorMap = new Map<string, { id: string; name: string; image: string | null }[]>()
  for (const c of collaboratorData) {
    const list = collaboratorMap.get(c.projectId) ?? []
    if (!list.find((x) => x.id === c.userId)) {
      list.push({ id: c.userId, name: c.name ?? '', image: c.image })
    }
    collaboratorMap.set(c.projectId, list)
  }

  return filteredProjects.map((p) => {
    const tasks = taskMap.get(p.id) ?? { total: 0, completed: 0 }
    const expenses = expenseMap.get(p.id) ?? 0
    const budget = p.budget ? Number(p.budget) : 0

    return {
      id: p.id,
      primaryOwnerId: p.primaryOwnerId,
      name: p.name,
      description: p.description,
      status: p.status,
      category: p.categorySlug ?? '—',
      startDate: p.startDate,
      endDate: p.endDate ?? '',
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
}

export async function getProjectById(id: string) {
  const t = await getActionT('actions.projects')
  try {
    await requirePermission('projects', 'view')
  } catch {
    throw new Error(t('forbidden'))
  }

  const session = await auth()
  if (!session?.user) throw new Error(t('unauthorized'))

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
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
      categorySlug: projectCategoriesTable.slug,
    })
    .from(projectsTable)
    .where(eq(projectsTable.id, id))
    .leftJoin(projectCategoriesTable, eq(projectsTable.categoryId, projectCategoriesTable.id))
    .then((rows) => rows[0])

  if (!project) {
    throw new Error('notFound')
  }

  if (!isSuperUser(session) && !(await isProjectOwner(id, session.user.id))) {
    const isCollaborator = await db
      .select()
      .from(projectCollaboratorsTable)
      .where(
        and(
          eq(projectCollaboratorsTable.projectId, id),
          eq(projectCollaboratorsTable.userId, session.user.id)
        )
      )
      .then((rows) => rows[0])

    if (!isCollaborator) throw new Error(t('forbidden'))
  }

  return project
}

export async function upsertProject(data: ProjectFormData, id?: string) {
  const t = await getActionT('actions.projects')
  try {
    await requirePermission('projects', id ? 'edit' : 'create')
  } catch {
    return { success: false as const, error: t('forbidden') }
  }

  const session = await auth()
  if (!session?.user) return { success: false as const, error: t('unauthorized') }

  const parsed = projectSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false as const,
      error: t('validationFailed'),
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const { name, categoryId, status, description, startDate, endDate, location, budget } = parsed.data

  if (id) {
    if (!(await isProjectOwner(id, session.user.id)) && !isSuperUser(session)) {
      return { success: false as const, error: t('forbidden') }
    }

    await db
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
      })
      .where(eq(projectsTable.id, id))
  } else {
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
      })
      .returning({ id: projectsTable.id })

    await db.insert(projectOwnersTable).values({
      projectId: created.id,
      userId: session.user.id,
    })
  }

  revalidatePath('/dashboard/projects')
  return { success: true as const }
}

export async function getProjectForEdit(id: string) {
  const t = await getActionT('actions.projects')
  try {
    await requirePermission('projects', 'view')
  } catch {
    throw new Error(t('forbidden'))
  }

  const session = await auth()
  if (!session?.user) throw new Error(t('unauthorized'))

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
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
    })
    .from(projectsTable)
    .where(eq(projectsTable.id, id))
    .then((rows) => rows[0])

  if (!project) {
    throw new Error('notFound')
  }

  if (!isSuperUser(session) && !(await isProjectOwner(id, session.user.id))) {
    throw new Error(t('forbidden'))
  }

  return project
}

export async function deleteProject(id: string) {
  const t = await getActionT('actions.projects')
  try {
    await requirePermission('projects', 'delete')
  } catch {
    return { success: false as const, error: t('forbidden') }
  }

  const session = await auth()
  if (!session?.user) return { success: false as const, error: t('unauthorized') }

  const project = await db
    .select({ primaryOwnerId: projectsTable.primaryOwnerId })
    .from(projectsTable)
    .where(eq(projectsTable.id, id))
    .then((rows) => rows[0])

  if (!project) return { success: false as const, error: t('notFound') }

  if (project.primaryOwnerId !== session.user.id && !isSuperUser(session)) {
    return { success: false as const, error: t('forbidden') }
  }

  await db.delete(projectsTable).where(eq(projectsTable.id, id))
  revalidatePath('/dashboard/projects')
  return { success: true as const }
}
