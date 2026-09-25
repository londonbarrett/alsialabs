"use client"

import { Dialog } from "@/components/common/dialog"
import {
  PaymentForm,
  type PaymentFormValues,
  type PaymentSubmitResult,
} from "@/components/sales/payment-form"
import { getOutstanding } from "@/components/sales/sales-invoice-table"
import type { Invoice, InvoicePayment } from "@/lib/drizzle/schema"
import { useTranslations } from "next-intl"

interface PaymentDialogProps {
  invoice?: Invoice
  payment?: InvoicePayment
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: PaymentFormValues) => Promise<PaymentSubmitResult>
}

export function PaymentDialog({
  invoice,
  payment,
  open,
  onOpenChange,
  onSubmit,
}: PaymentDialogProps) {
  const t = useTranslations()

  if (payment) {
    return (
      <Dialog
        key={payment.id}
        title={t("sales.editPayment")}
        description={t("sales.editPaymentDesc")}
        open={open}
        onOpenChange={onOpenChange}
      >
        <PaymentForm
          initialValues={{
            amount: payment.amount,
            paymentDate: payment.paymentDate,
            method: payment.method ?? "",
            reference: payment.reference ?? "",
            notes: payment.notes ?? "",
          }}
          submitLabel={t("sales.saveChanges")}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </Dialog>
    )
  }

  if (!invoice) return null

  return (
    <Dialog
      key={invoice.id}
      title={t("sales.recordPayment")}
      description={t("sales.recordPaymentDesc")}
      open={open}
      onOpenChange={onOpenChange}
    >
      <PaymentForm
        initialValues={{
          amount: getOutstanding(invoice),
          paymentDate: new Date().toISOString().slice(0, 10),
          method: "",
          reference: "",
          notes: "",
        }}
        submitLabel={t("sales.recordPayment")}
        onSubmit={onSubmit}
        onCancel={() => onOpenChange(false)}
      />
    </Dialog>
  )
}
