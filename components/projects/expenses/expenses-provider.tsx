"use client"

import { useServerReseed } from "@/hooks/use-server-reseed"
import type { ExpenseWithCategoryDTO } from "@/actions/schemas/expense"
import type { ProjectInvoiceDTO } from "@/actions/schemas/invoice"
import {
  createExpensesStore,
  ExpensesStoreContext,
} from "@/stores/expenses/expense-store"
import { useMemo, useState } from "react"

export function ExpensesProvider({
  expenses,
  invoices,
  children,
}: {
  expenses: ExpenseWithCategoryDTO[]
  invoices: ProjectInvoiceDTO[]
  children: React.ReactNode
}) {
  // Memoized so client-only re-renders keep the same seed identity;
  // `useServerReseed` compares by identity and would wipe optimistic state.
  const seed = useMemo(
    () => ({ expenses, invoices }),
    [expenses, invoices]
  )
  const [store] = useState(() => createExpensesStore(seed))
  useServerReseed(store, seed)

  return (
    <ExpensesStoreContext value={store}>
      {children}
    </ExpensesStoreContext>
  )
}
