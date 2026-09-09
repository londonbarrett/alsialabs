import type { InvoicePayment } from "@/lib/drizzle/schema"

export type PaymentAction =
  | { type: "add"; payment: InvoicePayment }
  | { type: "update"; payment: InvoicePayment }
  | { type: "replaceTemp"; tempId: string; payment: InvoicePayment }
  | { type: "delete"; paymentId: string }
  | { type: "reset"; payments: InvoicePayment[] }

export function paymentReducer(
  state: InvoicePayment[],
  action: PaymentAction
): InvoicePayment[] {
  switch (action.type) {
    case "add":
      return [action.payment, ...state]
    case "update":
      return state.map((p) =>
        p.id === action.payment.id ? action.payment : p
      )
    case "replaceTemp":
      return state.map((p) =>
        p.id === action.tempId ? action.payment : p
      )
    case "delete":
      return state.filter((p) => p.id !== action.paymentId)
    case "reset":
      return action.payments
  }
}
