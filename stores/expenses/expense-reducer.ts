import type { ExpenseWithCategoryDTO } from "@/actions/schemas/expense"
import type { ProjectInvoiceDTO } from "@/actions/schemas/invoice"

export type ExpenseStoreState = {
  expenses: ExpenseWithCategoryDTO[]
  invoices: ProjectInvoiceDTO[]
}

export type ExpenseAction =
  | { type: "add"; expense: ExpenseWithCategoryDTO }
  | { type: "update"; expense: ExpenseWithCategoryDTO }
  | {
      type: "replaceTemp"
      tempId: string
      expense: ExpenseWithCategoryDTO
    }
  | { type: "delete"; expenseId: string }
  | { type: "unbindInvoice"; invoiceId: string }

export function expenseReducer(
  state: ExpenseStoreState,
  action: ExpenseAction
): ExpenseStoreState {
  switch (action.type) {
    case "add":
      return { ...state, expenses: [action.expense, ...state.expenses] }
    case "update":
      return {
        ...state,
        expenses: state.expenses.map((e) =>
          e.id === action.expense.id ? action.expense : e
        ),
      }
    case "replaceTemp":
      return {
        ...state,
        expenses: state.expenses.map((e) =>
          e.id === action.tempId ? action.expense : e
        ),
      }
    case "delete":
      return {
        ...state,
        expenses: state.expenses.filter(
          (e) => e.id !== action.expenseId
        ),
      }
    case "unbindInvoice":
      return {
        ...state,
        invoices: state.invoices.filter(
          (i) => i.id !== action.invoiceId
        ),
      }
  }
}
