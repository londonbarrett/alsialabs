"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { InvoiceItem } from "@/lib/drizzle/schema"
import { formatCurrency, formatQuantity } from "@/lib/util/money"
import { useTranslations } from "next-intl"

export function MyInvoicesItemsTable({ items }: { items: InvoiceItem[] }) {
  const t = useTranslations()

  if (!items.length) {
    return <p className="text-xs text-muted-foreground">{t("myInvoices.noItems")}</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">{t("myInvoices.description")}</TableHead>
          <TableHead className="text-right text-xs">{t("myInvoices.qty")}</TableHead>
          <TableHead className="text-right text-xs">{t("myInvoices.unitPrice")}</TableHead>
          <TableHead className="text-right text-xs">{t("myInvoices.total")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="max-w-50 truncate text-xs">
              {item.description}
              {(item.discountPercent !== "0" || item.taxPercent !== "0") && (
                <span className="ml-1 text-[10px] text-muted-foreground">
                  {item.discountPercent !== "0" ? ` -${item.discountPercent}%` : ""}
                  {item.taxPercent !== "0" ? ` +${item.taxPercent}%` : ""}
                </span>
              )}
            </TableCell>
            <TableCell className="text-right text-xs">{formatQuantity(item.quantity)}</TableCell>
            <TableCell className="text-right text-xs">{formatCurrency(item.unitPrice)}</TableCell>
            <TableCell className="text-right text-xs font-medium">{formatCurrency(item.total)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
