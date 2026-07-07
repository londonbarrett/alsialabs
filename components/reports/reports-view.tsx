"use client"

import { useTranslations } from "next-intl"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  MonthlyRevenueChart,
  type MonthlyRevenue,
} from "./monthly-revenue-chart"
import { TopClientsChart, type TopClient } from "./top-clients-chart"
import { InactiveClientsCard } from "./inactive-clients-card"
import { ActiveRemindersCard } from "./active-reminders-card"
import type { ActiveReminder } from "@/lib/actions/reminders"

interface ReportsViewProps {
  monthlyRevenue: MonthlyRevenue[]
  topClients: TopClient[]
  activeReminders: ActiveReminder[]
}

export function ReportsView({
  monthlyRevenue,
  topClients,
  activeReminders,
}: ReportsViewProps) {
  const t = useTranslations('reports')
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('monthlyRevenue')}</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyRevenueChart data={monthlyRevenue} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('topClients')}</CardTitle>
          </CardHeader>
          <CardContent>
            <TopClientsChart data={topClients} />
          </CardContent>
        </Card>
      </div>
      <ActiveRemindersCard reminders={activeReminders} />
      <InactiveClientsCard />
    </div>
  )
}
