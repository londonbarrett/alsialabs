"use client"

import { useCallback, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "cn"
import {
  currencyFractionDigits,
  formatMoney,
  getDecimalSeparator,
  normalizeMoneyInput,
} from "@/lib/util/money"

export interface MoneyInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange" | "value"
> {
  value: string
  onChange: (value: string) => void
  currency?: string
  locale?: string
}

function formatValue(value: string, currency: string, locale: string): string {
  // A trailing separator must stay visible while typing, otherwise the next
  // digit is appended to the integer part and cents can never be entered.
  if (value.endsWith(".") && currencyFractionDigits(currency, locale) > 0) {
    const whole = formatMoney(value.slice(0, -1), { currency, locale })
    return whole ? `${whole}${getDecimalSeparator(locale)}` : ""
  }
  return formatMoney(value, { currency, locale })
}

function countSignificantBefore(
  str: string,
  pos: number,
  decimalSeparator: string
): number {
  let count = 0
  for (let i = 0; i < pos && i < str.length; i++) {
    if (/\d/.test(str[i]) || str[i] === decimalSeparator) count++
  }
  return count
}

function findSignificantPosition(
  formatted: string,
  significantIndex: number,
  decimalSeparator: string
): number {
  let count = 0
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]) || formatted[i] === decimalSeparator) {
      count++
      if (count === significantIndex) return i + 1
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

  const displayValue = value ? formatValue(value, currency, locale) : ""

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

      const parsed = normalizeMoneyInput(raw, { currency, locale })
      const formatted = formatValue(parsed, currency, locale)
      const decimalSeparator = getDecimalSeparator(locale)
      // Group separators and symbols are not significant; counting digits and
      // the decimal separator in the raw value maps the caret to its position
      // in the reformatted value.
      const significantBeforeCursor = countSignificantBefore(
        raw,
        cursorPos,
        decimalSeparator
      )

      cursorRef.current = findSignificantPosition(
        formatted,
        significantBeforeCursor,
        decimalSeparator
      )
      onChange(parsed)
    },
    [onChange, currency, locale]
  )

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      className={cn("tabular-nums", className)}
      {...props}
    />
  )
}
