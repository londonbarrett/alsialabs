"use server"

import { SuccessSchema } from "@/actions/legacy/schemas/common"
import {
  projectAction,
  returnActionError,
  sessionAction,
} from "@/actions/safe-action"
import { canManageWork, canViewProject } from "@/lib/util/project-roles"
import { z } from "zod"
import queries from "./queries"
import {
  CreateExpenseSchema,
  ExpenseCategoryOptionSchema,
  ExpenseRecordSchema,
  ExpenseWithCategorySchema,
  UpdateExpenseSchema,
} from "./schemas"

export const getExpenseCategories = sessionAction
  .metadata({})
  .outputSchema(z.array(ExpenseCategoryOptionSchema))
  .action(async () => {
    return queries.getExpenseCategoryOptions()
  })

export const getExpensesByProjectId = projectAction(
  z.object({ projectId: z.uuid() })
)
  .metadata({})
  .outputSchema(z.array(ExpenseWithCategorySchema))
  .action(async ({ parsedInput, ctx }) => {
    if (!canViewProject(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    return queries.getExpensesByProject(parsedInput.projectId)
  })

export const createExpense = projectAction(CreateExpenseSchema)
  .metadata({})
  .outputSchema(ExpenseRecordSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageWork(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    return queries.createExpense(parsedInput)
  })

export const updateExpense = projectAction(UpdateExpenseSchema)
  .metadata({})
  .outputSchema(ExpenseRecordSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageWork(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const updated = await queries.updateExpense(parsedInput)
    if (!updated) {
      returnActionError("NOT_FOUND")
    }

    return updated
  })

export const deleteExpense = projectAction(
  z.object({
    projectId: z.uuid(),
    id: z.uuid(),
  })
)
  .metadata({})
  .outputSchema(SuccessSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageWork(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const deleted = await queries.deleteExpense(
      parsedInput.id,
      parsedInput.projectId
    )
    if (!deleted) {
      returnActionError("NOT_FOUND")
    }

    return { success: true }
  })
