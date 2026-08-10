"use client"

import {
  PaymentForm,
  type PaymentFormValues,
  type PaymentSubmitResult,
} from "@/components/sales/payment-form"
import type { InvoicePayment } from "@/lib/drizzle/schema"
import { useTranslations } from "next-intl"

interface EditPaymentFormProps {
  payment: InvoicePayment
  onSubmit: (values: PaymentFormValues) => Promise<PaymentSubmitResult>
  onCancel: () => void
}

export function EditPaymentForm({
  payment,
  onSubmit,
  onCancel,
}: EditPaymentFormProps) {
  const t = useTranslations()

  return (
    <PaymentForm
      initialValues={{
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        method: payment.method ?? "",
        reference: payment.reference ?? "",
        notes: payment.notes ?? "",
      }}
      onSubmit={onSubmit}
      submitLabel={t("sales.saveChanges")}
      onCancel={onCancel}
    />
  )
}
