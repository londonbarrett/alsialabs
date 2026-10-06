"use client"

import type { Reminder } from "@/lib/actions/reminders"
import {
  ActivityStoreContext,
  createActivityStore,
} from "@/stores/activity/activity-store"
import { useServerReseed } from "@/hooks/use-server-reseed"
import { useState } from "react"

/**
 * Owns the whole activity page: the reminders list the card renders, plus an
 * activity list per expanded inactive-client row. Mounted by
 * `app/app/actividad/page.tsx`.
 */
export function ActivityProvider({
  reminders,
  children,
}: {
  reminders: Reminder[]
  children: React.ReactNode
}) {
  const [store] = useState(() => createActivityStore(reminders))
  useServerReseed(store, reminders)

  return (
    <ActivityStoreContext value={store}>
      {children}
    </ActivityStoreContext>
  )
}
