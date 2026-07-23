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
import { useTranslations } from 'next-intl'

export interface TopClient {
  clientId: string
  clientName: string
  totalRevenue: string
  invoiceCount: number
}

interface TopClientsChartProps {
  data: TopClient[]
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export function TopClientsChart({ data }: TopClientsChartProps) {
  const t = useTranslations('activity')

  const clientsConfig = {
    totalRevenue: {
      label: t('revenue'),
      color: 'var(--chart-2)',
    },
  } satisfies ChartConfig

  const chartData = data.map((c) => ({
    ...c,
    totalRevenue: Number(c.totalRevenue),
  }))

  if (chartData.length === 0) {
    return <p className="text-muted-foreground text-sm">{t('noClientRevenue')}</p>
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
