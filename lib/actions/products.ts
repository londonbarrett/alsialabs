"use server"

import { db } from "@/lib/drizzle/client"
import { productsTable, storesTable } from "@/lib/drizzle/schema"
import {
  basicAction,
  storeAction,
  returnActionError,
} from "@/lib/safe-action"
import { productSchema } from "@/lib/schemas/product"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

// ---------- Query actions ----------

export const getProducts = storeAction
  .metadata({
    permission: { module: "products", action: "view" },
  })
  .action(async ({ ctx }) => {
    return db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        description: productsTable.description,
        store_id: productsTable.store_id,
        store_name: storesTable.name,
        sku: productsTable.sku,
        unit: productsTable.unit,
      })
      .from(productsTable)
      .leftJoin(storesTable, eq(productsTable.store_id, storesTable.id))
      .where(eq(productsTable.store_id, ctx.storeId))
  })

export type ProductWithStore = {
  id: string
  name: string
  description: string | null
  store_id: string
  store_name: string | null
  sku: string | null
  unit: string | null
}

export const checkSkuExists = basicAction
  .metadata({
    permission: { module: "products", action: "view" },
  })
  .inputSchema(
    z.object({
      sku: z.string().transform((v) => v.trim()),
      excludeId: z.string().optional(),
    })
  )
  .action(async ({ parsedInput }) => {
    const { sku, excludeId } = parsedInput
    if (!sku) return { exists: false }

    const existing = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(eq(productsTable.sku, sku))

    if (existing.length === 0) return { exists: false }
    if (excludeId) return { exists: existing[0].id !== excludeId }
    return { exists: true }
  })

// ---------- Mutation actions ----------

export const createProduct = basicAction
  .metadata({
    permission: { module: "products", action: "create" },
    revalidate: ["/dashboard/products"],
  })
  .inputSchema(productSchema)
  .action(async ({ parsedInput }) => {
    const { name, description, store_id, sku, unit } = parsedInput

    const [created] = await db
      .insert(productsTable)
      .values({
        name,
        description: description || null,
        store_id,
        sku: sku || null,
        unit: unit || null,
      })
      .returning({
        id: productsTable.id,
        name: productsTable.name,
        description: productsTable.description,
        store_id: productsTable.store_id,
        sku: productsTable.sku,
        unit: productsTable.unit,
      })

    return created
  })

export const updateProduct = storeAction
  .metadata({
    permission: { module: "products", action: "edit" },
    revalidate: ["/dashboard/products"],
  })
  .inputSchema(productSchema.extend({ id: z.string().uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    const { id, name, description, store_id, sku, unit } = parsedInput

    const [updated] = await db
      .update(productsTable)
      .set({
        name,
        description: description || null,
        store_id,
        sku: sku || null,
        unit: unit || null,
      })
      .where(
        and(
          eq(productsTable.id, id),
          eq(productsTable.store_id, ctx.storeId)
        )
      )
      .returning({
        id: productsTable.id,
        name: productsTable.name,
        description: productsTable.description,
        store_id: productsTable.store_id,
        sku: productsTable.sku,
        unit: productsTable.unit,
      })

    if (!updated) {
      returnActionError("NOT_FOUND")
    }

    return updated
  })

export const deleteProduct = storeAction
  .metadata({
    permission: { module: "products", action: "delete" },
    revalidate: ["/dashboard/products"],
  })
  .inputSchema(z.object({ id: z.uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    let deleted: { id: string } | undefined
    try {
      const result = await db
        .delete(productsTable)
        .where(
          and(
            eq(productsTable.id, parsedInput.id),
            eq(productsTable.store_id, ctx.storeId)
          )
        )
        .returning({ id: productsTable.id })

      deleted = result[0]
    } catch {
      returnActionError("REFERENCE_EXISTS")
    }

    if (!deleted) {
      returnActionError("NOT_FOUND")
    }
  })
