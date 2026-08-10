"use client"

import { Dialog } from "@/components/common/dialog"
import { EditPaymentForm } from "@/components/sales/edit-payment-form"
import type {
  PaymentFormValues,
  PaymentSubmitResult,
} from "@/components/sales/payment-form"
import type { InvoicePayment } from "@/lib/drizzle/schema"
import { useTranslations } from "next-intl"

interface EditPaymentDialogProps {
  payment: InvoicePayment
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: PaymentFormValues) => Promise<PaymentSubmitResult>
}

export function EditPaymentDialog({
  payment,
  open,
  onOpenChange,
  onSubmit,
}: EditPaymentDialogProps) {
  const t = useTranslations()

  return (
    <Dialog
      key={payment.id}
      title={t("sales.editPayment")}
      description={t("sales.editPaymentDesc")}
      open={open}
      onOpenChange={onOpenChange}
    >
      <EditPaymentForm
        payment={payment}
        onSubmit={onSubmit}
        onCancel={() => onOpenChange(false)}
      />
    </Dialog>
  )
}
