import { z } from "zod"

export const productSchema = z.object({
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

export const createProductSchema = productSchema

export const updateProductSchema = productSchema.extend({
  id: z.uuid(),
})

export type ProductFormData = z.infer<typeof productSchema>
export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
