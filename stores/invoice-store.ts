import type { Invoice } from "@/lib/drizzle/schema"
import { createOptimisticStore } from "@/lib/optimistic-store"
import type { InvoiceWithClientName } from "@/components/sales/sales-invoice-table"

export type InvoiceAction =
  | { type: "add"; invoice: InvoiceWithClientName }
  | { type: "update"; invoice: InvoiceWithClientName }
  | { type: "replaceTemp"; tempId: string; invoice: InvoiceWithClientName }
  | { type: "delete"; invoiceId: string }
  | { type: "reset"; invoices: InvoiceWithClientName[] }
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
 * Pure reducer — module-stable so consumers can use it with
 * useOptimisticDerived.
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
    case "reset":
      return action.invoices
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

/** Unkeyed apply function for the optimistic store. */
export function applyInvoiceAction(
  state: InvoiceWithClientName[],
  _key: string | undefined,
  action: InvoiceAction
): InvoiceWithClientName[] {
  return invoiceReducer(state, action)
}

const initialState: InvoiceWithClientName[] = []

export const useInvoiceStore = createOptimisticStore(
  initialState,
  applyInvoiceAction
)

/**
 * Hydrate from server props, guarded against referential churn (skips when
 * id lists already match and no optimistic action is in-flight).
 */
export function hydrateInvoices(
  invoices: InvoiceWithClientName[]
): void {
  const state = useInvoiceStore.getState()
  if (
    state.committed.length === invoices.length &&
    state.committed.every((v, i) => v.id === invoices[i]?.id)
  ) {
    return
  }
  state.hydrate(invoices)
}