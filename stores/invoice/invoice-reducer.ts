import type { InvoiceWithClientName } from "@/components/sales/sales-invoice-table"
import type { Invoice } from "@/lib/drizzle/schema"

export type InvoiceAction =
  | { type: "add"; invoice: InvoiceWithClientName }
  | { type: "update"; invoice: InvoiceWithClientName }
  | {
      type: "replaceTemp"
      tempId: string
      invoice: InvoiceWithClientName
    }
  | { type: "delete"; invoiceId: string }
  | {
      type: "updateStatus"
      invoiceId: string
      status: Invoice["status"]
    }
  | {
      type: "recordPayment"
      invoiceId: string
      paidAmount: string
      status: Invoice["status"]
    }

/**
 * Pure reducer — the store applies it to derive optimistic state.
 */
export function invoiceReducer(
  state: InvoiceWithClientName[],
  action: InvoiceAction
): InvoiceWithClientName[] {
  switch (action.type) {
    case "add":
      return [action.invoice, ...state]
    case "update":
      return state.map((inv) =>
        inv.id === action.invoice.id ? action.invoice : inv
      )
    case "replaceTemp":
      return state.map((inv) =>
        inv.id === action.tempId ? action.invoice : inv
      )
    case "delete":
      return state.filter((inv) => inv.id !== action.invoiceId)
    case "updateStatus":
      return state.map((inv) =>
        inv.id === action.invoiceId
          ? { ...inv, status: action.status }
          : inv
      )
    case "recordPayment":
      return state.map((inv) =>
        inv.id === action.invoiceId
          ? {
              ...inv,
              paidAmount: action.paidAmount,
              status: action.status,
            }
          : inv
      )
  }
}
