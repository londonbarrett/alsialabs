"use server"

import { requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import { categoryTable, taxonomyTable } from "@/lib/drizzle/schema"
import { getActionT } from "@/lib/util/i18n-actions"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const categorySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .transform((v) => v.trim()),
  slug: z
    .string()
    .min(1, "Slug is required")
    .transform((v) => v.trim().toLowerCase()),
  description: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
})

const slugSchema = z.string().transform((v) => v.trim().toLowerCase())

export type CategoryFormData = z.infer<typeof categorySchema>

export async function getTaxonomies() {
  const t = await getActionT("actions.categories")
  try {
    await requirePermission("categories", "view")
  } catch {
    throw new Error(t("forbidden"))
  }

  return db.select().from(taxonomyTable).orderBy(taxonomyTable.slug)
}

export async function getCategoriesByTaxonomy(taxonomySlug: string) {
  const t = await getActionT("actions.categories")
  try {
    await requirePermission("categories", "view")
  } catch {
    throw new Error(t("forbidden"))
  }

  const slug = slugSchema.parse(taxonomySlug)

  return db
    .select({
      id: categoryTable.id,
      taxonomyId: categoryTable.taxonomyId,
      slug: categoryTable.slug,
      name: categoryTable.name,
      description: categoryTable.description,
    })
    .from(categoryTable)
    .innerJoin(
      taxonomyTable,
      eq(categoryTable.taxonomyId, taxonomyTable.id)
    )
    .where(eq(taxonomyTable.slug, slug))
    .orderBy(categoryTable.name)
}

export async function getCategoriesByTaxonomyList(
  taxonomySlug: string
) {
  const slug = slugSchema.parse(taxonomySlug)

  return db
    .select({
      id: categoryTable.id,
      slug: categoryTable.slug,
      name: categoryTable.name,
    })
    .from(categoryTable)
    .innerJoin(
      taxonomyTable,
      eq(categoryTable.taxonomyId, taxonomyTable.id)
    )
    .where(eq(taxonomyTable.slug, slug))
    .orderBy(categoryTable.name)
}

export async function checkSlugExists(
  taxonomyId: string,
  slug: string,
  excludeId?: string
) {
  const slugResult = slugSchema.safeParse(slug)
  if (!slugResult.success || !slugResult.data) return { exists: false }

  try {
    await requirePermission("categories", "view")
  } catch {
    return { exists: false }
  }

  const existing = await db
    .select({ id: categoryTable.id })
    .from(categoryTable)
    .where(
      and(
        eq(categoryTable.taxonomyId, taxonomyId),
        eq(categoryTable.slug, slugResult.data)
      )
    )

  if (existing.length === 0) return { exists: false }
  if (excludeId) return { exists: existing[0].id !== excludeId }
  return { exists: true }
}

export async function upsertCategory(
  data: CategoryFormData,
  taxonomyId: string,
  id?: string
) {
  const t = await getActionT("actions.categories")
  try {
    await requirePermission("categories", id ? "edit" : "create")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  const parsed = categorySchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false as const,
      error: t("validationFailed"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const { name, slug, description } = parsed.data

  if (id) {
    await db
      .update(categoryTable)
      .set({ name, slug, description })
      .where(eq(categoryTable.id, id))
  } else {
    await db
      .insert(categoryTable)
      .values({ taxonomyId, name, slug, description })
  }

  revalidatePath("/dashboard/categories")
  return { success: true as const }
}

export async function deleteCategory(id: string) {
  const t = await getActionT("actions.categories")
  try {
    await requirePermission("categories", "delete")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  await db.delete(categoryTable).where(eq(categoryTable.id, id))
  revalidatePath("/dashboard/categories")
  return { success: true as const }
}
