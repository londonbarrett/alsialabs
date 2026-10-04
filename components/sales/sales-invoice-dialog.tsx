"use client"

import { Dialog } from "@/components/common/dialog"
import { InvoiceForm } from "@/components/sales/invoice-form"
import type { Invoice } from "@/lib/drizzle/schema"
import type { InvoiceFormData } from "@/lib/schemas/invoice"
import type { SettleResult } from "@/lib/types"
import { useInvoiceActions } from "@/stores/use-invoice-actions"
import { useTranslations } from "next-intl"

interface SalesInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingInvoice?: Invoice
}

export function SalesInvoiceDialog({
  open,
  onOpenChange,
  editingInvoice,
}: SalesInvoiceDialogProps) {
  const t = useTranslations()
  const { createInvoice, updateInvoice } = useInvoiceActions()

  async function handleSubmit(
    data: InvoiceFormData,
    invoiceId?: string,
    clientName?: string | null
  ): Promise<SettleResult> {
    onOpenChange(false)
    const result = invoiceId
      ? await updateInvoice(data, {
          invoiceId,
          editingInvoice,
          clientName,
        })
      : await createInvoice(data, clientName ?? null)
    // Re-open so the form can show server field errors.
    if (!result.success && result.fieldErrors) onOpenChange(true)
    return result
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
        onSubmit={handleSubmit}
        onCancel={() => onOpenChange(false)}
      />
    </Dialog>
  )
}
