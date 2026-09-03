"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { InvoicePayment } from "@/lib/drizzle/schema"
import { formatCurrency } from "@/lib/util/money"
import { formatISODate } from "@/lib/util/schedule"
import { useTranslations } from "next-intl"

export function MyInvoicesPaymentsTable({
  payments,
}: {
  payments: InvoicePayment[]
}) {
  const t = useTranslations()

  if (!payments.length) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("myInvoices.noPayments")}
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">
            {t("myInvoices.paymentDate")}
          </TableHead>
          <TableHead className="text-right text-xs">
            {t("myInvoices.amount")}
          </TableHead>
          <TableHead className="text-xs">
            {t("myInvoices.paymentMethod")}
          </TableHead>
          <TableHead className="text-xs">
            {t("myInvoices.reference")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="text-xs">
              {formatISODate(p.paymentDate)}
            </TableCell>
            <TableCell className="text-right text-xs font-medium">
              {formatCurrency(p.amount)}
            </TableCell>
            <TableCell className="text-xs">{p.method ?? "—"}</TableCell>
            <TableCell className="text-xs">
              {p.reference ?? "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
