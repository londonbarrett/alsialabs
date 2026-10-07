"use client"

import { useServerReseed } from "@/hooks/use-server-reseed"
import type { ExpenseWithCategory } from "@/lib/types"
import {
  createExpensesStore,
  ExpensesStoreContext,
} from "@/stores/expenses/expense-store"
import { useState } from "react"

export function ExpensesProvider({
  expenses,
  children,
}: {
  expenses: ExpenseWithCategory[]
  children: React.ReactNode
}) {
  const [store] = useState(() => createExpensesStore(expenses))
  useServerReseed(store, expenses)

  return (
    <ExpensesStoreContext value={store}>{children}</ExpensesStoreContext>
  )
}
