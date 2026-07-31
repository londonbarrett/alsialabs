"use client"

import { Banknote } from "lucide-react"
import { useTranslations } from "next-intl"

interface PaymentItemProps {
  invoiceNumber: string
  amount: string
  paymentDate: string
  method?: string | null
}

export function PaymentItem({
  invoiceNumber,
  amount,
  paymentDate,
  method,
}: PaymentItemProps) {
  const t = useTranslations("paymentItem")
  const [y, m, d] = paymentDate.split("-")
  const date = `${m}/${d}/${y}`

  const total = parseFloat(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
  })

  return (
    <div className="group flex items-start gap-3 py-3">
      <div className="mt-0.5 text-sky-500">
        <Banknote className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("payment")}</span>
          <span className="text-xs text-muted-foreground">{date}</span>
        </div>
        <p className="mt-0.5 text-sm">
          <span className="font-mono">{invoiceNumber}</span>
          {" — "}
          <span className="font-semibold">
            {t("currencyPrefix")}
            {total}
          </span>
          {method ? (
            <span className="text-muted-foreground">
              {" · "}
              {method}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  )
}
