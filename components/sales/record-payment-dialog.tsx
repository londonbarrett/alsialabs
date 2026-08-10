"use client"

import { Dialog } from "@/components/common/dialog"
import type { PaymentFormValues } from "@/components/sales/payment-form"
import { RecordPaymentForm } from "@/components/sales/record-payment-form"
import { getOutstanding } from "@/components/sales/sales-invoice-table"
import type { Invoice } from "@/lib/drizzle/schema"
import { useTranslations } from "next-intl"

interface RecordPaymentDialogProps {
  invoice: Invoice
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (
    values: PaymentFormValues
  ) => Promise<{ success: boolean; error?: string }>
}

export function RecordPaymentDialog({
  invoice,
  open,
  onOpenChange,
  onSubmit,
}: RecordPaymentDialogProps) {
  const t = useTranslations()

  return (
    <Dialog
      key={invoice.id}
      title={t("sales.recordPayment")}
      description={t("sales.recordPaymentDesc")}
      open={open}
      onOpenChange={onOpenChange}
    >
      <RecordPaymentForm
        remainingBalance={getOutstanding(invoice)}
        onSubmit={onSubmit}
        onCancel={() => onOpenChange(false)}
      />
    </Dialog>
  )
}
