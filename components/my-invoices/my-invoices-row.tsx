"use client"

import { StatusBadge } from "@/components/sales/status-badge"
import { TableCell, TableRow } from "@/components/ui/table"
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import type { MyInvoice } from "@/lib/actions/invoices"
import { getMyInvoiceDetails } from "@/lib/actions/invoices"
import type { InvoiceItem, InvoicePayment } from "@/lib/drizzle/schema"
import { formatCurrency } from "@/lib/util/money"
import { formatISODate } from "@/lib/util/schedule"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useTranslations } from "next-intl"
import { Activity, Fragment, useEffect, useState } from "react"
import { MyInvoiceDetails } from "./my-invoice-details"
import { MyInvoicesItemsTable } from "./my-invoices-items-table"
import { MyInvoicesPaymentsTable } from "./my-invoices-payments-table"

type Details = {
  items: InvoiceItem[]
  payments: InvoicePayment[]
}

function InvoiceDetailsRow({
  invoice,
  details,
  loading,
}: {
  invoice: MyInvoice
  details: Details | null
  loading: boolean
}) {
  const t = useTranslations()

  return (
    <TableRow>
      <TableCell colSpan={5} className="bg-muted/30 p-4">
        {loading ? (
          <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <div className="flex flex-col gap-6">
            <MyInvoiceDetails invoice={invoice} />
            <div className="flex flex-col gap-6 @[900px]:flex-row">
              <div className="flex-1">
                <h4 className="mb-2 text-sm font-semibold">{t("myInvoices.lineItems")}</h4>
                <MyInvoicesItemsTable items={details?.items ?? []} />
              </div>
              <div className="flex-1">
                <h4 className="mb-2 text-sm font-semibold">{t("myInvoices.paymentHistory")}</h4>
                <MyInvoicesPaymentsTable payments={details?.payments ?? []} />
              </div>
            </div>
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}

export function MyInvoicesRow({ invoice }: { invoice: MyInvoice }) {
  const [expanded, setExpanded] = useState(false)
  const [details, setDetails] = useState<Details | null>(null)
  const [loading, setLoading] = useState(false)
  const { start: startLoading, stop: stopLoading } = useLoadingIndicator()
  const outstanding = invoice.outstandingBalance ?? "0"

  useEffect(() => {
    if (!expanded) return
    if (details !== null) return
    let cancelled = false
    async function load() {
      setLoading(true)
      startLoading()
      const result = await getMyInvoiceDetails({
        invoiceId: invoice.id,
      })
      if (cancelled) {
        setLoading(false)
        stopLoading()
        return
      }
      if (result.data) {
        setDetails({
          items: result.data.items,
          payments: result.data.payments,
        })
      } else {
        setDetails({ items: [], payments: [] })
      }
      setLoading(false)
      stopLoading()
    }
    load()
    return () => {
      cancelled = true
    }
  }, [expanded, invoice.id, details, startLoading, stopLoading])

  return (
    <Fragment>
      <TableRow className="cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <TableCell className="font-mono text-xs font-medium">
          <span className="inline-flex items-center gap-2">
            {expanded ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            {invoice.invoiceNumber}
          </span>
        </TableCell>
        <TableCell className="text-xs">{formatISODate(invoice.issueDate)}</TableCell>
        <TableCell>
          <StatusBadge status={invoice.status} />
        </TableCell>
        <TableCell className="text-right text-xs font-medium">{formatCurrency(outstanding)}</TableCell>
        <TableCell className="text-right text-xs font-medium">{formatCurrency(invoice.grandTotal)}</TableCell>
      </TableRow>
      <Activity mode={expanded ? "visible" : "hidden"}>
        <InvoiceDetailsRow invoice={invoice} details={details} loading={loading} />
      </Activity>
    </Fragment>
  )
}
