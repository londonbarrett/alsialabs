"use client"

import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

const statusStyles: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  partially_paid: "bg-sky-100 text-sky-700",
  overdue: "bg-rose-100 text-rose-700",
  cancelled: "bg-slate-100 text-slate-500 line-through",
}

export function StatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const t = useTranslations()

  return (
    <span
      className={cn(
        "inline-block rounded px-1.5 py-0.5 text-xs capitalize",
        statusStyles[status] ?? "bg-gray-100 text-gray-700",
        className,
      )}
    >
      {t(`sales.statuses.${status}`)}
    </span>
  )
}
