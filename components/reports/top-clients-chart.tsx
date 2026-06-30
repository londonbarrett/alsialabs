'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

export interface TopClient {
  clientId: string
  clientName: string
  totalRevenue: string
  invoiceCount: number
}

interface TopClientsChartProps {
  data: TopClient[]
}

const clientsConfig = {
  totalRevenue: {
    label: 'Revenue',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function TopClientsChart({ data }: TopClientsChartProps) {
  const chartData = data.map((c) => ({
    ...c,
    totalRevenue: Number(c.totalRevenue),
  }))

  if (chartData.length === 0) {
    return <p className="text-muted-foreground text-sm">No client revenue data yet.</p>
  }

  return (
    <ChartContainer config={clientsConfig} className="aspect-auto h-72 w-full">
      <BarChart
        data={chartData}
        layout="vertical"
        barCategoryGap={4}
        margin={{ left: 0 }}
      >
        <CartesianGrid horizontal={false} />
        <XAxis
          type="number"
          tickLine={false}
          tickMargin={8}
          axisLine={false}
          tickFormatter={(v: number) => formatCurrency(v)}
        />
        <YAxis
          type="category"
          dataKey="clientName"
          tickLine={false}
          tickMargin={8}
          axisLine={false}
          width={120}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => formatCurrency(Number(value))}
            />
          }
        />
        <Bar
          dataKey="totalRevenue"
          fill="var(--color-totalRevenue)"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ChartContainer>
  )
}
