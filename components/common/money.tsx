"use client"

import { type ReactNode } from "react"

import { formatMoney } from "@/lib/util/money"

interface MoneyProps {
  value: number | string | null | undefined
  currency?: string
  locale?: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  fallback?: ReactNode
}

export function Money({
  value,
  currency = "USD",
  locale = "en-US",
  minimumFractionDigits,
  maximumFractionDigits,
  fallback = "—",
}: MoneyProps) {
  if (value === null || value === undefined || value === "") {
    return <>{fallback}</>
  }

  const numericValue =
    typeof value === "string" ? parseFloat(value) : value

  if (Number.isNaN(numericValue)) {
    return <>{fallback}</>
  }

  if (
    minimumFractionDigits === undefined &&
    maximumFractionDigits === undefined
  ) {
    return <>{formatMoney(value, { currency, locale })}</>
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: minimumFractionDigits ?? 0,
    maximumFractionDigits: maximumFractionDigits ?? 2,
  })

  return <>{formatter.format(numericValue)}</>
}
