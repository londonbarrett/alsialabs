import { z } from "zod"

export const expenseSchema = z.object({
  description: z
    .string()
    .min(1, "DESCRIPTION_REQUIRED")
    .transform((v) => v.trim()),
  categoryId: z.string().min(1, "CATEGORY_REQUIRED"),
  amount: z.string().min(1, "AMOUNT_REQUIRED"),
  expenseDate: z.string().min(1, "DATE_REQUIRED"),
})

export const createExpenseSchema = expenseSchema.extend({
  projectId: z.string().uuid(),
})

export const updateExpenseSchema = expenseSchema.extend({
  projectId: z.string().uuid(),
  id: z.string().uuid(),
})

export type ExpenseFormData = z.infer<typeof expenseSchema>
