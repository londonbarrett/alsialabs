"use client"

import type { OptimisticStore } from "@/lib/optimistic-store"
import { useStore } from "zustand"
import type {
  ExpenseAction,
  ExpenseStoreState,
} from "./expense-reducer"
import { useExpensesStore } from "./expense-store"

type StoreType = OptimisticStore<ExpenseStoreState, ExpenseAction>

export function useExpensesState() {
  const store = useExpensesStore()
  const expenses = useStore(
    store,
    (s: StoreType) => s.optimistic.expenses
  )
  const invoices = useStore(
    store,
    (s: StoreType) => s.optimistic.invoices
  )
  const pending = useStore(store, (s: StoreType) => s.pending)

  return { expenses, invoices, pending }
}
