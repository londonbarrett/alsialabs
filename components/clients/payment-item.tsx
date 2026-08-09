"use client"

import { ActionMenu } from "@/components/common/action-menu"
import type { InvoicePayment } from "@/lib/drizzle/schema"
import { formatCurrency } from "@/lib/util/money"
import { Banknote } from "lucide-react"
import { useTranslations } from "next-intl"

interface PaymentItemProps {
  payment: InvoicePayment
  invoiceNumber: string
  onEdit: () => void
  onDelete: () => Promise<void>
  canEdit?: boolean
  canDelete?: boolean
}

export function PaymentItem({
  payment,
  invoiceNumber,
  onEdit,
  onDelete,
  canEdit = false,
  canDelete = false,
}: PaymentItemProps) {
  const t = useTranslations()
  const [y, m, d] = payment.paymentDate.split("-")
  const date = `${m}/${d}/${y}`

  return (
    <div className="group flex items-start gap-3 py-3">
      <div className="mt-0.5 text-sky-500">
        <Banknote className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {t("paymentItem.payment")}
          </span>
          <span className="text-xs text-muted-foreground">{date}</span>
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
            onEdit={onEdit}
            onDelete={onDelete}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </div>
      ) : null}
    </div>
  )
}
