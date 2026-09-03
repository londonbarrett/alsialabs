"use client"

import type { MyInvoice } from "@/lib/actions/invoices"
import { formatCurrency } from "@/lib/util/money"
import { formatISODate } from "@/lib/util/schedule"
import { useTranslations } from "next-intl"

export function MyInvoiceDetails({ invoice }: { invoice: MyInvoice }) {
  const t = useTranslations()
  const outstanding = parseFloat(invoice.outstandingBalance ?? "0").toFixed(2)

  return (
    <div className="grid grid-cols-2 gap-4 rounded-md border p-3 text-xs @[600px]:grid-cols-3">
      <div>
        <p className="text-muted-foreground">{t("myInvoices.type")}</p>
        <p className="font-medium capitalize">{invoice.type}</p>
      </div>
      <div>
        <p className="text-muted-foreground">{t("myInvoices.date")}</p>
        <p className="font-medium">{formatISODate(invoice.issueDate)}</p>
      </div>
      <div>
        <p className="text-muted-foreground">{t("myInvoices.dueDate")}</p>
        <p className="font-medium">{formatISODate(invoice.dueDate)}</p>
      </div>
      <div>
        <p className="text-muted-foreground">{t("myInvoices.total")}</p>
        <p className="font-medium">{formatCurrency(invoice.grandTotal)}</p>
      </div>
      <div>
        <p className="text-muted-foreground">{t("myInvoices.paidAmount")}</p>
        <p className="font-medium">{formatCurrency(invoice.paidAmount)}</p>
      </div>
      <div>
        <p className="text-muted-foreground">{t("myInvoices.outstanding")}</p>
        <p className="font-medium">{formatCurrency(outstanding)}</p>
      </div>
    </div>
  )
}
