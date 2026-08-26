"use server"

import { db } from "@/lib/drizzle/client"
import { categoryTable, taxonomyTable } from "@/lib/drizzle/schema"
import { basicAction } from "@/lib/safe-action"
import { categorySchema } from "@/lib/schemas/category"
import { returnActionError } from "@/lib/safe-action"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

const slugSchema = z.string().transform((v) => v.trim().toLowerCase())

// ---------- Query actions ----------

export const getTaxonomies = basicAction
  .metadata({
    permission: { module: "categories", action: "view" },
  })
  .action(async () => {
    return db.select().from(taxonomyTable).orderBy(taxonomyTable.slug)
  })

export const getCategoriesByTaxonomy = basicAction
  .metadata({
    permission: { module: "categories", action: "view" },
  })
  .inputSchema(z.object({ taxonomySlug: z.string() }))
  .action(async ({ parsedInput }) => {
    const slug = slugSchema.parse(parsedInput.taxonomySlug)

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
  })

export const getCategoriesByTaxonomyList = basicAction
  .metadata({
    permission: { module: "categories", action: "view" },
  })
  .inputSchema(z.object({ taxonomySlug: z.string() }))
  .action(async ({ parsedInput }) => {
    const slug = slugSchema.parse(parsedInput.taxonomySlug)

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
  })

export const checkSlugExists = basicAction
  .metadata({
    permission: { module: "categories", action: "view" },
  })
  .inputSchema(
    z.object({
      taxonomyId: z.string(),
      slug: z.string(),
      excludeId: z.string().optional(),
    })
  )
  .action(async ({ parsedInput }) => {
    const { taxonomyId, slug, excludeId } = parsedInput
    const slugResult = slugSchema.safeParse(slug)
    if (!slugResult.success || !slugResult.data) return { exists: false }

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
  })

// ---------- Mutation actions ----------

export const createCategory = basicAction
  .metadata({
    permission: { module: "categories", action: "create" },
    revalidate: ["/dashboard/categories"],
  })
  .inputSchema(
    categorySchema.extend({
      taxonomyId: z.string().min(1),
    })
  )
  .action(async ({ parsedInput }) => {
    const { name, slug, description, taxonomyId } = parsedInput

    const [created] = await db
      .insert(categoryTable)
      .values({ taxonomyId, name, slug, description })
      .returning({
        id: categoryTable.id,
        name: categoryTable.name,
        slug: categoryTable.slug,
        description: categoryTable.description,
        taxonomyId: categoryTable.taxonomyId,
      })

    return created
  })

export const updateCategory = basicAction
  .metadata({
    permission: { module: "categories", action: "edit" },
    revalidate: ["/dashboard/categories"],
  })
  .inputSchema(
    categorySchema.extend({
      id: z.string().uuid(),
    })
  )
  .action(async ({ parsedInput }) => {
    const { name, slug, description, id } = parsedInput

    const [updated] = await db
      .update(categoryTable)
      .set({ name, slug, description })
      .where(eq(categoryTable.id, id))
      .returning({
        id: categoryTable.id,
        name: categoryTable.name,
        slug: categoryTable.slug,
        description: categoryTable.description,
        taxonomyId: categoryTable.taxonomyId,
      })

    if (!updated) {
      returnActionError("NOT_FOUND")
    }

    return updated
  })

export const deleteCategory = basicAction
  .metadata({
    permission: { module: "categories", action: "delete" },
    revalidate: ["/dashboard/categories"],
  })
  .inputSchema(z.object({ id: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    const [deleted] = await db
      .delete(categoryTable)
      .where(eq(categoryTable.id, parsedInput.id))
      .returning({ id: categoryTable.id })

    if (!deleted) {
      returnActionError("NOT_FOUND")
    }
  })
