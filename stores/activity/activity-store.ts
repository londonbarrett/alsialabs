import type { ReminderRecordDTO } from "@/actions/schemas/reminder"
import { createOptimisticStore } from "@/lib/optimistic-store"
import { createContext, useContext } from "react"
import { activityReducer } from "./activity-reducer"

export function createActivityStore(reminders: ReminderRecordDTO[]) {
  /**
   * `reminders` is the server's slice. `activities` holds the per-client
   * lists loaded when a row is expanded, so a reseed keeps them — otherwise
   * every focus collapse would discard the user's open rows and their pages.
   */
  return createOptimisticStore({
    initialState: { reminders, activities: {} },
    reducer: activityReducer,
    serverSlice: "reminders",
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
