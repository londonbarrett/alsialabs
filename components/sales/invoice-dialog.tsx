"use client"

import { Dialog } from "@/components/common/dialog"
import {
  InvoiceForm,
  type InvoiceSubmitResult,
} from "@/components/sales/invoice-form"
import type { InvoiceFormData } from "@/lib/actions/sales"
import type { Invoice } from "@/lib/drizzle/schema"
import { useTranslations } from "next-intl"

interface InvoiceDialogProps {
  invoice?: Invoice
  selectedClientId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (
    data: InvoiceFormData,
    invoiceId?: string
  ) => Promise<InvoiceSubmitResult>
}

export function InvoiceDialog({
  invoice,
  selectedClientId,
  open,
  onOpenChange,
  onSubmit,
}: InvoiceDialogProps) {
  const t = useTranslations()

  return (
    <Dialog
      title={invoice ? t("sales.editInvoice") : t("sales.newInvoice")}
      description={
        invoice ? t("sales.updateDetails") : t("sales.fillDetails")
      }
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-2xl"
    >
      <InvoiceForm
        key={invoice?.id ?? "new"}
        invoice={invoice}
        selectedClientId={selectedClientId}
        onSubmit={onSubmit}
        onCancel={() => onOpenChange(false)}
      />
    </Dialog>
  )
}
