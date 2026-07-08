'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/drizzle/client'
import { projectCategoriesTable } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'
import { requirePermission } from '@/lib/auth'
import { z } from 'zod'
import { getActionT } from '@/lib/i18n-actions'

const categorySchema = z.object({
  slug: z.string().min(1, 'Slug is required').transform((v) => v.trim().toLowerCase()),
  description: z.string().transform((v) => v.trim()).optional().default(''),
})

const slugSchema = z.string().transform((v) => v.trim().toLowerCase())

export type ProjectCategoryFormData = z.infer<typeof categorySchema>

export async function getProjectCategories() {
  const t = await getActionT('actions.categories')
  try {
    await requirePermission('categories', 'view')
  } catch {
    throw new Error(t('forbidden'))
  }

  return db.select().from(projectCategoriesTable).orderBy(projectCategoriesTable.slug)
}

export async function checkSlugExists(slug: string, excludeId?: string) {
  const slugResult = slugSchema.safeParse(slug)
  if (!slugResult.success || !slugResult.data) return { exists: false }

  try {
    await requirePermission('categories', 'view')
  } catch {
    return { exists: false }
  }

  const existing = await db
    .select({ id: projectCategoriesTable.id })
    .from(projectCategoriesTable)
    .where(eq(projectCategoriesTable.slug, slugResult.data))

  if (existing.length === 0) return { exists: false }
  if (excludeId) return { exists: existing[0].id !== excludeId }
  return { exists: true }
}

export async function upsertProjectCategory(data: ProjectCategoryFormData, id?: string) {
  const t = await getActionT('actions.categories')
  try {
    await requirePermission('categories', id ? 'edit' : 'create')
  } catch {
    return { success: false as const, error: t('forbidden') }
  }

  const parsed = categorySchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false as const,
      error: t('validationFailed'),
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const { slug, description } = parsed.data

  if (id) {
    await db
      .update(projectCategoriesTable)
      .set({ slug, description })
      .where(eq(projectCategoriesTable.id, id))
  } else {
    await db.insert(projectCategoriesTable).values({ slug, description })
  }

  revalidatePath('/dashboard/categories')
  return { success: true as const }
}

export async function deleteProjectCategory(id: string) {
  const t = await getActionT('actions.categories')
  try {
    await requirePermission('categories', 'delete')
  } catch {
    return { success: false as const, error: t('forbidden') }
  }

  await db.delete(projectCategoriesTable).where(eq(projectCategoriesTable.id, id))
  revalidatePath('/dashboard/categories')
  return { success: true as const }
}
