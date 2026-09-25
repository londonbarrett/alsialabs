"use client"

import { Dialog } from "@/components/common/dialog"
import { InvoiceForm } from "@/components/sales/invoice-form"
import { useOptimisticAction } from "@/hooks/use-optimistic-store"
import { createInvoice, updateInvoice } from "@/lib/actions/invoices"
import type { Invoice } from "@/lib/drizzle/schema"
import type { InvoiceFormData } from "@/lib/schemas/invoice"
import { computeInvoiceTotals } from "@/lib/util/invoices"
import { buildTempInvoice } from "@/lib/util/temp-entries"
import type { TimelineEntryAction } from "@/stores/timeline-store"
import { useTimelineStore } from "@/stores/timeline-store"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

interface TimelineInvoiceDialogProps {
  clientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  editingInvoice?: Invoice
}

export function TimelineInvoiceDialog({
  clientId,
  open,
  onOpenChange,
  editingInvoice,
}: TimelineInvoiceDialogProps) {
  const t = useTranslations()
  const { run } = useOptimisticAction(useTimelineStore)

  async function handleSubmit(
    data: InvoiceFormData,
    invoiceId?: string
  ) {
    const isEdit = !!invoiceId

    onOpenChange(false)
    const totals = computeInvoiceTotals(data.items)
    const action: TimelineEntryAction = isEdit
      ? {
          type: "patch",
          kind: "invoice",
          id: invoiceId!,
          patch: {
            type: data.type,
            clientId: data.clientId,
            issueDate: data.issueDate,
            dueDate: data.dueDate || null,
            notes: data.notes || null,
            subtotal: totals.subtotal,
            discountTotal: totals.discountTotal,
            taxTotal: totals.taxTotal,
            grandTotal: totals.grandTotal,
          },
        }
      : { type: "add", entry: buildTempInvoice(data) }

    const result = await run(
      action,
      () =>
        isEdit
          ? updateInvoice({ ...data, invoiceId: invoiceId! })
          : createInvoice(data),
      { key: clientId }
    )

    const success =
      (result as unknown as { data?: unknown })?.data !== undefined
    if (success) {
      toast.success(
        isEdit ? t("sales.invoiceUpdated") : t("sales.invoiceCreated")
      )
      return { success: true as const }
    }
    // Failure: the pending action was auto-discarded (reverted).
    toast.error(t("common.somethingWentWrong"))
    return {
      success: false as const,
      error: t("common.somethingWentWrong"),
    }
  }

  return (
    <Dialog
      title={
        editingInvoice ? t("sales.editInvoice") : t("sales.newInvoice")
      }
      description={
        editingInvoice
          ? t("sales.updateDetails")
          : t("sales.fillDetails")
      }
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-4xl"
    >
      <InvoiceForm
        key={editingInvoice?.id ?? "new"}
        invoice={editingInvoice}
        selectedClientId={clientId}
        onSubmit={handleSubmit}
        onCancel={() => onOpenChange(false)}
      />
    </Dialog>
  )
}
