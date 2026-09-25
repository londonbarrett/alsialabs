"use client"

import { ActivityItem } from "@/components/clients/activity-item"
import { AddReminderButton } from "@/components/clients/add-reminder-button"
import { CreateInvoiceButton } from "@/components/clients/create-invoice-button"
import { InvoiceItem } from "@/components/clients/invoice-item"
import { LogActivityButton } from "@/components/clients/log-activity-button"
import { PaymentItem } from "@/components/clients/payment-item"
import { ReminderItem } from "@/components/clients/reminder-item"
import { Separator } from "@/components/ui/separator"
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus"
import type {
  ClientActivity,
  ClientReminder,
  Invoice,
  InvoicePayment,
} from "@/lib/drizzle/schema"
import {
  applyTimelineAction,
  hydrateTimelineEntries,
  sortTimelineEntries,
  type TimelineEntry,
} from "@/stores/timeline-store"
import { useTimelineStore } from "@/stores/timeline-store"
import { useOptimisticDerived } from "@/hooks/use-optimistic-store"
import { useTranslations } from "next-intl"
import { useEffect } from "react"

interface ActivityTimelineProps {
  clientId: string
  activities: ClientActivity[]
  reminders: ClientReminder[]
  invoices: Invoice[]
  payments?: Array<InvoicePayment & { invoiceNumber: string }>
}

export function ActivityTimeline({
  clientId,
  activities,
  reminders,
  invoices,
  payments = [],
}: ActivityTimelineProps) {
  const t = useTranslations()
  useRefreshOnFocus()

  const entries: TimelineEntry[] = [
    ...activities.map((a) => ({ ...a, kind: "activity" as const })),
    ...reminders.map((r) => ({ ...r, kind: "reminder" as const })),
    ...invoices.map((i) => ({ ...i, kind: "invoice" as const })),
    ...payments.map((p) => ({ ...p, kind: "payment" as const })),
  ]

  // Pending-actions store — shared globally per client.
  const derivedByClient = useOptimisticDerived(
    useTimelineStore,
    applyTimelineAction
  )
  const baseEntries = derivedByClient[clientId] ?? []

  useEffect(() => {
    const sorted = sortTimelineEntries(entries)
    hydrateTimelineEntries(clientId, sorted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, activities, reminders, invoices, payments])

  const entriesToRender =
    baseEntries.length > 0 || entries.length === 0
      ? baseEntries
      : sortTimelineEntries(entries)

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

      {entriesToRender.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          <p>{t("activities.noActivities")}</p>
        </div>
      ) : (
        <div className="rounded-md border p-4">
          {entriesToRender.map((entry, idx) => (
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
                  clientId={clientId}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
