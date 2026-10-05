"use client"

import { ActionMenu } from "@/components/common/action-menu"
import { PaymentDialog } from "@/components/sales/payment-dialog"
import type { PaymentFormValues } from "@/components/sales/payment-form"
import type { InvoicePayment } from "@/lib/drizzle/schema"
import { formatCurrency } from "@/lib/util/money"
import { useHasPermission } from "@/components/common/permissions-provider"
import { useTimelineActions } from "@/stores/use-timeline-actions"
import { Banknote } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

interface PaymentItemProps {
  payment: InvoicePayment
  invoiceNumber: string
}

export function PaymentItem({
  payment,
  invoiceNumber,
}: PaymentItemProps) {
  const t = useTranslations()
  const canEdit = useHasPermission("sales:edit")
  const canDelete = useHasPermission("sales:delete")
  const { updatePayment, deletePayment } = useTimelineActions()
  const [dialog, setDialog] = useState<{
    open: boolean
    editing?: InvoicePayment
  }>({ open: false })

  const [y, m, d] = payment.paymentDate.split("-")
  const date = `${m}/${d}/${y}`

  async function handleDelete() {
    await deletePayment(payment.id)
  }

  function handleEditSubmit(values: PaymentFormValues) {
    const editing = dialog.editing
    if (!editing) return

    setDialog({ open: false })
    updatePayment(editing.id, values)
  }

  return (
    <>
      <div className="group flex items-start gap-3 py-3">
        <div className="mt-0.5 text-sky-500">
          <Banknote className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {t("paymentItem.payment")}
            </span>
            <span className="text-xs text-muted-foreground">
              {date}
            </span>
          </div>
          <p className="mt-0.5 text-sm">
            <span className="font-mono">{invoiceNumber}</span>
            {" — "}
            <span className="font-semibold">
              {formatCurrency(payment.amount)}
            </span>
            {payment.method ? (
              <span className="text-muted-foreground">
                {" · "}
                {payment.method}
              </span>
            ) : null}
          </p>
        </div>
        {canEdit || canDelete ? (
          <div className="opacity-0 transition-opacity group-hover:opacity-100">
            <ActionMenu
              entityName={formatCurrency(payment.amount)}
              onEdit={() => setDialog({ open: true, editing: payment })}
              onDelete={handleDelete}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          </div>
        ) : null}
      </div>
      <PaymentDialog
        payment={dialog.editing}
        open={dialog.open}
        onOpenChange={(o) =>
          setDialog((s) => ({
            open: o,
            editing: o ? s.editing : undefined,
          }))
        }
        onSubmit={handleEditSubmit}
      />
    </>
  )
}
