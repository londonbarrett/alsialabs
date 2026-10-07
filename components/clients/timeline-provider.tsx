"use client"

import { useServerReseed } from "@/hooks/use-server-reseed"
import type {
  ClientActivity,
  ClientReminder,
  Invoice,
  InvoicePayment,
} from "@/lib/drizzle/schema"
import {
  sortTimelineEntries,
  type TimelineEntry,
} from "@/stores/timeline/timeline-reducer"
import {
  createTimelineStore,
  TimelineStoreContext,
} from "@/stores/timeline/timeline-store"
import { useMemo, useState } from "react"

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
  // Memoised because `useServerReseed` compares this by identity: a fresh array
  // on every render would look like new server data and reseed each time.
  const entries = useMemo(
    () =>
      sortTimelineEntries(
        toEntries({ activities, reminders, invoices, payments })
      ),
    [activities, reminders, invoices, payments]
  )
  const [store] = useState(() => createTimelineStore(entries))
  useServerReseed(store, entries)
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
