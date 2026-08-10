"use client"

import {
  PaymentForm,
  type PaymentFormValues,
  type PaymentSubmitResult,
} from "@/components/sales/payment-form"
import { useTranslations } from "next-intl"

interface RecordPaymentFormProps {
  remainingBalance: string
  onSubmit: (values: PaymentFormValues) => Promise<PaymentSubmitResult>
  onCancel: () => void
}

export function RecordPaymentForm({
  remainingBalance,
  onSubmit,
  onCancel,
}: RecordPaymentFormProps) {
  const t = useTranslations()

  return (
    <PaymentForm
      initialValues={{
        amount: remainingBalance,
        paymentDate: new Date().toISOString().slice(0, 10),
        method: "",
        reference: "",
        notes: "",
      }}
      onSubmit={onSubmit}
      submitLabel={t("sales.recordPayment")}
      onCancel={onCancel}
    />
  )
}
