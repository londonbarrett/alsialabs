"use client"

import { InvoicesCard } from "@/components/sales/invoices-card"
import {
  MonthlyRevenueChart,
  type MonthlyRevenue,
} from "@/components/sales/monthly-revenue-chart"
import type { InvoiceWithClientName } from "@/components/sales/sales-invoice-table"
import {
  TopClientsChart,
  type TopClient,
} from "@/components/sales/top-clients-chart"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useTranslations } from "next-intl"

interface SalesViewProps {
  invoices: InvoiceWithClientName[]
  permissions?: string[]
  monthlyRevenue?: MonthlyRevenue[]
  topClients?: TopClient[]
}

export function SalesView({
  invoices,
  permissions = [],
  monthlyRevenue = [],
  topClients = [],
}: SalesViewProps) {
  const t = useTranslations()

  return (
    <>
      {(monthlyRevenue.length > 0 || topClients.length > 0) && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("activity.monthlyRevenue")}</CardTitle>
            </CardHeader>
            <CardContent>
              <MonthlyRevenueChart data={monthlyRevenue} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("activity.topClients")}</CardTitle>
            </CardHeader>
            <CardContent>
              <TopClientsChart data={topClients} />
            </CardContent>
          </Card>
        </div>
      )}

      <InvoicesCard invoices={invoices} permissions={permissions} />
    </>
  )
}
