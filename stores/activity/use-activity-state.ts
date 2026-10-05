"use client"

import { useActivityStore } from "./activity-store"
import {
  EMPTY_ACTIVITIES,
  type ActivityAction,
  type ActivityState,
} from "./activity-reducer"
import type { OptimisticStore } from "@/lib/optimistic-store"

type StoreType = OptimisticStore<ActivityState, ActivityAction>

export function useActivityState() {
  const store = useActivityStore()
  const reminders = store((s: StoreType) => s.optimistic.reminders)
  const activities = store((s: StoreType) => s.optimistic.activities)
  const pending = store((s: StoreType) => s.pending)

  /** Stable empty list for rows that have never been expanded. */
  function getClientActivities(clientId: string) {
    return activities[clientId] ?? EMPTY_ACTIVITIES
  }

  return { reminders, activities, pending, getClientActivities }
}
