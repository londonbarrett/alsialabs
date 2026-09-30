"use client"

import {
  createTimelineStore,
  sortTimelineEntries,
  type TimelineEntry,
  TimelineStoreContext,
} from "@/stores/timeline-store"
import type {
  ClientActivity,
  ClientReminder,
  Invoice,
  InvoicePayment,
} from "@/lib/drizzle/schema"
import { useState } from "react"

export function TimelineProvider({
  activities,
  reminders,
  invoices,
  payments = [],
  children,
}: {
  activities: ClientActivity[]
  reminders: ClientReminder[]
  invoices: Invoice[]
  payments?: Array<InvoicePayment & { invoiceNumber: string }>
  children: React.ReactNode
}) {
  const [store] = useState(() =>
    createTimelineStore(
      sortTimelineEntries(
        toEntries({ activities, reminders, invoices, payments })
      )
    )
  )

  return (
    <TimelineStoreContext value={store}>
      {children}
    </TimelineStoreContext>
  )
}

function toEntries({
  activities,
  reminders,
  invoices,
  payments,
}: {
  activities: ClientActivity[]
  reminders: ClientReminder[]
  invoices: Invoice[]
  payments: Array<InvoicePayment & { invoiceNumber: string }>
}): TimelineEntry[] {
  return [
    ...activities.map((a) => ({ ...a, kind: "activity" as const })),
    ...reminders.map((r) => ({ ...r, kind: "reminder" as const })),
    ...invoices.map((i) => ({ ...i, kind: "invoice" as const })),
    ...payments.map((p) => ({ ...p, kind: "payment" as const })),
  ]
}
