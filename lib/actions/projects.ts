'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/drizzle/client'
import {
  projectsTable,
  projectCategoriesTable,
  clientsTable,
  projectTasksTable,
  expensesTable,
  collaboratorsTable,
} from '@/lib/drizzle/schema'
import { eq, and, desc, inArray, sql } from 'drizzle-orm'
import { requirePermission, auth } from '@/lib/auth'
import { z } from 'zod'
import { getActionT } from '@/lib/i18n-actions'
import type { Project } from '@/lib/project-config'

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

async function getOwnClientId(sessionUserId: string) {
  const client = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(eq(clientsTable.userId, sessionUserId))
    .then((rows) => rows[0])
  return client?.id ?? null
}

async function getClientScope(sessionUserId: string, role: string | null) {
  if (role !== 'client') return null
  return getOwnClientId(sessionUserId)
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
  const clientId = await getClientScope(session?.user?.id ?? '', session?.user?.role ?? null)

  const conditions: ReturnType<typeof eq>[] = []
  if (clientId) {
    conditions.push(eq(projectsTable.clientId, clientId))
  }

  return db
    .select({
      id: projectsTable.id,
      clientId: projectsTable.clientId,
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
    .where(and(...conditions))
    .leftJoin(projectCategoriesTable, eq(projectsTable.categoryId, projectCategoriesTable.id))
    .orderBy(desc(projectsTable.createdAt))
}

export async function getProjectsWithDetails() {
  const t = await getActionT('actions.projects')
  try {
    await requirePermission('projects', 'view')
  } catch {
    throw new Error(t('forbidden'))
  }

  const session = await auth()
  const clientId = await getClientScope(session?.user?.id ?? '', session?.user?.role ?? null)

  const conditions: ReturnType<typeof eq>[] = []
  if (clientId) {
    conditions.push(eq(projectsTable.clientId, clientId))
  }

  const baseProjects = await db
    .select({
      id: projectsTable.id,
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
    .where(and(...conditions))
    .leftJoin(projectCategoriesTable, eq(projectsTable.categoryId, projectCategoriesTable.id))
    .orderBy(desc(projectsTable.createdAt))

  const projectIds = baseProjects.map((p) => p.id)
  if (projectIds.length === 0) return []

  const inProgressStatuses = ['in_progress', 'in_review', 'blocked'] as const

  const [taskAggs, expenseAggs, inProgressTasks, collaboratorData] = await Promise.all([
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
        collaboratorName: collaboratorsTable.name,
      })
      .from(projectTasksTable)
      .leftJoin(collaboratorsTable, eq(projectTasksTable.collaboratorId, collaboratorsTable.id))
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
        id: collaboratorsTable.id,
        projectId: projectTasksTable.projectId,
        name: collaboratorsTable.name,
      })
      .from(collaboratorsTable)
      .innerJoin(projectTasksTable, eq(projectTasksTable.collaboratorId, collaboratorsTable.id))
      .where(inArray(projectTasksTable.projectId, projectIds)),
  ])

  const taskMap = new Map<string, { total: number; completed: number }>()
  for (const agg of taskAggs) {
    taskMap.set(agg.projectId, { total: agg.total, completed: agg.completed })
  }

  const expenseMap = new Map<string, number>()
  for (const agg of expenseAggs) {
    expenseMap.set(agg.projectId, Number(agg.total))
  }

  const inProgressMap = new Map<string, { id: string; title: string; assignee: string }[]>()
  for (const task of inProgressTasks) {
    const list = inProgressMap.get(task.projectId) ?? []
    list.push({
      id: task.id,
      title: task.name,
      assignee: task.collaboratorName ?? '',
    })
    inProgressMap.set(task.projectId, list)
  }

  const collaboratorMap = new Map<string, { id: string; name: string }[]>()
  for (const c of collaboratorData) {
    const list = collaboratorMap.get(c.projectId) ?? []
    if (!list.find((x) => x.id === c.id)) {
      list.push({ id: c.id, name: c.name })
    }
    collaboratorMap.set(c.projectId, list)
  }

  return baseProjects.map((p) => {
    const tasks = taskMap.get(p.id) ?? { total: 0, completed: 0 }
    const expenses = expenseMap.get(p.id) ?? 0
    const budget = p.budget ? Number(p.budget) : 0

    return {
      id: p.id,
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
      collaborators: collaboratorMap.get(p.id) ?? [],
    } satisfies Project
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
  const clientId = await getClientScope(session?.user?.id ?? '', session?.user?.role ?? null)

  const conditions: ReturnType<typeof eq>[] = [eq(projectsTable.id, id)]
  if (clientId) {
    conditions.push(eq(projectsTable.clientId, clientId))
  }

  const project = await db
    .select({
      id: projectsTable.id,
      clientId: projectsTable.clientId,
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
    .where(and(...conditions))
    .leftJoin(projectCategoriesTable, eq(projectsTable.categoryId, projectCategoriesTable.id))
    .then((rows) => rows[0])

  if (!project) {
    throw new Error('notFound')
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
    const clientId = await getClientScope(session.user.id, session.user.role ?? null)
    const conditions = [eq(projectsTable.id, id)]
    if (clientId) {
      conditions.push(eq(projectsTable.clientId, clientId))
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
      .where(and(...conditions))
  } else {
    const clientId = session.user.role === 'client'
      ? await getOwnClientId(session.user.id)
      : null

    if (!clientId) return { success: false as const, error: t('forbidden') }

    await db.insert(projectsTable).values({
      clientId,
      categoryId,
      name,
      status,
      description: description || null,
      startDate,
      endDate: endDate || null,
      location: location || null,
      budget: budget ? budget : null,
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
  const clientId = await getClientScope(session?.user?.id ?? '', session?.user?.role ?? null)

  const conditions = [eq(projectsTable.id, id)]
  if (clientId) {
    conditions.push(eq(projectsTable.clientId, clientId))
  }

  const project = await db
    .select({
      id: projectsTable.id,
      clientId: projectsTable.clientId,
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
    .where(and(...conditions))
    .then((rows) => rows[0])

  if (!project) {
    throw new Error('notFound')
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
  const clientId = await getClientScope(session?.user?.id ?? '', session?.user?.role ?? null)

  const conditions = [eq(projectsTable.id, id)]
  if (clientId) {
    conditions.push(eq(projectsTable.clientId, clientId))
  }

  await db.delete(projectsTable).where(and(...conditions))
  revalidatePath('/dashboard/projects')
  return { success: true as const }
}
