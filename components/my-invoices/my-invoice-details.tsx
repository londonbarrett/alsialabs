"use client"

import type { MyInvoiceDTO } from "@/actions/schemas/invoice"
import { formatCurrency } from "@/lib/util/money"
import { formatISODate } from "@/lib/util/schedule"
import { useTranslations } from "next-intl"

export function MyInvoiceDetails({
  invoice,
}: {
  invoice: MyInvoiceDTO
}) {
  const t = useTranslations()
  const outstanding = parseFloat(
    invoice.outstandingBalance ?? "0"
  ).toFixed(2)

  return (
    <div className="grid grid-cols-2 gap-4 rounded-md border p-3 text-xs @[600px]:grid-cols-3">
      <div>
        <p className="text-muted-foreground">{t("common.type")}</p>
        <p className="font-medium capitalize">{invoice.type}</p>
      </div>
      <div>
        <p className="text-muted-foreground">
          {t("invoice.issueDate")}
        </p>
        <p className="font-medium">
          {formatISODate(invoice.issueDate)}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground">{t("common.dueDate")}</p>
        <p className="font-medium">{formatISODate(invoice.dueDate)}</p>
      </div>
      <div>
        <p className="text-muted-foreground">{t("common.total")}</p>
        <p className="font-medium">
          {formatCurrency(invoice.grandTotal)}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground">{t("invoice.paid")}</p>
        <p className="font-medium">
          {formatCurrency(invoice.paidAmount)}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground">
          {t("invoice.outstanding")}
        </p>
        <p className="font-medium">{formatCurrency(outstanding)}</p>
      </div>
      <div>
        <p className="text-muted-foreground">{t("common.project")}</p>
        <p className="font-medium">{invoice.projectName ?? "—"}</p>
      </div>
    </div>
  )
}
