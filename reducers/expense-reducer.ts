import type { ExpenseWithCategory } from "@/lib/types"

export type ExpenseAction =
  | { type: "add"; expense: ExpenseWithCategory }
  | { type: "update"; expense: ExpenseWithCategory }
  | { type: "replaceTemp"; tempId: string; expense: ExpenseWithCategory }
  | { type: "delete"; expenseId: string }
  | { type: "reset"; expenses: ExpenseWithCategory[] }

export function expenseReducer(
  state: ExpenseWithCategory[],
  action: ExpenseAction
): ExpenseWithCategory[] {
  switch (action.type) {
    case "add":
      return [action.expense, ...state]
    case "update":
      return state.map((e) =>
        e.id === action.expense.id ? action.expense : e
      )
    case "replaceTemp":
      return state.map((e) => (e.id === action.tempId ? action.expense : e))
    case "delete":
      return state.filter((e) => e.id !== action.expenseId)
    case "reset":
      return action.expenses
  }
}
