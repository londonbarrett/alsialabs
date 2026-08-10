"use client"

import { ActionMenu } from "@/components/common/action-menu"
import { EditPaymentDialog } from "@/components/sales/edit-payment-dialog"
import type { PaymentFormValues } from "@/components/sales/payment-form"
import { Spinner } from "@/components/ui/spinner"
import {
  deletePayment,
  getInvoicePayments,
  updatePayment,
} from "@/lib/actions/sales"
import type { InvoicePayment } from "@/lib/drizzle/schema"
import { formatCurrency } from "@/lib/util/money"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

export function PaymentHistory({
  invoiceId,
  canManage = false,
}: {
  invoiceId: string
  canManage?: boolean
}) {
  const t = useTranslations()
  const [payments, setPayments] = useState<InvoicePayment[] | null>(
    null
  )
  const [editingPayment, setEditingPayment] =
    useState<InvoicePayment | null>(null)

  const load = useCallback(() => {
    getInvoicePayments(invoiceId)
      .then(setPayments)
      .catch(() => setPayments([]))
  }, [invoiceId])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete(payment: InvoicePayment) {
    const result = await deletePayment(payment.id)
    if (result.success) {
      toast.success(t("sales.paymentDeleted"))
      load()
    } else {
      toast.error(result.error || t("common.somethingWentWrong"))
    }
  }

  async function handleEditPaymentSubmit(values: PaymentFormValues) {
    if (!editingPayment) return { success: false as const }
    const paymentId = editingPayment.id
    setEditingPayment(null)
    const result = await updatePayment(paymentId, values)
    if (result.success) {
      toast.success(t("sales.paymentUpdated"))
      load()
    } else {
      toast.error(result.error || t("common.somethingWentWrong"))
    }
    return result
  }

  if (payments === null) {
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
              onDelete={() => handleDelete(payment)}
              canEdit={true}
              canDelete={true}
            />
          )}
        </div>
      ))}

      {editingPayment && (
        <EditPaymentDialog
          payment={editingPayment}
          open={!!editingPayment}
          onOpenChange={() => setEditingPayment(null)}
          onSubmit={handleEditPaymentSubmit}
        />
      )}
    </div>
  )
}
