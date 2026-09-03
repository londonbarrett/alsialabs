"use client"

import { MyInvoicesList } from "@/components/my-invoices/my-invoices-list"
import { Card, CardContent } from "@/components/ui/card"
import type { MyInvoice } from "@/lib/actions/invoices"
import { useTranslations } from "next-intl"
import { use } from "react"

export function MyInvoicesView({
  invoicesPromise,
}: {
  invoicesPromise: Promise<
    | { success: true; data: MyInvoice[]; clientId: string }
    | { success: false; error: string }
    | { success: true; data: []; clientId: null }
  >
}) {
  const t = useTranslations()
  const invoices = use(invoicesPromise)
  const hasClient = invoices.success && invoices.clientId !== null
  const data = hasClient ? invoices.data : []

  if (!hasClient) {
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

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {t("myInvoices.noInvoices")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("myInvoices.noInvoicesDesc")}
          </p>
        </CardContent>
      </Card>
    )
  }

  return <MyInvoicesList invoices={data} />
}
