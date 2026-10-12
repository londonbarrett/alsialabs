import { z } from "zod"

export const ExpenseSchema = z.object({
  description: z
    .string()
    .min(1, { message: "DESCRIPTION_REQUIRED" })
    .transform((v) => v.trim()),
  categoryId: z.string().min(1, { message: "CATEGORY_REQUIRED" }),
  amount: z.string().min(1, { message: "AMOUNT_REQUIRED" }),
  expenseDate: z.string().min(1, { message: "DATE_REQUIRED" }),
})

export const CreateExpenseSchema = ExpenseSchema.extend({
  projectId: z.uuid(),
})

export const UpdateExpenseSchema = ExpenseSchema.extend({
  projectId: z.uuid(),
  id: z.uuid(),
})

export type ExpenseDTO = z.infer<typeof ExpenseSchema>

// ---------- Response schemas ----------

export const ExpenseCategoryOptionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
})

export const ExpenseRecordSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  categoryId: z.string(),
  description: z.string(),
  amount: z.string(),
  expenseDate: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const ExpenseWithCategorySchema = ExpenseRecordSchema.extend({
  categoryName: z.string().nullable(),
  categorySlug: z.string().nullable(),
})

export type ExpenseCategoryOptionDTO = z.infer<
  typeof ExpenseCategoryOptionSchema
>
export type ExpenseRecordDTO = z.infer<typeof ExpenseRecordSchema>
export type ExpenseWithCategoryDTO = z.infer<
  typeof ExpenseWithCategorySchema
>
