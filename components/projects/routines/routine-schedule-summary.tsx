"use client"

import { useTranslations } from "next-intl"
import { memo } from "react"

export interface RoutineScheduleInfo {
  recurrence?: string | null
  interval?: number | null
  daysOfWeek?: string[] | null
  time?: string | null
  startDate?: string | null
  endDate?: string | null
}

export const RoutineScheduleSummary = memo(function RoutineScheduleSummary({
  routine,
}: {
  routine: RoutineScheduleInfo
}) {
  const t = useTranslations()

  const cadence =
    routine.recurrence === "daily"
      ? (routine.interval ?? 1) === 1
        ? t("projects.routines.everyDay")
        : t("projects.routines.everyNDays", { n: routine.interval ?? 1 })
      : (routine.interval ?? 1) === 1
        ? t("projects.routines.everyWeek")
        : t("projects.routines.everyNWeeks", { n: routine.interval ?? 1 })

  const days =
    routine.recurrence === "weekly"
      ? (routine.daysOfWeek ?? [])
          .map((d) => t(`projects.routines.dayShort.${d}`))
          .join(", ")
      : ""

  const range = [routine.startDate, routine.endDate]
    .filter(Boolean)
    .join(" – ")

  return [cadence, days, routine.time, range]
    .filter(Boolean)
    .join(" · ")
})
