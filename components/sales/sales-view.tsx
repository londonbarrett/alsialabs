"use client"

import { InvoicesCard } from "@/components/sales/invoices-card"
import { MonthlyRevenueChart } from "@/components/sales/monthly-revenue-chart"
import { TopClientsChart } from "@/components/sales/top-clients-chart"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type {
  MonthlyRevenueDTO,
  TopClientByRevenueDTO,
} from "@/actions/schemas/sales"
import { useTranslations } from "next-intl"

interface SalesViewProps {
  monthlyRevenue?: MonthlyRevenueDTO[]
  topClients?: TopClientByRevenueDTO[]
}

export function SalesView({
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

      <InvoicesCard />
    </>
  )
}
