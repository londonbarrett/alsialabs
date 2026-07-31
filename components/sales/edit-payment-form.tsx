"use client"

import {
  PaymentForm,
  type PaymentFormValues,
} from "@/components/sales/payment-form"
import { updatePayment } from "@/lib/actions/sales"
import type { InvoicePayment } from "@/lib/drizzle/schema"
import { useTranslations } from "next-intl"

interface EditPaymentFormProps {
  payment: InvoicePayment
  onSuccess: () => void
  onCancel: () => void
}

export function EditPaymentForm({
  payment,
  onSuccess,
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
      onSubmit={(values: PaymentFormValues) =>
        updatePayment(payment.id, values)
      }
      submitLabel={t("sales.saveChanges")}
      successMessage={t("sales.paymentUpdated")}
      onSuccess={onSuccess}
      onCancel={onCancel}
    />
  )
}
