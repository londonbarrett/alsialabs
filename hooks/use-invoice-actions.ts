"use client"

import type { InvoiceWithClientName } from "@/components/sales/sales-invoice-table"
import {
  useOptimisticAction,
  useOptimisticDerived,
} from "@/hooks/use-optimistic-store"
import {
  cancelInvoice as cancelInvoiceAction,
  deleteInvoice as deleteInvoiceAction,
  markInvoiceAsSent as markInvoiceAsSentAction,
  reopenInvoice as reopenInvoiceAction,
} from "@/lib/actions/invoices"
import { useActionError } from "@/lib/util/action-errors"
import {
  applyInvoiceAction,
  hydrateInvoices,
  useInvoiceStore,
} from "@/stores/invoice-store"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useEffect } from "react"
import { toast } from "sonner"

export function useInvoiceActions(
  initialInvoices: InvoiceWithClientName[]
) {
  const t = useTranslations()
  const translateError = useActionError()

  // Globally shared optimistic invoice list. Store guards hydration while
  // any action is pending, so the derive stays truthful across consumers.
  const derivedInvoices = useOptimisticDerived(
    useInvoiceStore,
    applyInvoiceAction
  )
  const { run } = useOptimisticAction(useInvoiceStore)

  useEffect(() => {
    hydrateInvoices(initialInvoices)
  }, [initialInvoices])

  const invoices =
    derivedInvoices.length > 0 || initialInvoices.length === 0
      ? derivedInvoices
      : initialInvoices

  const { executeAsync: executeDelete } = useAction(deleteInvoiceAction)
  const { executeAsync: executeCancel } = useAction(cancelInvoiceAction)
  const { executeAsync: executeReopen } = useAction(reopenInvoiceAction)
  const { executeAsync: executeSend } = useAction(
    markInvoiceAsSentAction
  )

  async function deleteInvoice(invoiceId: string) {
    const result = await run({ type: "delete", invoiceId }, () =>
      executeDelete({ invoiceId })
    )
    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
    } else if (result?.data) {
      toast.success(t("sales.invoiceDeleted"))
    }
  }

  async function cancelInvoice(invoiceId: string) {
    const result = await run(
      { type: "updateStatus", invoiceId, status: "cancelled" as const },
      () => executeCancel({ invoiceId })
    )
    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
    } else {
      toast.success(t("sales.invoiceCancelled"))
    }
  }

  async function reopenInvoice(invoiceId: string) {
    const result = await run(
      { type: "updateStatus", invoiceId, status: "draft" as const },
      () => executeReopen({ invoiceId })
    )
    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
    } else {
      toast.success(t("sales.invoiceReopened"))
    }
  }

  async function sendInvoice(invoiceId: string) {
    const result = await run(
      { type: "updateStatus", invoiceId, status: "sent" as const },
      () => executeSend({ invoiceId })
    )
    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
    } else {
      toast.success(t("sales.invoiceSent"))
    }
  }

  return {
    invoices,
    deleteInvoice,
    cancelInvoice,
    reopenInvoice,
    sendInvoice,
  }
}
