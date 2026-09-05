"use client"

import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MyInvoice } from "@/lib/actions/invoices"
import { useTranslations } from "next-intl"
import { MyInvoicesRow } from "./my-invoices-row"

interface Props {
  invoices: MyInvoice[]
}

export function MyInvoicesList({ invoices }: Props) {
  const t = useTranslations()

  return (
    <Card>
      <CardContent>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("myInvoices.invoiceHash")}</TableHead>
                <TableHead>{t("myInvoices.date")}</TableHead>
                <TableHead>{t("myInvoices.status")}</TableHead>
                <TableHead className="text-right">{t("myInvoices.outstanding")}</TableHead>
                <TableHead className="text-right">{t("myInvoices.total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <MyInvoicesRow key={inv.id} invoice={inv} />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
