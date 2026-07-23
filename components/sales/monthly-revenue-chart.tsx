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
import { useTranslations } from 'next-intl'

export interface MonthlyRevenue {
  month: string
  productRevenue: number
  serviceRevenue: number
  productQuantity: number
  serviceQuantity: number
}

interface MonthlyRevenueChartProps {
  data: MonthlyRevenue[]
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export function MonthlyRevenueChart({ data }: MonthlyRevenueChartProps) {
  const t = useTranslations('activity')

  const revenueConfig = {
    productRevenue: {
      label: t('product'),
      color: 'var(--chart-2)',
    },
    serviceRevenue: {
      label: t('service'),
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig

  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">{t('noRevenueData')}</p>
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
              formatter={(value, name, item) => {
                const key = String(name)
                const label = revenueConfig[key as keyof typeof revenueConfig]?.label ?? key
                const quantityKey = key === 'productRevenue' ? 'productQuantity' : 'serviceQuantity'
                const quantity = item?.payload?.[quantityKey] ?? 0
                return (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {formatCurrency(Number(value))} · {quantity} {t('quantity')}
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
