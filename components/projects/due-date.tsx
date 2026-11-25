"use client"

import { AlertTriangle } from "lucide-react"
import { useLocale } from "next-intl"
import { useMemo } from "react"
import { formatDueDate } from "@/lib/util/tasks"

export function DueDate({
  date,
  timeZone,
  startTime,
  overdue,
  overdueLabel,
}: {
  date: Date | string | null | undefined
  /** The project zone this instant is displayed in. */
  timeZone: string
  /** `null` is the authoritative all-day flag — never infer it from an hour. */
  startTime: string | null
  overdue?: boolean
  overdueLabel?: string
}) {
  const locale = useLocale()

  const label = useMemo(() => {
    if (!date) return null
    const d = typeof date === "string" ? new Date(date) : date
    if (Number.isNaN(d.getTime())) return null
    return formatDueDate(d, locale, timeZone, startTime)
  }, [date, locale, timeZone, startTime])

  if (!label) {
    return <span className="text-xs text-muted-foreground">{"—"}</span>
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
            ? "text-xs font-medium whitespace-nowrap text-destructive"
            : "text-xs whitespace-nowrap text-muted-foreground"
        }
      >
        {label}
      </span>
    </span>
  )
}
