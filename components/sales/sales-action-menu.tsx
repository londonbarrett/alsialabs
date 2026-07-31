"use client"

import { ActionMenu } from "@/components/common/action-menu"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import {
  cancelInvoice,
  deleteInvoice,
  markInvoiceAsSent,
  reopenInvoice,
} from "@/lib/actions/sales"
import type { Invoice } from "@/lib/drizzle/schema"
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
}

export function SalesActionMenu({
  invoice,
  permissions,
  onEdit,
  onViewPayments,
  onRecordPayment,
}: SalesActionMenuProps) {
  const t = useTranslations()
  const router = useRouter()

  return (
    <ActionMenu
      entityName={t("invoiceItem.invoice")}
      onEdit={permissions.includes("sales:edit") ? onEdit : undefined}
      onDelete={async () => {
        const result = await deleteInvoice(invoice.id)
        if (!result.success)
          toast.error(result.error || t("sales.failedToDelete"))
        else toast.success(t("sales.invoiceDeleted"))
      }}
      canDelete={permissions.includes("sales:delete")}
    >
      <DropdownMenuItem onClick={onViewPayments}>
        <Banknote className="mr-2 h-4 w-4" />
        {t("sales.viewPayments")}
      </DropdownMenuItem>
      {invoice.status === "draft" && (
        <DropdownMenuItem
          onClick={async () => {
            const result = await markInvoiceAsSent(invoice.id)
            if (!result.success)
              toast.error(
                result.error || t("common.somethingWentWrong")
              )
            else {
              toast.success(t("sales.invoiceSent"))
              router.refresh()
            }
          }}
        >
          <Send className="mr-2 h-4 w-4" />
          {t("sales.sendInvoice")}
        </DropdownMenuItem>
      )}
      {permissions.includes("sales:record-payment") &&
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
          <DropdownMenuItem
            onClick={async () => {
              const result = await cancelInvoice(invoice.id)
              if (!result.success)
                toast.error(
                  result.error || t("common.somethingWentWrong")
                )
              else {
                toast.success(t("sales.invoiceCancelled"))
                router.refresh()
              }
            }}
          >
            <X className="mr-2 h-4 w-4" />
            {t("sales.cancelInvoice")}
          </DropdownMenuItem>
        )}
      {invoice.status === "cancelled" && (
        <DropdownMenuItem
          onClick={async () => {
            const result = await reopenInvoice(invoice.id)
            if (!result.success)
              toast.error(
                result.error || t("common.somethingWentWrong")
              )
            else {
              toast.success(t("sales.invoiceReopened"))
              router.refresh()
            }
          }}
        >
          <Undo2 className="mr-2 h-4 w-4" />
          {t("sales.reopenInvoice")}
        </DropdownMenuItem>
      )}
    </ActionMenu>
  )
}
