import { createOptimisticStore } from "@/lib/optimistic-store"
import { createContext, useContext } from "react"
import {
  expenseReducer,
  type ExpenseStoreState,
} from "./expense-reducer"

export function createExpensesStore(seed: ExpenseStoreState) {
  /** Both keys are server lists, so a reseed replaces the whole state. */
  return createOptimisticStore({
    initialState: seed,
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
