"use client"

import { InvoiceDialog } from "@/components/sales/invoice-dialog"
import { PaymentHistoryDialog } from "@/components/sales/payment-history-dialog"
import { RecordPaymentDialog } from "@/components/sales/record-payment-dialog"
import type { Invoice } from "@/lib/drizzle/schema"
import type { InvoiceFormData } from "@/lib/schemas/invoice"
import type { PaymentFormValues } from "@/components/sales/payment-form"

interface InvoiceSubmitResult {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
  data?: unknown
}

interface PaymentSubmitResult {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
}

interface InvoiceDialogsProps {
  editingInvoice: Invoice | undefined
  dialogOpen: boolean
  onDialogOpenChange: (open: boolean) => void
  onInvoiceSubmit: (
    data: InvoiceFormData,
    invoiceId?: string
  ) => Promise<InvoiceSubmitResult>
  paymentInvoice: Invoice | null
  onPaymentInvoiceChange: (invoice: Invoice | null) => void
  onPaymentSubmit: (
    values: PaymentFormValues
  ) => Promise<PaymentSubmitResult>
  historyInvoice: Invoice | null
  onHistoryInvoiceChange: (invoice: Invoice | null) => void
  canManagePayments: boolean
}

export function InvoiceDialogs({
  editingInvoice,
  dialogOpen,
  onDialogOpenChange,
  onInvoiceSubmit,
  paymentInvoice,
  onPaymentInvoiceChange,
  onPaymentSubmit,
  historyInvoice,
  onHistoryInvoiceChange,
  canManagePayments,
}: InvoiceDialogsProps) {
  return (
    <>
      <InvoiceDialog
        invoice={editingInvoice}
        open={dialogOpen}
        onOpenChange={onDialogOpenChange}
        onSubmit={onInvoiceSubmit}
      />
      {paymentInvoice && (
        <RecordPaymentDialog
          invoice={paymentInvoice}
          open={!!paymentInvoice}
          onOpenChange={() => onPaymentInvoiceChange(null)}
          onSubmit={onPaymentSubmit}
        />
      )}
      {historyInvoice && (
        <PaymentHistoryDialog
          invoice={historyInvoice}
          open={!!historyInvoice}
          onOpenChange={() => onHistoryInvoiceChange(null)}
          canManage={canManagePayments}
        />
      )}
    </>
  )
}
