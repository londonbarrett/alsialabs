import { z } from "zod"

export const ProductSchema = z.object({
  name: z.string().min(1, { message: "NAME_REQUIRED" })
    .transform((v) => v.trim()),
  description: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
  store_id: z.string().min(1, { message: "STORE_REQUIRED" }),
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

export const CreateProductSchema = ProductSchema

export const UpdateProductSchema = ProductSchema.extend({
  id: z.uuid(),
})

export type ProductDTO = z.infer<typeof ProductSchema>
export type CreateProductDTO = z.infer<typeof CreateProductSchema>
export type UpdateProductDTO = z.infer<typeof UpdateProductSchema>

// ---------- Response schemas ----------

export const ProductRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  store_id: z.string(),
  sku: z.string().nullable(),
  unit: z.string().nullable(),
})

export const ProductWithStoreSchema = ProductRecordSchema.extend({
  store_name: z.string().nullable(),
})

export type ProductRecordDTO = z.infer<typeof ProductRecordSchema>
export type ProductWithStoreDTO = z.infer<typeof ProductWithStoreSchema>
