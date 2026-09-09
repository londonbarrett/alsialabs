"use client"

import { ActionMenu } from "@/components/common/action-menu"
import { EditPaymentDialog } from "@/components/sales/edit-payment-dialog"
import type { PaymentFormValues } from "@/components/sales/payment-form"
import { Spinner } from "@/components/ui/spinner"
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import { getInvoicePayments } from "@/lib/actions/invoices"
import { deletePayment, updatePayment } from "@/lib/actions/payments"
import type { InvoicePayment } from "@/lib/drizzle/schema"
import { useActionError } from "@/lib/util/action-errors"
import { formatCurrency } from "@/lib/util/money"
import { paymentReducer } from "@/reducers/payment-reducer"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import {
  useCallback,
  useEffect,
  useOptimistic,
  useState,
  useTransition,
} from "react"
import { toast } from "sonner"

export function PaymentHistory({
  invoiceId,
  canManage = false,
}: {
  invoiceId: string
  canManage?: boolean
}) {
  const t = useTranslations()
  const translateError = useActionError()
  const { start: startLoading, stop: stopLoading } =
    useLoadingIndicator()
  const [, startTransition] = useTransition()
  const [payments, setPayments] = useState<InvoicePayment[] | null>(
    null
  )
  const [optimisticPayments, addOptimistic] = useOptimistic(
    payments ?? [],
    paymentReducer
  )
  const [editingPayment, setEditingPayment] =
    useState<InvoicePayment | null>(null)

  const { executeAsync: executeUpdate } = useAction(updatePayment)
  const { executeAsync: executeDelete } = useAction(deletePayment)

  const load = useCallback(() => {
    getInvoicePayments({ invoiceId })
      .then((res) => setPayments(res?.data ?? []))
      .catch(() => setPayments([]))
  }, [invoiceId])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete(payment: InvoicePayment) {
    // Optimistic delete
    startTransition(() => {
      addOptimistic({ type: "delete", paymentId: payment.id })
    })
    startLoading()
    const result = await executeDelete({ paymentId: payment.id })
    stopLoading()
    if (result?.data) {
      // Commit to base state so optimistic revert keeps the deletion
      setPayments((prev) =>
        prev ? prev.filter((p) => p.id !== payment.id) : prev
      )
      toast.success(t("sales.paymentDeleted"))
      return { success: true as const }
    }
    // Rollback
    startTransition(() => {
      addOptimistic({ type: "add", payment })
    })
    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
      return {
        success: false as const,
        error: translateError(result.serverError.code),
      }
    }
    toast.error(t("common.somethingWentWrong"))
    return {
      success: false as const,
      error: t("common.somethingWentWrong"),
    }
  }

  async function handleEditPaymentSubmit(values: PaymentFormValues) {
    if (!editingPayment) return { success: false as const }
    const paymentId = editingPayment.id
    const original = optimisticPayments.find((p) => p.id === paymentId)
    const optimisticPayment: InvoicePayment = {
      ...editingPayment,
      amount: values.amount,
      paymentDate: values.paymentDate,
      method: values.method || null,
      reference: values.reference || null,
      notes: values.notes || null,
    }

    // Optimistic update must be inside transition
    startTransition(() => {
      addOptimistic({ type: "update", payment: optimisticPayment })
    })
    setEditingPayment(null)
    startLoading()
    const result = await executeUpdate({ paymentId, ...values })
    stopLoading()
    if (result?.data) {
      toast.success(t("sales.paymentUpdated"))
      // Commit to base state so optimistic revert keeps the update
      setPayments((prev) =>
        prev
          ? prev.map((p) =>
              p.id === paymentId ? optimisticPayment : p
            )
          : prev
      )
      // Optionally sync with returned data if available
      if (
        result.data &&
        typeof result.data === "object" &&
        "id" in result.data
      ) {
        const real = result.data as unknown as InvoicePayment
        setPayments((prev) =>
          prev ? prev.map((p) => (p.id === paymentId ? real : p)) : prev
        )
        startTransition(() => {
          addOptimistic({ type: "update", payment: real })
        })
      }
      return { success: true as const }
    }
    // Rollback
    if (original) {
      startTransition(() => {
        addOptimistic({ type: "update", payment: original })
      })
    }
    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
      return {
        success: false as const,
        error: translateError(result.serverError.code),
      }
    }
    if (result?.validationErrors) {
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

  if (payments === null) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    )
  }

  const displayedPayments = optimisticPayments

  if (displayedPayments.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No payments recorded yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {displayedPayments.map((payment) => (
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
