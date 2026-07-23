"use client"

import { useTranslations } from "next-intl"
import { BarChart3 } from "lucide-react"
import { PageHeader } from "@/components/common/page-header"
import { InactiveClientsCard } from "./inactive-clients-card"
import { ActiveRemindersCard } from "./active-reminders-card"
import type { ActiveReminder } from "@/lib/actions/reminders"

interface ActivityViewProps {
  activeReminders: ActiveReminder[]
}

export function ActivityView({ activeReminders }: ActivityViewProps) {
  const t = useTranslations('activity')
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} icon={BarChart3} />
      <ActiveRemindersCard reminders={activeReminders} />
      <InactiveClientsCard />
    </div>
  )
}
