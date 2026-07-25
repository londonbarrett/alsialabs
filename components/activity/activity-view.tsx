"use client"

import { PageHeader } from "@/components/common/page-header"
import type { ActiveReminder } from "@/lib/actions/reminders"
import { BellRing } from "lucide-react"
import { useTranslations } from "next-intl"
import { ActiveRemindersCard } from "./active-reminders-card"
import { InactiveClientsCard } from "./inactive-clients-card"

interface ActivityViewProps {
  activeReminders: ActiveReminder[]
}

export function ActivityView({ activeReminders }: ActivityViewProps) {
  const t = useTranslations("activity")
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        icon={BellRing}
      />
      <ActiveRemindersCard reminders={activeReminders} />
      <InactiveClientsCard />
    </div>
  )
}
