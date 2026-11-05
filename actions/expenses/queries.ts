import { db } from "@/lib/drizzle/client"
import {
  categoryTable,
  expensesTable,
  taxonomyTable,
} from "@/lib/drizzle/schema"
import { and, eq } from "drizzle-orm"
import type { CreateExpenseDTO, UpdateExpenseDTO } from "./schemas"

async function getExpenseCategoryOptions() {
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
}

async function getExpensesByProject(projectId: string) {
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
    .where(eq(expensesTable.projectId, projectId))
    .orderBy(expensesTable.expenseDate)
}

async function createExpense(values: CreateExpenseDTO) {
  const { projectId, description, categoryId, amount, expenseDate } =
    values

  const [created] = await db
    .insert(expensesTable)
    .values({
      projectId,
      categoryId,
      description,
      amount,
      expenseDate,
    })
    .returning()

  return created
}

async function updateExpense(values: UpdateExpenseDTO) {
  const {
    projectId,
    id,
    description,
    categoryId,
    amount,
    expenseDate,
  } = values

  const [updated] = await db
    .update(expensesTable)
    .set({ description, categoryId, amount, expenseDate })
    .where(
      and(
        eq(expensesTable.id, id),
        eq(expensesTable.projectId, projectId)
      )
    )
    .returning()

  return updated
}

async function deleteExpense(id: string, projectId: string) {
  const [deleted] = await db
    .delete(expensesTable)
    .where(
      and(
        eq(expensesTable.id, id),
        eq(expensesTable.projectId, projectId)
      )
    )
    .returning({ id: expensesTable.id })

  return deleted
}

const queries = {
  getExpenseCategoryOptions,
  getExpensesByProject,
  createExpense,
  updateExpense,
  deleteExpense,
}

export default queries
