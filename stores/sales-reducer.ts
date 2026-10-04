import type { InvoiceWithClientName } from "@/components/sales/sales-invoice-table"
import type { InvoicePayment } from "@/lib/drizzle/schema"
import {
  invoiceReducer,
  type InvoiceAction,
} from "@/stores/invoice-reducer"
import {
  paymentReducer,
  type PaymentAction,
} from "@/stores/payment-reducer"

export type SalesState = {
  invoices: InvoiceWithClientName[]
  paymentsByInvoiceId: Record<string, InvoicePayment[]>
}

export type SalesAction = InvoiceAction | PaymentAction

/**
 * Composes the invoice and payment reducers into the one sales store. Payment
 * writes touch two things: the per-invoice payment list, and (for update/delete)
 * the parent invoice's paid state — the same pair the server updates together.
 */
export function salesReducer(
  state: SalesState,
  action: SalesAction
): SalesState {
  switch (action.type) {
    case "setPayments":
    case "addPayment": {
      const payments = {
        ...state.paymentsByInvoiceId,
        [action.invoiceId]: paymentReducer(
          state.paymentsByInvoiceId[action.invoiceId] ?? [],
          action
        ),
      }
      return { ...state, paymentsByInvoiceId: payments }
    }
    case "updatePayment":
    case "deletePayment": {
      const payments = {
        ...state.paymentsByInvoiceId,
        [action.invoiceId]: paymentReducer(
          state.paymentsByInvoiceId[action.invoiceId] ?? [],
          action
        ),
      }
      return {
        invoices: invoiceReducer(state.invoices, {
          type: "recordPayment",
          invoiceId: action.invoiceId,
          paidAmount: action.paidAmount,
          status: action.status,
        }),
        paymentsByInvoiceId: payments,
      }
    }
    default:
      return { ...state, invoices: invoiceReducer(state.invoices, action) }
  }
}
