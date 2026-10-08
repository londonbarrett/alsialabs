"use client"

import type { PaymentFormValues } from "@/components/sales/payment-form"
import { getInvoicePayments } from "@/actions/invoices"
import {
  deletePayment as deletePaymentAction,
  recordPayment as recordPaymentAction,
  updatePayment as updatePaymentAction,
} from "@/actions/payments"
import type { Invoice, InvoicePayment } from "@/lib/drizzle/schema"
import { useActionError } from "@/lib/util/action-errors"
import { useSettle } from "@/hooks/use-settle"
import { useInvoiceStore } from "./invoice-store"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useCallback } from "react"
import { toast } from "sonner"

/** Mirrors the server's `syncInvoicePaymentState` derivation. */
function deriveStatus(
  invoice: Invoice,
  paid: number
): Invoice["status"] {
  if (invoice.status === "cancelled") return "cancelled"
  const grandTotal = parseFloat(invoice.grandTotal) || 0
  if (paid >= grandTotal) return "paid"
  if (paid > 0) return "partially_paid"
  return "draft"
}

function paidAmount(invoice: Invoice): number {
  return parseFloat(invoice.paidAmount) || 0
}

/**
 * Every payment mutation, so sales components never import the payment actions
 * directly. Runs through the invoice store (`InvoiceProvider`), so each write
 * optimistically patches both the per-invoice payment list and the parent
 * invoice's paid state, matching the server transaction.
 *
 * Each handler owns its toast and drives the app loading bar. They are
 * fire-and-forget — no caller consumes the outcome, so they return nothing.
 */
export function usePaymentActions() {
  const t = useTranslations()
  const translateError = useActionError()
  const settle = useSettle()
  const store = useInvoiceStore()
  const { run } = useOptimisticAction(store)

  const { executeAsync: executeRecord } = useAction(recordPaymentAction)
  const { executeAsync: executeUpdate } = useAction(updatePaymentAction)
  const { executeAsync: executeDelete } = useAction(deletePaymentAction)

  /** Fetch, not mutation: pends and commits directly so no loading bar. */
  const loadPayments = useCallback(
    async (invoiceId: string): Promise<void> => {
      try {
        const res = await getInvoicePayments({ invoiceId })
        if (res?.serverError) {
          toast.error(translateError(res.serverError.code))
          return
        }
        const payments = res?.data ?? []
        const id = store.getState().pend({
          type: "setPayments",
          invoiceId,
          payments,
        })
        store.getState().commit(id)
      } catch {
        toast.error(t("common.somethingWentWrong"))
      }
    },
    [store, t, translateError]
  )

  async function recordPayment(
    invoice: Invoice,
    values: PaymentFormValues
  ) {
    const newPaid =
      paidAmount(invoice) + (parseFloat(values.amount) || 0)

    const result = await run(
      {
        type: "recordPayment",
        invoiceId: invoice.id,
        paidAmount: newPaid.toFixed(2),
        status: deriveStatus(invoice, newPaid),
      },
      () => executeRecord({ invoiceId: invoice.id, ...values })
    )
    settle(result, t("sales.paymentRecorded"))
  }

  async function updatePayment(
    invoice: Invoice,
    payment: InvoicePayment,
    values: PaymentFormValues
  ) {
    const newPaid =
      paidAmount(invoice) -
      (parseFloat(payment.amount) || 0) +
      (parseFloat(values.amount) || 0)
    const optimisticPayment: InvoicePayment = {
      ...payment,
      amount: values.amount,
      paymentDate: values.paymentDate,
      method: values.method || null,
      reference: values.reference || null,
      notes: values.notes || null,
    }

    const result = await run(
      {
        type: "updatePayment",
        invoiceId: invoice.id,
        payment: optimisticPayment,
        paidAmount: Math.max(0, newPaid).toFixed(2),
        status: deriveStatus(invoice, newPaid),
      },
      () => executeUpdate({ paymentId: payment.id, ...values })
    )
    settle(result, t("sales.paymentUpdated"))
  }

  async function deletePayment(
    invoice: Invoice,
    payment: InvoicePayment
  ) {
    const newPaid =
      paidAmount(invoice) - (parseFloat(payment.amount) || 0)

    const result = await run(
      {
        type: "deletePayment",
        invoiceId: invoice.id,
        paymentId: payment.id,
        paidAmount: Math.max(0, newPaid).toFixed(2),
        status: deriveStatus(invoice, newPaid),
      },
      () => executeDelete({ paymentId: payment.id })
    )
    settle(result, t("sales.paymentDeleted"))
  }

  return {
    loadPayments,
    recordPayment,
    updatePayment,
    deletePayment,
  }
}
