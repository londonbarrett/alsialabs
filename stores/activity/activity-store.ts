import type { Reminder } from "@/lib/actions/reminders"
import { createOptimisticStore } from "@/lib/optimistic-store"
import {
  activityReducer,
  EMPTY_ACTIVITIES,
  type ActivityAction,
  type ActivityState,
} from "./activity-reducer"
import { createContext, useContext } from "react"

export function createActivityStore(reminders: Reminder[]) {
  const store = createOptimisticStore<ActivityState, ActivityAction>(
    { reminders, activities: {} },
    activityReducer
  )
  return Object.assign(store, {
    getReminders: () => store((s) => s.optimistic.reminders),
    /** Returns a stable empty list for rows that have never been expanded. */
    getClientActivities: (clientId: string) =>
      store(
        (s) => s.optimistic.activities[clientId] ?? EMPTY_ACTIVITIES
      ),
  })
}

type ActivityStore = ReturnType<typeof createActivityStore>

export const ActivityStoreContext = createContext<ActivityStore | null>(
  null
)

export function useActivityStore(): ActivityStore {
  const store = useContext(ActivityStoreContext)
  if (!store) {
    throw new Error(
      "useActivityStore must be used within an ActivityProvider"
    )
  }
  return store
}
