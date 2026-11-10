import { z } from "zod"

/** Normalises a raw slug/taxonomy-slug input before it is queried. */
export const SlugSchema = z
  .string()
  .transform((v) => v.trim().toLowerCase())

export const CategorySchema = z.object({
  name: z
    .string()
    .min(1, { message: "NAME_REQUIRED" })
    .transform((v) => v.trim()),
  slug: z
    .string()
    .min(1, { message: "SLUG_REQUIRED" })
    .transform((v) => v.trim().toLowerCase()),
  description: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
})

export const CreateCategorySchema = CategorySchema.extend({
  taxonomyId: z.string().min(1),
})

export const UpdateCategorySchema = CategorySchema.extend({
  id: z.uuid(),
})

export type CategoryDTO = z.infer<typeof CategorySchema>
export type CreateCategoryDTO = z.infer<typeof CreateCategorySchema>
export type UpdateCategoryDTO = z.infer<typeof UpdateCategorySchema>

// ---------- Response schemas ----------

export const TaxonomySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
})

export const CategoryOptionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
})

export const CategoryDetailSchema = CategoryOptionSchema.extend({
  taxonomyId: z.string(),
  description: z.string().nullable(),
})

export type TaxonomyDTO = z.infer<typeof TaxonomySchema>
export type CategoryOptionDTO = z.infer<typeof CategoryOptionSchema>
export type CategoryDetailDTO = z.infer<typeof CategoryDetailSchema>
