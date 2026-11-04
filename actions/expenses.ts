"use server"

import { db } from "@/lib/drizzle/client"
import {
  categoryTable,
  expensesTable,
  taxonomyTable,
} from "@/lib/drizzle/schema"
import {
  projectAction,
  returnActionError,
  sessionAction,
} from "@/lib/safe-action"
import { canManageWork, canViewProject } from "@/lib/util/project-roles"
import {
  CreateExpenseSchema,
  ExpenseCategoryOptionSchema,
  ExpenseRecordSchema,
  ExpenseWithCategorySchema,
  UpdateExpenseSchema,
} from "@/actions/schemas/expense"
import { SuccessSchema } from "@/actions/schemas/common"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

// ---------- Query actions ----------

export const getExpenseCategories = sessionAction
  .metadata({})
  .outputSchema(z.array(ExpenseCategoryOptionSchema))
  .action(async () => {
    return db
      .select({
        id: categoryTable.id,
        slug: categoryTable.slug,
        name: categoryTable.name,
      })
      .from(categoryTable)
      .innerJoin(
        taxonomyTable,
        eq(categoryTable.taxonomyId, taxonomyTable.id)
      )
      .where(eq(taxonomyTable.slug, "expense"))
      .orderBy(categoryTable.name)
  })

export const getExpensesByProjectId = projectAction(
  z.object({ projectId: z.uuid() })
)
  .metadata({
  })
  .outputSchema(z.array(ExpenseWithCategorySchema))
  .action(async ({ parsedInput, ctx }) => {
    if (!canViewProject(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    return db
      .select({
        id: expensesTable.id,
        projectId: expensesTable.projectId,
        categoryId: expensesTable.categoryId,
        description: expensesTable.description,
        amount: expensesTable.amount,
        expenseDate: expensesTable.expenseDate,
        createdAt: expensesTable.createdAt,
        updatedAt: expensesTable.updatedAt,
        categoryName: categoryTable.name,
        categorySlug: categoryTable.slug,
      })
      .from(expensesTable)
      .leftJoin(
        categoryTable,
        eq(expensesTable.categoryId, categoryTable.id)
      )
      .where(eq(expensesTable.projectId, parsedInput.projectId))
      .orderBy(expensesTable.expenseDate)
  })

// ---------- Mutation actions ----------

export const createExpense = projectAction(CreateExpenseSchema)
  .metadata({
  })
  .outputSchema(ExpenseRecordSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageWork(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { description, categoryId, amount, expenseDate } = parsedInput

    const [created] = await db
      .insert(expensesTable)
      .values({
        projectId: parsedInput.projectId,
        categoryId,
        description,
        amount,
        expenseDate,
      })
      .returning()

    return created
  })

export const updateExpense = projectAction(UpdateExpenseSchema)
  .metadata({
  })
  .outputSchema(ExpenseRecordSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageWork(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { id, description, categoryId, amount, expenseDate } =
      parsedInput

    const [updated] = await db
      .update(expensesTable)
      .set({ description, categoryId, amount, expenseDate })
      .where(
        and(
          eq(expensesTable.id, id),
          eq(expensesTable.projectId, parsedInput.projectId)
        )
      )
      .returning()

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
  .metadata({
  })
  .outputSchema(SuccessSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageWork(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const [deleted] = await db
      .delete(expensesTable)
      .where(
        and(
          eq(expensesTable.id, parsedInput.id),
          eq(expensesTable.projectId, parsedInput.projectId)
        )
      )
      .returning({ id: expensesTable.id })

    if (!deleted) {
      returnActionError("NOT_FOUND")
    }

    return { success: true }
  })
