"use client"

import type { InvoiceWithClientName } from "@/components/sales/sales-invoice-table"
import {
  cancelInvoice as cancelInvoiceAction,
  createInvoice as createInvoiceAction,
  deleteInvoice as deleteInvoiceAction,
  markInvoiceAsSent as markInvoiceAsSentAction,
  reopenInvoice as reopenInvoiceAction,
  updateInvoice as updateInvoiceAction,
} from "@/lib/actions/invoices"
import type { Invoice } from "@/lib/drizzle/schema"
import type { InvoiceFormData } from "@/lib/schemas/invoice"
import type { SettleResult } from "@/lib/types"
import { buildOptimisticInvoice } from "@/lib/util/invoices"
import { useSettle } from "@/hooks/use-settle"
import { type InvoiceAction } from "@/stores/invoice-reducer"
import { useInvoiceStore } from "@/stores/invoice-store"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"

/** Optimistic-only context; never sent to the action. */
interface UpdateInvoiceContext {
  invoiceId: string
  editingInvoice?: Invoice
  clientName?: string | null
}

/**
 * Every invoice mutation for the sales page, so components never import the
 * invoice actions directly. Runs through the invoice store (`InvoiceProvider`).
 *
 * Each handler owns its toast and drives the app loading bar. Create/update
 * return `SettleResult` so `InvoiceForm` can render server field errors; the
 * other handlers are fire-and-forget and return nothing.
 */
export function useInvoiceActions() {
  const t = useTranslations()
  const settle = useSettle()

  const store = useInvoiceStore()
  const { run } = useOptimisticAction(store)

  const { executeAsync: executeDelete } = useAction(deleteInvoiceAction)
  const { executeAsync: executeCancel } = useAction(cancelInvoiceAction)
  const { executeAsync: executeReopen } = useAction(reopenInvoiceAction)
  const { executeAsync: executeSend } = useAction(
    markInvoiceAsSentAction
  )

  async function createInvoice(
    data: InvoiceFormData,
    clientName: string | null = null
  ): Promise<SettleResult> {
    const optimistic = buildOptimisticInvoice({
      data,
      clientName,
    })
    const result = await run(
      { type: "add", invoice: optimistic },
      () => createInvoiceAction(data),
      {
        commitAction: (res): InvoiceAction => ({
          type: "replaceTemp",
          tempId: optimistic.id,
          invoice: {
            ...((res as { data?: unknown })
              .data as InvoiceWithClientName),
            clientName: optimistic.clientName,
          },
        }),
      }
    )
    return settle(result, t("sales.invoiceCreated"))
  }

  async function updateInvoice(
    data: InvoiceFormData,
    context: UpdateInvoiceContext
  ): Promise<SettleResult> {
    const { invoiceId, editingInvoice, clientName = null } = context
    const optimistic = buildOptimisticInvoice({
      data,
      invoiceId,
      editingInvoice,
      clientName,
    })
    const result = await run(
      { type: "update", invoice: optimistic },
      () => updateInvoiceAction({ ...data, invoiceId }),
      {
        commitAction: (res): InvoiceAction => ({
          type: "update",
          invoice: {
            ...((res as { data?: unknown })
              .data as InvoiceWithClientName),
            clientName: optimistic.clientName,
          },
        }),
      }
    )
    return settle(result, t("sales.invoiceUpdated"))
  }

  async function deleteInvoice(invoiceId: string) {
    const result = await run({ type: "delete", invoiceId }, () =>
      executeDelete({ invoiceId })
    )
    settle(result, t("sales.invoiceDeleted"))
  }

  async function cancelInvoice(invoiceId: string) {
    const result = await run(
      { type: "updateStatus", invoiceId, status: "cancelled" as const },
      () => executeCancel({ invoiceId })
    )
    settle(result, t("sales.invoiceCancelled"))
  }

  async function reopenInvoice(invoiceId: string) {
    const result = await run(
      { type: "updateStatus", invoiceId, status: "draft" as const },
      () => executeReopen({ invoiceId })
    )
    settle(result, t("sales.invoiceReopened"))
  }

  async function sendInvoice(invoiceId: string) {
    const result = await run(
      { type: "updateStatus", invoiceId, status: "sent" as const },
      () => executeSend({ invoiceId })
    )
    settle(result, t("sales.invoiceSent"))
  }

  return {
    createInvoice,
    updateInvoice,
    deleteInvoice,
    cancelInvoice,
    reopenInvoice,
    sendInvoice,
  }
}
