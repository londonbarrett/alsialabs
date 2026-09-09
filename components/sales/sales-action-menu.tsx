"use client"

import { ActionMenu } from "@/components/common/action-menu"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import {
  cancelInvoice,
  deleteInvoice,
  markInvoiceAsSent,
  reopenInvoice,
} from "@/lib/actions/invoices"
import type { Invoice } from "@/lib/drizzle/schema"
import { useActionError } from "@/lib/util/action-errors"
import { Banknote, HandCoins, Send, Undo2, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface SalesActionMenuProps {
  invoice: Invoice
  permissions: string[]
  onEdit: () => void
  onViewPayments: () => void
  onRecordPayment: () => void
  onDelete?: () => void | Promise<void>
  onCancel?: () => void | Promise<void>
  onReopen?: () => void | Promise<void>
  onMarkSent?: () => void | Promise<void>
}

export function SalesActionMenu({
  invoice,
  permissions,
  onEdit,
  onViewPayments,
  onRecordPayment,
  onDelete,
  onCancel,
  onReopen,
  onMarkSent,
}: SalesActionMenuProps) {
  const t = useTranslations()
  const translateError = useActionError()
  const router = useRouter()

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

  const handleMarkSent = onMarkSent
    ? async () => {
        await onMarkSent()
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

  return (
    <ActionMenu
      entityName={t("invoiceItem.invoice")}
      onEdit={permissions.includes("sales:edit") ? onEdit : undefined}
      onDelete={handleDelete}
      canDelete={permissions.includes("sales:delete")}
    >
      <DropdownMenuItem onClick={onViewPayments}>
        <Banknote className="mr-2 h-4 w-4" />
        {t("sales.viewPayments")}
      </DropdownMenuItem>
      {invoice.status === "draft" && (
        <DropdownMenuItem onClick={handleMarkSent}>
          <Send className="mr-2 h-4 w-4" />
          {t("sales.sendInvoice")}
        </DropdownMenuItem>
      )}
      {permissions.includes("sales:create") &&
        invoice.status !== "paid" &&
        invoice.status !== "cancelled" && (
          <DropdownMenuItem onClick={onRecordPayment}>
            <HandCoins className="mr-2 h-4 w-4" />
            {t("sales.recordPayment")}
          </DropdownMenuItem>
        )}
      {invoice.status !== "cancelled" &&
        invoice.status !== "paid" &&
        permissions.includes("sales:edit") && (
          <DropdownMenuItem onClick={handleCancel}>
            <X className="mr-2 h-4 w-4" />
            {t("sales.cancelInvoice")}
          </DropdownMenuItem>
        )}
      {invoice.status === "cancelled" && (
        <DropdownMenuItem onClick={handleReopen}>
          <Undo2 className="mr-2 h-4 w-4" />
          {t("sales.reopenInvoice")}
        </DropdownMenuItem>
      )}
    </ActionMenu>
  )
}
