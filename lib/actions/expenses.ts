"use server"

import { db } from "@/lib/drizzle/client"
import {
  categoryTable,
  expensesTable,
  taxonomyTable,
} from "@/lib/drizzle/schema"
import {
  projectScopedAction,
  returnActionError,
  sessionAction,
} from "@/lib/safe-action"
import {
  createExpenseSchema,
  updateExpenseSchema,
} from "@/lib/schemas/expense"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

// ---------- Query actions ----------

export const getExpenseCategories = sessionAction
  .metadata({})
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

export const getExpensesByProjectId = projectScopedAction(
  z.object({ projectId: z.uuid() })
)
  .metadata({
    permission: { module: "expenses", action: "view" },
  })
  .action(async ({ parsedInput }) => {
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

export const createExpense = projectScopedAction(createExpenseSchema)
  .metadata({
    permission: { module: "expenses", action: "create" },
  })
  .action(async ({ parsedInput }) => {
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

export const updateExpense = projectScopedAction(updateExpenseSchema)
  .metadata({
    permission: { module: "expenses", action: "edit" },
  })
  .action(async ({ parsedInput }) => {
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

export const deleteExpense = projectScopedAction(
  z.object({
    projectId: z.uuid(),
    id: z.uuid(),
  })
)
  .metadata({
    permission: { module: "expenses", action: "delete" },
  })
  .action(async ({ parsedInput }) => {
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
  })
