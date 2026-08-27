import { z } from "zod"

export const productSchema = z.object({
  name: z
    .string()
    .min(1, "NAME_REQUIRED")
    .transform((v) => v.trim()),
  description: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
  store_id: z.string().min(1, "STORE_REQUIRED"),
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
  id: z.string().uuid(),
})

export type ProductFormData = z.infer<typeof productSchema>
