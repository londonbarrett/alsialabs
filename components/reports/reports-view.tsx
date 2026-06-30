'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { MonthlyRevenueChart, type MonthlyRevenue } from './monthly-revenue-chart'
import { TopClientsChart, type TopClient } from './top-clients-chart'
import { InactiveClientsTable } from './inactive-clients-table'

interface ReportsViewProps {
  monthlyRevenue: MonthlyRevenue[]
  topClients: TopClient[]
}

export function ReportsView({ monthlyRevenue, topClients }: ReportsViewProps) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyRevenueChart data={monthlyRevenue} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Clients by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <TopClientsChart data={topClients} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Inactive Clients</CardTitle>
        </CardHeader>
        <CardContent>
          <InactiveClientsTable />
        </CardContent>
      </Card>
    </div>
  )
}
