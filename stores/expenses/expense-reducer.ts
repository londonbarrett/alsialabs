import type { ExpenseWithCategoryDTO } from "@/actions/schemas/expense"

export type ExpenseAction =
  | { type: "add"; expense: ExpenseWithCategoryDTO }
  | { type: "update"; expense: ExpenseWithCategoryDTO }
  | {
      type: "replaceTemp"
      tempId: string
      expense: ExpenseWithCategoryDTO
    }
  | { type: "delete"; expenseId: string }

export function expenseReducer(
  state: ExpenseWithCategoryDTO[],
  action: ExpenseAction
): ExpenseWithCategoryDTO[] {
  switch (action.type) {
    case "add":
      return [action.expense, ...state]
    case "update":
      return state.map((e) =>
        e.id === action.expense.id ? action.expense : e
      )
    case "replaceTemp":
      return state.map((e) =>
        e.id === action.tempId ? action.expense : e
      )
    case "delete":
      return state.filter((e) => e.id !== action.expenseId)
  }
}
