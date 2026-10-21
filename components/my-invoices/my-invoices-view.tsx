"use client"

import { MyInvoicesList } from "@/components/my-invoices/my-invoices-list"
import { Card, CardContent } from "@/components/ui/card"
import { useMyInvoicesState } from "@/stores/my-invoices/use-my-invoices-state"
import { useTranslations } from "next-intl"

export function MyInvoicesView() {
  const t = useTranslations()
  const { clientId, invoices } = useMyInvoicesState()

  if (!clientId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="font-medium">{t("myInvoices.noClient")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("myInvoices.noClientDesc")}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {t("invoice.noInvoicesYet")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("myInvoices.noInvoicesDesc")}
          </p>
        </CardContent>
      </Card>
    )
  }

  return <MyInvoicesList invoices={invoices} />
}
