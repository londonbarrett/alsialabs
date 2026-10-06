"use client"
import type { TimelineEntry } from "@/stores/timeline/timeline-reducer"

import { ActivityItem } from "@/components/clients/activity-item"
import { AddReminderButton } from "@/components/clients/add-reminder-button"
import { CreateInvoiceButton } from "@/components/clients/create-invoice-button"
import { InvoiceItem } from "@/components/clients/invoice-item"
import { LogActivityButton } from "@/components/clients/log-activity-button"
import { PaymentItem } from "@/components/clients/payment-item"
import { ReminderItem } from "@/components/clients/reminder-item"
import { Separator } from "@/components/ui/separator"
import { useTimelineState } from "@/stores/timeline/use-timeline-state"
import { useTranslations } from "next-intl"

export function ActivityTimeline({ clientId }: { clientId: string }) {
  const t = useTranslations()

  const { entries } = useTimelineState()

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("activities.title")}
        </h2>
        <div className="flex gap-2">
          <LogActivityButton clientId={clientId} />
          <AddReminderButton clientId={clientId} />
          <CreateInvoiceButton clientId={clientId} />
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          <p>{t("activities.noActivities")}</p>
        </div>
      ) : (
        <div className="rounded-md border p-4">
          {entries.map((entry: TimelineEntry, idx: number) => (
            <div key={`${entry.kind}-${entry.id}`}>
              {idx > 0 && <Separator />}
              {entry.kind === "activity" ? (
                <ActivityItem activity={entry} clientId={clientId} />
              ) : entry.kind === "reminder" ? (
                <ReminderItem reminder={entry} clientId={clientId} />
              ) : entry.kind === "invoice" ? (
                <InvoiceItem invoice={entry} clientId={clientId} />
              ) : (
                <PaymentItem
                  payment={entry}
                  invoiceNumber={entry.invoiceNumber}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
