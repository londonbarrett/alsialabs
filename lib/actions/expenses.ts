'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/drizzle/client'
import { expensesTable, expenseCategoriesTable } from '@/lib/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { requirePermission } from '@/lib/auth'
import { z } from 'zod'
import { getActionT } from '@/lib/i18n-actions'

const expenseSchema = z.object({
  description: z.string().min(1, 'Description is required').transform((v) => v.trim()),
  categoryId: z.string().min(1, 'Category is required'),
  amount: z.string().min(1, 'Amount is required'),
  expenseDate: z.string().min(1, 'Date is required'),
})

export type ExpenseFormData = z.infer<typeof expenseSchema>

export type ExpenseWithCategory = {
  id: string
  projectId: string
  categoryId: string
  description: string
  amount: string
  expenseDate: string
  createdAt: Date
  updatedAt: Date
  categorySlug: string | null
}

export async function getExpensesByProjectId(projectId: string): Promise<ExpenseWithCategory[]> {
  const t = await getActionT('actions.expenses')
  try {
    await requirePermission('expenses', 'view')
  } catch {
    throw new Error(t('forbidden'))
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
      categorySlug: expenseCategoriesTable.slug,
    })
    .from(expensesTable)
    .leftJoin(expenseCategoriesTable, eq(expensesTable.categoryId, expenseCategoriesTable.id))
    .where(eq(expensesTable.projectId, projectId))
    .orderBy(expensesTable.expenseDate)
}

export async function upsertExpense(data: ExpenseFormData, projectId: string, id?: string) {
  const t = await getActionT('actions.expenses')
  try {
    await requirePermission('expenses', id ? 'edit' : 'create')
  } catch {
    return { success: false as const, error: t('forbidden') }
  }

  const parsed = expenseSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false as const,
      error: t('validationFailed'),
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const { description, categoryId, amount, expenseDate } = parsed.data

  if (id) {
    await db
      .update(expensesTable)
      .set({ description, categoryId, amount, expenseDate })
      .where(and(eq(expensesTable.id, id), eq(expensesTable.projectId, projectId)))
  } else {
    await db.insert(expensesTable).values({
      projectId,
      categoryId,
      description,
      amount,
      expenseDate,
    })
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true as const }
}

export async function deleteExpense(id: string, projectId: string) {
  const t = await getActionT('actions.expenses')
  try {
    await requirePermission('expenses', 'delete')
  } catch {
    return { success: false as const, error: t('forbidden') }
  }

  await db
    .delete(expensesTable)
    .where(and(eq(expensesTable.id, id), eq(expensesTable.projectId, projectId)))

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true as const }
}
