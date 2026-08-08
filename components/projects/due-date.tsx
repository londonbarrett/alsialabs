"use client"

import { AlertTriangle } from "lucide-react"
import { useLocale } from "next-intl"
import { useMemo } from "react"

export function DueDate({
  date,
  overdue,
  overdueLabel,
}: {
  date: Date | string | null | undefined
  overdue?: boolean
  overdueLabel?: string
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

  if (!label) {
    return (
      <span className="text-xs text-muted-foreground">{"—"}</span>
    )
  }

  return (
    <span className="flex items-center gap-2">
      {overdue && (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
          <AlertTriangle className="h-3 w-3" />
          {overdueLabel}
        </span>
      )}
      <span
        className={
          overdue
            ? "whitespace-nowrap text-xs font-medium text-destructive"
            : "whitespace-nowrap text-xs text-muted-foreground"
        }
      >
        {label}
      </span>
    </span>
  )
}
