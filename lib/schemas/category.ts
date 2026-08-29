import { z } from "zod"

export const categorySchema = z.object({
  name: z.string().min(1, { message: "NAME_REQUIRED" })
    .transform((v) => v.trim()),
  slug: z.string().min(1, { message: "SLUG_REQUIRED" })
    .transform((v) => v.trim().toLowerCase()),
  description: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
})

export const createCategorySchema = categorySchema

export const updateCategorySchema = categorySchema

export type CategoryFormData = z.infer<typeof categorySchema>
