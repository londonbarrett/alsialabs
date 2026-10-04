"use client"

import { ActionMenu } from "@/components/common/action-menu"
import { PaymentDialog } from "@/components/sales/payment-dialog"
import type { PaymentFormValues } from "@/components/sales/payment-form"
import { Spinner } from "@/components/ui/spinner"
import type { Invoice, InvoicePayment } from "@/lib/drizzle/schema"
import { formatCurrency } from "@/lib/util/money"
import { useInvoiceStore } from "@/stores/invoice-store"
import { usePaymentActions } from "@/stores/use-payment-actions"
import { useEffect, useState } from "react"

export function PaymentHistory({
  invoice,
  canManage = false,
}: {
  invoice: Invoice
  canManage?: boolean
}) {
  const store = useInvoiceStore()
  const payments = store.getPayments(invoice.id)
  const { loadPayments, updatePayment, deletePayment } =
    usePaymentActions()
  const [editingPayment, setEditingPayment] =
    useState<InvoicePayment | null>(null)

  useEffect(() => {
    loadPayments(invoice.id)
  }, [loadPayments, invoice.id])

  async function handleDelete(payment: InvoicePayment) {
    await deletePayment(invoice, payment)
  }

  function handleEditPaymentSubmit(values: PaymentFormValues) {
    if (!editingPayment) return

    const payment = editingPayment
    setEditingPayment(null)
    updatePayment(invoice, payment, values)
  }

  if (payments === undefined) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No payments recorded yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {payments.map((payment) => (
        <div
          key={payment.id}
          className="flex items-center justify-between rounded-md border p-3"
        >
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-sm font-medium">
              {formatCurrency(payment.amount)}
            </span>
            <span className="text-xs text-muted-foreground">
              {payment.paymentDate}
              {payment.method ? ` · ${payment.method}` : ""}
              {payment.reference ? ` · ${payment.reference}` : ""}
            </span>
            {payment.notes && (
              <span className="text-xs text-muted-foreground">
                {payment.notes}
              </span>
            )}
          </div>
          {canManage && (
            <ActionMenu
              entityName={formatCurrency(payment.amount)}
              onEdit={() => setEditingPayment(payment)}
              onDelete={async () => {
                await handleDelete(payment)
              }}
              canEdit={true}
              canDelete={true}
            />
          )}
        </div>
      ))}

      {editingPayment && (
        <PaymentDialog
          payment={editingPayment}
          open={!!editingPayment}
          onOpenChange={() => setEditingPayment(null)}
          onSubmit={handleEditPaymentSubmit}
        />
      )}
    </div>
  )
}
