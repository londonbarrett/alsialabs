"use client"

import { SalesActionMenu } from "@/components/sales/sales-action-menu"
import { StatusBadge } from "@/components/sales/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Invoice } from "@/lib/drizzle/schema"
import { useTranslations } from "next-intl"
import Link from "next/link"

export type InvoiceWithClientName = Invoice & {
  clientName: string | null
}

export function getOutstanding(invoice: {
  grandTotal: string
  paidAmount?: string | null
}): string {
  const total = parseFloat(invoice.grandTotal) || 0
  const paid = parseFloat(invoice.paidAmount ?? "0") || 0
  return (total - paid).toFixed(2)
}

interface SalesInvoiceTableProps {
  invoices: InvoiceWithClientName[]
  permissions?: string[]
  onEdit: (invoice: InvoiceWithClientName) => void
  onViewPayments: (invoice: InvoiceWithClientName) => void
  onRecordPayment: (invoice: InvoiceWithClientName) => void
}

export function SalesInvoiceTable({
  invoices,
  permissions = [],
  onEdit,
  onViewPayments,
  onRecordPayment,
}: SalesInvoiceTableProps) {
  const t = useTranslations()

  return (
    <div
      className="max-h-[calc(100vh-10rem)] overflow-auto rounded-md border"
      role="region"
      aria-label={t("sales.title")}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{t("sales.invoiceHash")}</TableHead>
            <TableHead scope="col">{t("sales.client")}</TableHead>
            <TableHead scope="col">{t("sales.type")}</TableHead>
            <TableHead scope="col">{t("sales.date")}</TableHead>
            <TableHead scope="col">{t("sales.dueDate")}</TableHead>
            <TableHead scope="col">{t("sales.total")}</TableHead>
            <TableHead scope="col">{t("sales.outstanding")}</TableHead>
            <TableHead scope="col">{t("sales.status")}</TableHead>
            <TableHead scope="col">{t("sales.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => {
            const outstanding = getOutstanding(inv)
            return (
              <TableRow
                key={inv.id}
                className="select-none"
                onDoubleClick={() =>
                  permissions.includes("sales:edit") && onEdit(inv)
                }
              >
                <TableCell className="font-mono text-xs">
                  {inv.invoiceNumber}
                </TableCell>
                <TableCell>
                  {inv.clientName ? (
                    <Link
                      href={`/dashboard/clients/${inv.clientId}`}
                      className="hover:underline"
                    >
                      {inv.clientName}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="capitalize">{inv.type}</TableCell>
                <TableCell>{inv.issueDate}</TableCell>
                <TableCell>{inv.dueDate ?? "—"}</TableCell>
                <TableCell>
                  $
                  {parseFloat(inv.grandTotal).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </TableCell>
                <TableCell>
                  {parseFloat(outstanding) > 0 ? (
                    <span className="font-mono">
                      $
                      {parseFloat(outstanding).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">$0.00</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={inv.status} />
                </TableCell>
                <TableCell>
                  <SalesActionMenu
                    invoice={inv}
                    permissions={permissions}
                    onEdit={() => onEdit(inv)}
                    onViewPayments={() => onViewPayments(inv)}
                    onRecordPayment={() => onRecordPayment(inv)}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
