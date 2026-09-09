"use client"

import type { PaymentFormValues } from "@/components/sales/payment-form"
import type { InvoiceWithClientName } from "@/components/sales/sales-invoice-table"
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import {
  cancelInvoice,
  createInvoice,
  deleteInvoice,
  markInvoiceAsSent,
  reopenInvoice,
  updateInvoice,
} from "@/lib/actions/invoices"
import { recordPayment } from "@/lib/actions/payments"
import type { Invoice, InvoiceStatus } from "@/lib/drizzle/schema"
import type { InvoiceFormData } from "@/lib/schemas/invoice"
import { useActionError } from "@/lib/util/action-errors"
import { computeInvoiceTotals } from "@/lib/util/invoices"
import { invoiceReducer } from "@/reducers/invoice-reducer"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"

export function useInvoiceActions(
  initialInvoices: InvoiceWithClientName[]
) {
  const t = useTranslations()
  const translateError = useActionError()
  const { start: startLoading, stop: stopLoading } =
    useLoadingIndicator()
  const [, startTransition] = useTransition()

  const [optimisticInvoices, addOptimistic] = useOptimistic(
    initialInvoices,
    invoiceReducer
  )
  const invoices = optimisticInvoices
  const dispatch = addOptimistic

  const { executeAsync: executeCreate } = useAction(createInvoice)
  const { executeAsync: executeUpdate } = useAction(updateInvoice)
  const { executeAsync: executeDelete } = useAction(deleteInvoice)
  const { executeAsync: executeCancel } = useAction(cancelInvoice)
  const { executeAsync: executeReopen } = useAction(reopenInvoice)
  const { executeAsync: executeMarkSent } = useAction(markInvoiceAsSent)
  const { executeAsync: executeRecordPayment } =
    useAction(recordPayment)

  async function handleInvoiceSubmit(
    data: InvoiceFormData,
    invoiceId: string | undefined,
    editingInvoice: Invoice | undefined
  ) {
    const isEdit = !!invoiceId
    const tempId = `temp-${Date.now()}`
    const totals = computeInvoiceTotals(data.items)
    const paid = Math.max(0, parseFloat(data.paidAmount || "0") || 0)
    const grandTotalNum = parseFloat(totals.grandTotal) || 0
    const derivedStatus: InvoiceStatus =
      !isEdit && paid >= grandTotalNum
        ? "paid"
        : !isEdit && paid > 0
          ? "partially_paid"
          : isEdit
            ? ((editingInvoice?.status as InvoiceStatus) ?? "draft")
            : "draft"

    const clientName =
      (isEdit
        ? invoices.find((inv) => inv.id === invoiceId)?.clientName
        : invoices.find((inv) => inv.clientId === data.clientId)
            ?.clientName) ?? null

    const optimisticInvoice: InvoiceWithClientName = {
      id: isEdit ? invoiceId! : tempId,
      store_id:
        (editingInvoice as unknown as { store_id?: string | null })
          ?.store_id ?? null,
      type: data.type,
      invoiceNumber: isEdit
        ? (editingInvoice?.invoiceNumber ?? "…")
        : "…",
      clientId: data.clientId,
      userId: null,
      status: derivedStatus,
      issueDate: data.issueDate,
      dueDate: data.dueDate || null,
      paidAmount: isEdit
        ? (editingInvoice?.paidAmount ?? "0")
        : paid.toFixed(2),
      notes: data.notes || null,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      projectId: null,
      createdAt: editingInvoice?.createdAt ?? new Date(),
      updatedAt: new Date(),
      clientName,
    } as InvoiceWithClientName

    startTransition(() => {
      if (isEdit) {
        dispatch({ type: "update", invoice: optimisticInvoice })
      } else {
        dispatch({ type: "add", invoice: optimisticInvoice })
      }
    })

    startLoading()
    const result = isEdit
      ? await executeUpdate({ ...data, invoiceId: invoiceId! })
      : await executeCreate(data)
    stopLoading()

    if (result?.data) {
      const real = result.data as Invoice
      const realWithClient: InvoiceWithClientName = {
        ...(real as unknown as InvoiceWithClientName),
        clientName:
          (real as unknown as { clientName?: string | null })
            .clientName ?? clientName,
      } as InvoiceWithClientName

      startTransition(() => {
        if (isEdit) {
          dispatch({ type: "update", invoice: realWithClient })
        } else {
          dispatch({
            type: "replaceTemp",
            tempId,
            invoice: realWithClient,
          })
        }
      })
      toast.success(
        isEdit ? t("sales.invoiceUpdated") : t("sales.invoiceCreated")
      )
      return { success: true as const, data: result.data }
    } else {
      startTransition(() => {
        if (isEdit) {
          const original = initialInvoices.find(
            (inv) => inv.id === invoiceId
          )
          if (original) dispatch({ type: "update", invoice: original })
        } else {
          dispatch({ type: "delete", invoiceId: tempId })
        }
      })
      if (result?.serverError) {
        toast.error(translateError(result.serverError.code))
        return {
          success: false as const,
          error: translateError(result.serverError.code),
        }
      }
      if (result?.validationErrors) {
        const fieldErrors = result.validationErrors as Record<
          string,
          string[] | undefined
        >
        return {
          success: false as const,
          error: t("common.somethingWentWrong"),
          fieldErrors,
        }
      }
      toast.error(t("common.somethingWentWrong"))
      return {
        success: false as const,
        error: t("common.somethingWentWrong"),
      }
    }
  }

  async function handlePaymentSubmit(
    values: PaymentFormValues,
    paymentInvoice: Invoice | null
  ) {
    if (!paymentInvoice) return { success: false as const }

    const currentPaid = parseFloat(paymentInvoice.paidAmount) || 0
    const added = parseFloat(values.amount) || 0
    const newPaid = currentPaid + added
    const grandTotal = parseFloat(paymentInvoice.grandTotal) || 0
    const newStatus: InvoiceStatus =
      newPaid >= grandTotal ? "paid" : "partially_paid"

    startTransition(() => {
      dispatch({
        type: "recordPayment",
        invoiceId: paymentInvoice.id,
        paidAmount: newPaid.toFixed(2),
        status: newStatus,
      })
    })

    const invoiceId = paymentInvoice.id
    startLoading()
    const result = await executeRecordPayment({
      invoiceId,
      ...values,
    })
    stopLoading()

    if (result?.data) {
      toast.success(t("sales.paymentRecorded"))
      return { success: true as const }
    } else {
      const original = initialInvoices.find(
        (inv) => inv.id === invoiceId
      )
      if (original) {
        startTransition(() => {
          dispatch({ type: "update", invoice: original })
        })
      } else {
        startTransition(() => {
          dispatch({ type: "reset", invoices: initialInvoices })
        })
      }
      if (result?.serverError) {
        toast.error(translateError(result.serverError.code))
        return {
          success: false as const,
          error: translateError(result.serverError.code),
        }
      }
      if (result?.validationErrors) {
        return {
          success: false as const,
          error: t("common.somethingWentWrong"),
          fieldErrors: result.validationErrors as Record<
            string,
            string[] | undefined
          >,
        }
      }
      toast.error(t("common.somethingWentWrong"))
      return {
        success: false as const,
        error: t("common.somethingWentWrong"),
      }
    }
  }

  async function handleDeleteInvoice(invoiceId: string) {
    const original = invoices.find((inv) => inv.id === invoiceId)
    startTransition(() => {
      dispatch({ type: "delete", invoiceId })
    })
    startLoading()
    const result = await executeDelete({ invoiceId })
    stopLoading()
    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
      if (original) {
        startTransition(() => {
          dispatch({ type: "add", invoice: original })
        })
      } else {
        startTransition(() => {
          dispatch({ type: "reset", invoices: initialInvoices })
        })
      }
    } else if (result?.data) {
      toast.success(t("sales.invoiceDeleted"))
    }
  }

  async function handleCancelInvoice(invoiceId: string) {
    const original = invoices.find((inv) => inv.id === invoiceId)
    startTransition(() => {
      dispatch({ type: "updateStatus", invoiceId, status: "cancelled" })
    })
    startLoading()
    const result = await executeCancel({ invoiceId })
    stopLoading()
    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
      if (original) {
        startTransition(() => {
          dispatch({ type: "update", invoice: original })
        })
      }
    } else {
      toast.success(t("sales.invoiceCancelled"))
    }
  }

  async function handleReopenInvoice(invoiceId: string) {
    const original = invoices.find((inv) => inv.id === invoiceId)
    startTransition(() => {
      dispatch({ type: "updateStatus", invoiceId, status: "draft" })
    })
    startLoading()
    const result = await executeReopen({ invoiceId })
    stopLoading()
    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
      if (original) {
        startTransition(() => {
          dispatch({ type: "update", invoice: original })
        })
      }
    } else {
      toast.success(t("sales.invoiceReopened"))
    }
  }

  async function handleMarkSent(invoiceId: string) {
    const original = invoices.find((inv) => inv.id === invoiceId)
    startTransition(() => {
      dispatch({ type: "updateStatus", invoiceId, status: "sent" })
    })
    startLoading()
    const result = await executeMarkSent({ invoiceId })
    stopLoading()
    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
      if (original) {
        startTransition(() => {
          dispatch({ type: "update", invoice: original })
        })
      }
    } else {
      toast.success(t("sales.invoiceSent"))
    }
  }

  return {
    invoices,
    handleInvoiceSubmit,
    handlePaymentSubmit,
    handleDeleteInvoice,
    handleCancelInvoice,
    handleReopenInvoice,
    handleMarkSent,
  }
}
