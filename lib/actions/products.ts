'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/drizzle/client'
import { productsTable, providersTable } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'
import { requirePermission } from '@/lib/auth'
import { z } from 'zod'

const productSchema = z.object({
  name: z.string().min(1, 'Name is required').transform((v) => v.trim()),
  description: z.string().transform((v) => v.trim()).optional().default(''),
  provider_id: z.string().min(1, 'Provider is required'),
  sku: z.string().transform((v) => v.trim()).optional().default(''),
  unit: z.string().transform((v) => v.trim()).optional().default(''),
})

const skuSchema = z.string().transform((v) => v.trim())

export type ProductFormData = z.infer<typeof productSchema>

export async function getProducts() {
  try {
    await requirePermission('products', 'view')
  } catch {
    throw new Error('Forbidden')
  }

  return db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      description: productsTable.description,
      provider_id: productsTable.provider_id,
      provider_name: providersTable.name,
      sku: productsTable.sku,
      unit: productsTable.unit,
    })
    .from(productsTable)
    .leftJoin(providersTable, eq(productsTable.provider_id, providersTable.id))
}

export type ProductWithProvider = Awaited<ReturnType<typeof getProducts>>[number]

export async function checkSkuExists(sku: string, excludeId?: string) {
  const skuResult = skuSchema.safeParse(sku)
  if (!skuResult.success || !skuResult.data) return { exists: false }

  try {
    await requirePermission('products', 'view')
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

export async function upsertProduct(data: ProductFormData, productId?: string) {
  try {
    await requirePermission('products', productId ? 'edit' : 'create')
  } catch {
    return { success: false, error: 'Forbidden' }
  }

  const parsed = productSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const fields = parsed.data

  if (fields.sku) {
    const skuCheck = await checkSkuExists(fields.sku, productId)
    if (skuCheck.exists) {
      return { success: false, error: 'A product with this SKU already exists', fieldErrors: { sku: ['SKU already in use'] } }
    }
  }

  const sanitized = {
    name: fields.name,
    description: fields.description || null,
    provider_id: fields.provider_id,
    sku: fields.sku || null,
    unit: fields.unit || null,
  }

  if (productId) {
    await db.update(productsTable).set(sanitized).where(eq(productsTable.id, productId))
  } else {
    await db.insert(productsTable).values(sanitized)
  }

  revalidatePath('/dashboard/products')
  return { success: true }
}

export async function deleteProduct(productId: string) {
  try {
    await requirePermission('products', 'delete')
  } catch {
    return { success: false as const, error: 'Forbidden' }
  }

  try {
    await db.delete(productsTable).where(eq(productsTable.id, productId))
  } catch {
    return { success: false as const, error: 'Cannot delete product with existing references' }
  }

  revalidatePath('/dashboard/products')
  return { success: true as const }
}
