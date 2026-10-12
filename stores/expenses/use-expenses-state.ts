"use client"

import type { OptimisticStore } from "@/lib/optimistic-store"
import type { ExpenseWithCategoryDTO } from "@/actions/schemas/expense"
import { useStore } from "zustand"
import type { ExpenseAction } from "./expense-reducer"
import { useExpensesStore } from "./expense-store"

type StoreType = OptimisticStore<
  ExpenseWithCategoryDTO[],
  ExpenseAction
>

export function useExpensesState() {
  const store = useExpensesStore()
  const expenses = useStore(store, (s: StoreType) => s.optimistic)
  const pending = useStore(store, (s: StoreType) => s.pending)

  return { expenses, pending }
}
