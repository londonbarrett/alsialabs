"use client"

import { useSettle } from "@/hooks/use-settle"
import {
  createExpense as createExpenseAction,
  deleteExpense as deleteExpenseAction,
  updateExpense as updateExpenseAction,
} from "@/actions/expenses"
import type { Expense } from "@/lib/drizzle/schema"
import type { ExpenseWithCategory } from "@/lib/types"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useExpensesStore } from "./expense-store"

type ExpenseCategoryOption = { id: string; slug: string; name: string }

/**
 * Every project-expense mutation, so `project-expenses` never imports the
 * actions directly. Runs through the expenses store (`ExpensesProvider`).
 *
 * `categories` is a parameter rather than read from a store, because the
 * category list is server-fetched and only used to label the optimistic row:
 * the mutation returns the bare expense row without its joined category name.
 */
export function useExpensesActions() {
  const t = useTranslations()
  const settle = useSettle()
  const store = useExpensesStore()
  const { run } = useOptimisticAction(store)

  const { executeAsync: executeCreate } = useAction(createExpenseAction)
  const { executeAsync: executeUpdate } = useAction(updateExpenseAction)
  const { executeAsync: executeDelete } = useAction(deleteExpenseAction)

  async function saveExpense({
    data,
    categories,
    editingExpense,
  }: {
    data: Expense
    categories: ExpenseCategoryOption[]
    editingExpense?: ExpenseWithCategory
  }) {
    const isEdit = !!editingExpense
    const tempId = editingExpense?.id ?? `temp-${Date.now()}`
    const category = categories.find((c) => c.id === data.categoryId)

    const optimistic: ExpenseWithCategory = {
      id: data.id || tempId,
      projectId: data.projectId,
      categoryId: data.categoryId,
      description: data.description,
      amount: data.amount,
      expenseDate: data.expenseDate,
      createdAt: editingExpense?.createdAt ?? new Date(),
      updatedAt: new Date(),
      categoryName: category?.name ?? null,
      categorySlug: category?.slug ?? null,
    }

    const result = await run(
      { type: isEdit ? "update" : "add", expense: optimistic },
      () =>
        isEdit
          ? executeUpdate({ ...data, id: editingExpense!.id })
          : executeCreate({ ...data }),
      {
        // `createExpense`/`updateExpense` only return the bare row, so carry
        // the category label the optimistic row already resolved.
        commitAction: (r) => ({
          type: "replaceTemp" as const,
          tempId,
          expense: {
            ...optimistic,
            id: (r.data as Expense | undefined)?.id ?? tempId,
          },
        }),
      }
    )

    settle(
      result,
      isEdit
        ? t("projects.expenses.expenseUpdated")
        : t("projects.expenses.expenseCreated")
    )
  }

  async function deleteExpense({
    projectId,
    expenseId,
  }: {
    projectId: string
    expenseId: string
  }) {
    const result = await run({ type: "delete", expenseId }, () =>
      executeDelete({ projectId, id: expenseId })
    )
    settle(result, t("projects.expenses.expenseDeleted"))
  }

  return { saveExpense, deleteExpense }
}
