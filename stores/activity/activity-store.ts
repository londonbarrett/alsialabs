import type { Reminder } from "@/lib/actions/reminders"
import { createOptimisticStore } from "@/lib/optimistic-store"
import {
  activityReducer,
  type ActivityAction,
  type ActivityState,
} from "./activity-reducer"
import { createContext, useContext } from "react"

export function createActivityStore(reminders: Reminder[]) {
  /**
   * `reminders` is the server's slice. `activities` holds the per-client
   * lists loaded when a row is expanded, so a reseed keeps them — otherwise
   * every focus collapse would discard the user's open rows and their pages.
   */
  return createOptimisticStore<ActivityState, ActivityAction, Reminder[]>(
    { reminders, activities: {} },
    activityReducer,
    (committed, next) => ({ ...committed, reminders: next })
  )
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
