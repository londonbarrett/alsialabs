"use client"

import type { OptimisticStore } from "@/lib/optimistic-store"
import type { ExpenseWithCategory } from "@/lib/types"
import { useStore } from "zustand"
import type { ExpenseAction } from "./expense-reducer"
import { useExpensesStore } from "./expense-store"

type StoreType = OptimisticStore<ExpenseWithCategory[], ExpenseAction>

export function useExpensesState() {
  const store = useExpensesStore()
  const expenses = useStore(store, (s: StoreType) => s.optimistic)
  const pending = useStore(store, (s: StoreType) => s.pending)

  return { expenses, pending }
}
