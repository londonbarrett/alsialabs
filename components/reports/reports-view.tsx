"use client"

import { useTranslations } from "next-intl"
import { BarChart3 } from "lucide-react"
import { PageHeader } from "@/components/common/page-header"
import { InactiveClientsCard } from "./inactive-clients-card"
import { ActiveRemindersCard } from "./active-reminders-card"
import type { ActiveReminder } from "@/lib/actions/reminders"

interface ReportsViewProps {
  activeReminders: ActiveReminder[]
}

export function ReportsView({ activeReminders }: ReportsViewProps) {
  const t = useTranslations('reports')
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} icon={BarChart3} />
      <ActiveRemindersCard reminders={activeReminders} />
      <InactiveClientsCard />
    </div>
  )
}
