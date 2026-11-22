"use client"

import { ActionMenu } from "@/components/common/action-menu"
import type { MenuAction } from "@/lib/types"
import {
  cancelInvoice,
  deleteInvoice,
  markInvoiceAsSent,
  reopenInvoice,
} from "@/actions/invoices"
import type { Invoice } from "@/lib/drizzle/schema"
import { useActionError } from "@/lib/util/action-errors"
import { useHasPermission } from "@/components/common/permissions-provider"
import { Banknote, HandCoins, Send, Undo2, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface SalesActionMenuProps {
  invoice: Invoice
  onEdit: () => void
  onViewPayments: () => void
  onRecordPayment: () => void
  onDelete?: () => void | Promise<void>
  onCancel?: () => void | Promise<void>
  onReopen?: () => void | Promise<void>
  onSend?: () => void | Promise<void>
}

export function SalesActionMenu({
  invoice,
  onEdit,
  onViewPayments,
  onRecordPayment,
  onDelete,
  onCancel,
  onReopen,
  onSend,
}: SalesActionMenuProps) {
  const t = useTranslations()
  const translateError = useActionError()
  const router = useRouter()
  const canCreate = useHasPermission("sales:create")
  const canEdit = useHasPermission("sales:edit")
  const canDelete = useHasPermission("sales:delete")

  const handleDelete = onDelete
    ? async () => {
        await onDelete()
      }
    : async () => {
        const result = await deleteInvoice({ invoiceId: invoice.id })
        if (result.serverError)
          toast.error(translateError(result.serverError.code))
        else if (result.data) toast.success(t("sales.invoiceDeleted"))
        else toast.error(t("sales.failedToDelete"))
      }

  const handleSend = onSend
    ? async () => {
        await onSend()
      }
    : async () => {
        const result = await markInvoiceAsSent({
          invoiceId: invoice.id,
        })
        if (result.serverError)
          toast.error(translateError(result.serverError.code))
        else if (result.data) {
          toast.success(t("sales.invoiceSent"))
          router.refresh()
        } else toast.error(t("common.somethingWentWrong"))
      }

  const handleCancel = onCancel
    ? async () => {
        await onCancel()
      }
    : async () => {
        const result = await cancelInvoice({
          invoiceId: invoice.id,
        })
        if (result.serverError)
          toast.error(translateError(result.serverError.code))
        else if (result.data) {
          toast.success(t("sales.invoiceCancelled"))
          router.refresh()
        } else toast.error(t("common.somethingWentWrong"))
      }

  const handleReopen = onReopen
    ? async () => {
        await onReopen()
      }
    : async () => {
        const result = await reopenInvoice({
          invoiceId: invoice.id,
        })
        if (result.serverError)
          toast.error(translateError(result.serverError.code))
        else if (result.data) {
          toast.success(t("sales.invoiceReopened"))
          router.refresh()
        } else toast.error(t("common.somethingWentWrong"))
      }

  const actions: MenuAction[] = [
    {
      key: "view-payments",
      label: t("sales.viewPayments"),
      icon: Banknote,
      onSelect: onViewPayments,
    },
  ]

  if (invoice.status === "draft") {
    actions.push({
      key: "send",
      label: t("sales.sendInvoice"),
      icon: Send,
      onSelect: handleSend,
    })
  }
  if (
    canCreate &&
    invoice.status !== "paid" &&
    invoice.status !== "cancelled"
  ) {
    actions.push({
      key: "record-payment",
      label: t("sales.recordPayment"),
      icon: HandCoins,
      onSelect: onRecordPayment,
    })
  }
  if (
    invoice.status !== "cancelled" &&
    invoice.status !== "paid" &&
    canEdit
  ) {
    actions.push({
      key: "cancel",
      label: t("sales.cancelInvoice"),
      icon: X,
      onSelect: handleCancel,
    })
  }
  if (invoice.status === "cancelled") {
    actions.push({
      key: "reopen",
      label: t("sales.reopenInvoice"),
      icon: Undo2,
      onSelect: handleReopen,
    })
  }

  return (
    <ActionMenu
      entityName={t("invoiceItem.invoice")}
      onEdit={canEdit ? onEdit : undefined}
      onDelete={handleDelete}
      canDelete={canDelete}
      actions={actions}
    />
  )
}
