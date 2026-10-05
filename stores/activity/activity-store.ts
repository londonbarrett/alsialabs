import type { Reminder } from "@/lib/actions/reminders"
import { createOptimisticStore } from "@/lib/optimistic-store"
import {
  activityReducer,
  type ActivityAction,
  type ActivityState,
} from "./activity-reducer"
import { createContext, useContext } from "react"

export function createActivityStore(reminders: Reminder[]) {
  return createOptimisticStore<ActivityState, ActivityAction>(
    { reminders, activities: {} },
    activityReducer
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
