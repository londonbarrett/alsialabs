import { createOptimisticStore } from "@/lib/optimistic-store"
import type { ExpenseWithCategory } from "@/lib/types"
import { createContext, useContext } from "react"
import { expenseReducer } from "./expense-reducer"

export function createExpensesStore(expenses: ExpenseWithCategory[]) {
  /** The whole state is the server's slice, so a reseed replaces it. */
  return createOptimisticStore({
    initialState: expenses,
    reducer: expenseReducer,
  })
}

type ExpensesStore = ReturnType<typeof createExpensesStore>

export const ExpensesStoreContext = createContext<ExpensesStore | null>(
  null
)

export function useExpensesStore(): ExpensesStore {
  const store = useContext(ExpensesStoreContext)
  if (!store) {
    throw new Error(
      "useExpensesStore must be used within an ExpensesProvider"
    )
  }
  return store
}
