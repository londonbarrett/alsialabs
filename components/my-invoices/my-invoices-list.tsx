"use client"

import type { MyInvoiceDTO } from "@/actions/schemas/invoice"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTranslations } from "next-intl"
import { MyInvoicesRow } from "./my-invoices-row"

interface Props {
  invoices: MyInvoiceDTO[]
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
                <TableHead>{t("invoice.invoiceNumber")}</TableHead>
                <TableHead>{t("invoice.issueDate")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-right">
                  {t("invoice.outstanding")}
                </TableHead>
                <TableHead className="text-right">
                  {t("common.total")}
                </TableHead>
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
