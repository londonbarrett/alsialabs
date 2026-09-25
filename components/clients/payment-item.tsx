"use client"

import { ActionMenu } from "@/components/common/action-menu"
import { PaymentDialog } from "@/components/sales/payment-dialog"
import type {
  PaymentFormValues,
  PaymentSubmitResult,
} from "@/components/sales/payment-form"
import { useOptimisticAction } from "@/hooks/use-optimistic-store"
import { deletePayment, updatePayment } from "@/lib/actions/payments"
import type { InvoicePayment } from "@/lib/drizzle/schema"
import { useActionError } from "@/lib/util/action-errors"
import { formatCurrency } from "@/lib/util/money"
import { useHasPermission } from "@/stores/permissions-store"
import { useTimelineStore } from "@/stores/timeline-store"
import { Banknote } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

interface PaymentItemProps {
  payment: InvoicePayment
  invoiceNumber: string
  clientId: string
}

export function PaymentItem({
  payment,
  invoiceNumber,
  clientId,
}: PaymentItemProps) {
  const t = useTranslations()
  const translateError = useActionError()
  const canEdit = useHasPermission("sales:edit")
  const canDelete = useHasPermission("sales:delete")
  const { run } = useOptimisticAction(useTimelineStore)
  const [dialog, setDialog] = useState<{
    open: boolean
    editing?: InvoicePayment
  }>({ open: false })

  const [y, m, d] = payment.paymentDate.split("-")
  const date = `${m}/${d}/${y}`

  async function handleDelete() {
    const result = await run(
      { type: "remove", kind: "payment", id: payment.id },
      () => deletePayment({ paymentId: payment.id }),
      { key: clientId }
    )
    if (result.serverError) {
      toast.error(translateError(result.serverError.code))
    } else if (result.data) {
      toast.success(t("sales.paymentDeleted"))
    } else {
      toast.error(t("common.somethingWentWrong"))
    }
  }

  async function handleEditSubmit(
    values: PaymentFormValues
  ): Promise<PaymentSubmitResult> {
    const patch = {
      amount: values.amount,
      paymentDate: values.paymentDate,
      method: values.method || null,
      reference: values.reference || null,
      notes: values.notes || null,
    }

    setDialog({ open: false })
    const result = await run(
      { type: "patch", kind: "payment", id: payment.id, patch },
      () => updatePayment({ paymentId: payment.id, ...values }),
      { key: clientId }
    )

    if (result.data) {
      toast.success(t("sales.paymentUpdated"))
      return { success: true as const }
    }

    if (result.serverError) {
      toast.error(translateError(result.serverError.code))
      return {
        success: false as const,
        error: translateError(result.serverError.code),
      }
    }
    if (result.validationErrors) {
      return {
        success: false as const,
        error: t("common.somethingWentWrong"),
        fieldErrors: result.validationErrors as Record<
          string,
          string[] | undefined
        >,
      }
    }
    toast.error(t("common.somethingWentWrong"))
    return {
      success: false as const,
      error: t("common.somethingWentWrong"),
    }
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
