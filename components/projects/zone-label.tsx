"use client"

import { useTranslations } from "next-intl"

/** Names the zone a date cell was formatted in. */
export function ZoneLabel({ timeZone }: { timeZone: string }) {
  const t = useTranslations()

  return (
    <span className="text-xs text-muted-foreground">
      {`${t("common.timeZone")}: ${timeZone}`}
    </span>
  )
}
