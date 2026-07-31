"use client"

import {
  PaymentForm,
  type PaymentFormValues,
} from "@/components/sales/payment-form"
import { recordPayment } from "@/lib/actions/sales"
import { useTranslations } from "next-intl"

interface RecordPaymentFormProps {
  invoiceId: string
  remainingBalance: string
  onSuccess: () => void
  onCancel: () => void
}

export function RecordPaymentForm({
  invoiceId,
  remainingBalance,
  onSuccess,
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
      onSubmit={(values: PaymentFormValues) =>
        recordPayment(invoiceId, values)
      }
      submitLabel={t("sales.recordPayment")}
      successMessage={t("sales.paymentRecorded")}
      onSuccess={onSuccess}
      onCancel={onCancel}
    />
  )
}
