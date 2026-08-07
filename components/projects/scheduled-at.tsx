"use client"

import { useLocale } from "next-intl"
import { useMemo } from "react"

export function ScheduledAt({
  date,
}: {
  date: Date | string | null | undefined
}) {
  const locale = useLocale()

  const label = useMemo(() => {
    if (!date) return null
    const d = typeof date === "string" ? new Date(date) : date
    if (Number.isNaN(d.getTime())) return null
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d)
  }, [date, locale])

  if (!label) return null
  return (
    <span className="text-xs whitespace-nowrap text-muted-foreground">
      {label}
    </span>
  )
}
