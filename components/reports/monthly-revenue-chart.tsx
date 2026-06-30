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
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'

export interface MonthlyRevenue {
  month: string
  productRevenue: number
  serviceRevenue: number
}

interface MonthlyRevenueChartProps {
  data: MonthlyRevenue[]
}

const revenueConfig = {
  productRevenue: {
    label: 'Product',
    color: 'var(--chart-2)',
  },
  serviceRevenue: {
    label: 'Service',
    color: 'var(--chart-1)',
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

export function MonthlyRevenueChart({ data }: MonthlyRevenueChartProps) {
  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">No revenue data yet.</p>
  }

  return (
    <ChartContainer config={revenueConfig} className="aspect-auto h-72 w-full">
      <BarChart data={data} barCategoryGap={4}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          tickMargin={8}
          axisLine={false}
        />
        <YAxis
          tickLine={false}
          tickMargin={8}
          axisLine={false}
          width={100}
          tickFormatter={(v: number) => formatCurrency(v)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => {
                const key = String(name)
                const label = revenueConfig[key as keyof typeof revenueConfig]?.label ?? key
                return (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {formatCurrency(Number(value))}
                    </span>
                  </div>
                )
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="productRevenue"
          fill="var(--color-productRevenue)"
          radius={[4, 4, 0, 0]}
          stackId="a"
        />
        <Bar
          dataKey="serviceRevenue"
          fill="var(--color-serviceRevenue)"
          radius={[4, 4, 0, 0]}
          stackId="a"
        />
      </BarChart>
    </ChartContainer>
  )
}
