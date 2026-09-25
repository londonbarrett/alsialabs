"use client"

import { Dialog } from "@/components/common/dialog"
import { PaymentHistory } from "@/components/sales/payment-history"
import type { Invoice } from "@/lib/drizzle/schema"
import { useHasPermission } from "@/stores/permissions-store"
import { useTranslations } from "next-intl"

interface PaymentHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice?: Invoice
}

export function PaymentHistoryDialog({
  open,
  onOpenChange,
  invoice,
}: PaymentHistoryDialogProps) {
  const t = useTranslations()

  const canEditSales = useHasPermission("sales:edit")
  const canCreateSales = useHasPermission("sales:create")
  const canDeleteSales = useHasPermission("sales:delete")
  const canManage = canEditSales || canCreateSales || canDeleteSales

  if (!invoice) return null

  return (
    <Dialog
      title={t("sales.paymentHistory")}
      description={t("sales.paymentHistoryDesc", {
        number: invoice.invoiceNumber,
      })}
      open={open}
      onOpenChange={onOpenChange}
    >
      <PaymentHistory invoiceId={invoice.id} canManage={canManage} />
    </Dialog>
  )
}
