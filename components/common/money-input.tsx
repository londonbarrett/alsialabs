"use client"

import { useCallback, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface MoneyInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange" | "value"
> {
  value: string
  onChange: (value: string) => void
  currency?: string
  locale?: string
}

const defaultFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatInteger(
  value: string,
  currency = "USD",
  locale = "en-US"
): string {
  const numericString = parseInteger(value)
  const num = parseInt(numericString, 10)
  if (Number.isNaN(num)) return ""

  if (currency === "USD" && locale === "en-US") {
    return defaultFormatter.format(num)
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

function parseInteger(value: string): string {
  const intPart = value.split(".")[0]
  return intPart.replace(/[^0-9]/g, "")
}

function countDigitsBefore(str: string, pos: number): number {
  let count = 0
  for (let i = 0; i < pos && i < str.length; i++) {
    if (/\d/.test(str[i])) count++
  }
  return count
}

function findDigitPosition(
  formatted: string,
  digitIndex: number
): number {
  let count = 0
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      count++
      if (count === digitIndex) return i + 1
    }
  }
  return formatted.length
}

export function MoneyInput({
  value,
  onChange,
  currency = "USD",
  locale = "en-US",
  className,
  ...props
}: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const cursorRef = useRef<number | null>(null)

  const displayValue = value
    ? formatInteger(value, currency, locale)
    : ""

  useEffect(() => {
    if (cursorRef.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(
        cursorRef.current,
        cursorRef.current
      )
      cursorRef.current = null
    }
  }, [displayValue])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target
      const raw = input.value
      const cursorPos = input.selectionStart ?? raw.length

      const parsed = parseInteger(raw)
      const formatted = parsed
        ? formatInteger(parsed, currency, locale)
        : ""
      const digitsBeforeCursor = countDigitsBefore(raw, cursorPos)

      cursorRef.current = findDigitPosition(
        formatted,
        digitsBeforeCursor
      )
      onChange(parsed)
    },
    [onChange, currency, locale]
  )

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      className={cn("tabular-nums", className)}
      {...props}
    />
  )
}
