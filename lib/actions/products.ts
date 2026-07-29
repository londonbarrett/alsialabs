"use server"

import { getEffectiveStoreId } from "@/lib/actions/stores"
import { requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import { productsTable, storesTable } from "@/lib/drizzle/schema"
import { getActionT } from "@/lib/i18n-actions"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const productSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .transform((v) => v.trim()),
  description: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
  store_id: z.string().min(1, "Store is required"),
  sku: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
  unit: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
})

const skuSchema = z.string().transform((v) => v.trim())

export type ProductFormData = z.infer<typeof productSchema>

export async function getProducts() {
  const t = await getActionT("actions.products")
  try {
    await requirePermission("products", "view")
  } catch {
    throw new Error(t("forbidden"))
  }

  const storeId = await getEffectiveStoreId()

  const query = db
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

  return storeId
    ? query.where(eq(productsTable.store_id, storeId))
    : query
}

export type ProductWithStore = Awaited<
  ReturnType<typeof getProducts>
>[number]

export async function checkSkuExists(sku: string, excludeId?: string) {
  const skuResult = skuSchema.safeParse(sku)
  if (!skuResult.success || !skuResult.data) return { exists: false }

  try {
    await requirePermission("products", "view")
  } catch {
    return { exists: false }
  }

  const existing = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(eq(productsTable.sku, sku))

  if (existing.length === 0) return { exists: false }
  if (excludeId) return { exists: existing[0].id !== excludeId }
  return { exists: true }
}

export async function upsertProduct(
  data: ProductFormData,
  productId?: string
) {
  const t = await getActionT("actions.products")
  try {
    await requirePermission("products", productId ? "edit" : "create")
  } catch {
    return { success: false, error: t("forbidden") }
  }

  const parsed = productSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: t("validationFailed"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const fields = parsed.data

  if (fields.sku) {
    const skuCheck = await checkSkuExists(fields.sku, productId)
    if (skuCheck.exists) {
      return {
        success: false,
        error: t("skuAlreadyExists"),
        fieldErrors: { sku: [t("skuAlreadyInUseField")] },
      }
    }
  }

  const sanitized = {
    name: fields.name,
    description: fields.description || null,
    store_id: fields.store_id,
    sku: fields.sku || null,
    unit: fields.unit || null,
  }

  const storeId = await getEffectiveStoreId()

  if (productId) {
    const conditions = [eq(productsTable.id, productId)]
    if (storeId) {
      conditions.push(eq(productsTable.store_id, storeId))
    }
    await db
      .update(productsTable)
      .set(sanitized)
      .where(and(...conditions))
  } else {
    await db.insert(productsTable).values(sanitized)
  }

  revalidatePath("/dashboard/products")
  return { success: true }
}

export async function deleteProduct(productId: string) {
  const t = await getActionT("actions.products")
  try {
    await requirePermission("products", "delete")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  const storeId = await getEffectiveStoreId()
  const conditions = [eq(productsTable.id, productId)]
  if (storeId) {
    conditions.push(eq(productsTable.store_id, storeId))
  }

  try {
    await db.delete(productsTable).where(and(...conditions))
  } catch {
    return {
      success: false as const,
      error: t("cannotDeleteWithReferences"),
    }
  }

  revalidatePath("/dashboard/products")
  return { success: true as const }
}
