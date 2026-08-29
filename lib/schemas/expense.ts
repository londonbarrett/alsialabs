import { z } from "zod"

export const expenseSchema = z.object({
  description: z
    .string()
    .min(1, { message: "DESCRIPTION_REQUIRED" })
    .transform((v) => v.trim()),
  categoryId: z.string().min(1, { message: "CATEGORY_REQUIRED" }),
  amount: z.string().min(1, { message: "AMOUNT_REQUIRED" }),
  expenseDate: z.string().min(1, { message: "DATE_REQUIRED" }),
})

export const createExpenseSchema = expenseSchema.extend({
  projectId: z.uuid(),
})

export const updateExpenseSchema = expenseSchema.extend({
  projectId: z.uuid(),
  id: z.uuid(),
})

export type ExpenseFormData = z.infer<typeof expenseSchema>
