"use client"

import { Dialog } from "@/components/common/dialog"
import { PaymentHistory } from "@/components/sales/payment-history"
import type { Invoice } from "@/lib/drizzle/schema"
import { useTranslations } from "next-intl"

interface PaymentHistoryDialogProps {
  invoice: Invoice
  open: boolean
  onOpenChange: (open: boolean) => void
  canManage: boolean
}

export function PaymentHistoryDialog({
  invoice,
  open,
  onOpenChange,
  canManage,
}: PaymentHistoryDialogProps) {
  const t = useTranslations()

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
