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
import { useState } from "react"
import { BindProjectDialog } from "./bind-project-dialog"
import { MyInvoicesRow } from "./my-invoices-row"

interface Props {
  invoices: MyInvoiceDTO[]
}

export function MyInvoicesList({ invoices }: Props) {
  const t = useTranslations()
  const [bindId, setBindId] = useState<string | null>(null)
  const [bindOpen, setBindOpen] = useState(false)
  const [bindSeq, setBindSeq] = useState(0)
  const bindInvoice = invoices.find((i) => i.id === bindId) ?? null

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
                <TableHead>{t("common.project")}</TableHead>
                <TableHead className="text-right">
                  {t("invoice.outstanding")}
                </TableHead>
                <TableHead className="text-right">
                  {t("common.total")}
                </TableHead>
                <TableHead className="text-center">
                  {t("common.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <MyInvoicesRow
                  key={inv.id}
                  invoice={inv}
                  onBind={(invoice) => {
                    setBindId(invoice.id)
                    setBindSeq((n) => n + 1)
                    setBindOpen(true)
                  }}
                />
              ))}
            </TableBody>
          </Table>
        </div>
        <BindProjectDialog
          key={bindSeq}
          invoice={bindInvoice}
          open={bindOpen}
          onOpenChange={setBindOpen}
        />
      </CardContent>
    </Card>
  )
}
