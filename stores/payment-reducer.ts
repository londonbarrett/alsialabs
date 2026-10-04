import type { Invoice, InvoicePayment } from "@/lib/drizzle/schema"

/**
 * Payment list actions. Types are namespaced (e.g. `updatePayment` vs the
 * invoice reducer's `update`) so `salesReducer` can route a single action to
 * whichever slice owns it. `paidAmount`/`status` carry the parent invoice patch
 * that update/delete also apply; `paymentReducer` ignores them.
 */
export type PaymentAction =
  | { type: "setPayments"; invoiceId: string; payments: InvoicePayment[] }
  | { type: "addPayment"; invoiceId: string; payment: InvoicePayment }
  | {
      type: "updatePayment"
      invoiceId: string
      payment: InvoicePayment
      paidAmount: string
      status: Invoice["status"]
    }
  | {
      type: "deletePayment"
      invoiceId: string
      paymentId: string
      paidAmount: string
      status: Invoice["status"]
    }

export function paymentReducer(
  state: InvoicePayment[],
  action: PaymentAction
): InvoicePayment[] {
  switch (action.type) {
    case "setPayments":
      return action.payments
    case "addPayment":
      return [action.payment, ...state]
    case "updatePayment":
      return state.map((p) =>
        p.id === action.payment.id ? action.payment : p
      )
    case "deletePayment":
      return state.filter((p) => p.id !== action.paymentId)
  }
}
