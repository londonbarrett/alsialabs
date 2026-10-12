"use server"

import { db } from "@/lib/drizzle/client"
import { categoryTable, taxonomyTable } from "@/lib/drizzle/schema"
import { returnActionError, sessionAction } from "@/lib/safe-action"
import {
  CategoryDetailSchema,
  CategoryOptionSchema,
  CreateCategorySchema,
  SlugSchema,
  TaxonomySchema,
  UpdateCategorySchema,
} from "@/actions/schemas/category"
import { ExistsSchema, IdSchema, SuccessSchema } from "@/actions/schemas/common"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

// ---------- Query actions ----------

export const getTaxonomies = sessionAction
  .metadata({
    permission: { module: "categories", action: "view" },
  })
  .outputSchema(z.array(TaxonomySchema))
  .action(async () => {
    return db.select().from(taxonomyTable).orderBy(taxonomyTable.slug)
  })

export const getCategoriesByTaxonomy = sessionAction
  .metadata({
    permission: { module: "categories", action: "view" },
  })
  .inputSchema(z.object({ taxonomySlug: z.string() }))
  .outputSchema(z.array(CategoryDetailSchema))
  .action(async ({ parsedInput }) => {
    const slug = SlugSchema.parse(parsedInput.taxonomySlug)

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

export const getCategoriesByTaxonomyList = sessionAction
  .metadata({
    permission: { module: "categories", action: "view" },
  })
  .inputSchema(z.object({ taxonomySlug: z.string() }))
  .outputSchema(z.array(CategoryOptionSchema))
  .action(async ({ parsedInput }) => {
    const slug = SlugSchema.parse(parsedInput.taxonomySlug)

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

export const getProjectCategories = sessionAction
  .metadata({})
  .outputSchema(z.array(CategoryOptionSchema))
  .action(async () => {
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
      .where(eq(taxonomyTable.slug, "project"))
      .orderBy(categoryTable.name)
  })

export const checkSlugExists = sessionAction
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
  .outputSchema(ExistsSchema)
  .action(async ({ parsedInput }) => {
    const { taxonomyId, slug, excludeId } = parsedInput
    const slugResult = SlugSchema.safeParse(slug)
    if (!slugResult.success || !slugResult.data)
      return { exists: false }

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

export const createCategory = sessionAction
  .metadata({
    permission: { module: "categories", action: "create" },
    revalidate: ["/app/categorias"],
  })
  .inputSchema(CreateCategorySchema)
  .outputSchema(CategoryDetailSchema)
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

export const updateCategory = sessionAction
  .metadata({
    permission: { module: "categories", action: "edit" },
    revalidate: ["/app/categorias"],
  })
  .inputSchema(UpdateCategorySchema)
  .outputSchema(CategoryDetailSchema)
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

export const deleteCategory = sessionAction
  .metadata({
    permission: { module: "categories", action: "delete" },
    revalidate: ["/app/categorias"],
  })
  .inputSchema(IdSchema)
  .outputSchema(SuccessSchema)
  .action(async ({ parsedInput }) => {
    const [deleted] = await db
      .delete(categoryTable)
      .where(eq(categoryTable.id, parsedInput.id))
      .returning({ id: categoryTable.id })

    if (!deleted) {
      returnActionError("NOT_FOUND")
    }

    return { success: true }
  })
