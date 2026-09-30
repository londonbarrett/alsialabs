"use client"

import type { Reminder } from "@/lib/actions/reminders"
import {
  createRemindersStore,
  RemindersStoreContext,
} from "@/stores/reminders-store"
import { useState } from "react"

export function RemindersProvider({
  reminders,
  children,
}: {
  reminders: Reminder[]
  children: React.ReactNode
}) {
  const [store] = useState(() => createRemindersStore(reminders))

  return (
    <RemindersStoreContext value={store}>
      {children}
    </RemindersStoreContext>
  )
}
