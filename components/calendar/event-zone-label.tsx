"use client"

import { useTranslations } from "next-intl"

/** Compact IANA zone tag rendered on a calendar chip. */
export function EventZoneLabel({ timeZone }: { timeZone: string }) {
  const t = useTranslations()

  return (
    <span
      className="shrink-0 truncate text-[10px] leading-tight text-muted-foreground"
      title={`${t("common.timeZone")}: ${timeZone}`}
    >
      {timeZone}
    </span>
  )
}
