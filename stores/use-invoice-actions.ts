"use client"

import {
  cancelInvoice as cancelInvoiceAction,
  deleteInvoice as deleteInvoiceAction,
  markInvoiceAsSent as markInvoiceAsSentAction,
  reopenInvoice as reopenInvoiceAction,
} from "@/lib/actions/invoices"
import { useActionError } from "@/lib/util/action-errors"
import { useInvoiceStore } from "@/stores/invoice-store"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { toast } from "sonner"

export function useInvoiceActions() {
  const t = useTranslations()
  const translateError = useActionError()

  const store = useInvoiceStore()
  const invoices = store.getInvoices()
  const { run } = useOptimisticAction(store)

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
