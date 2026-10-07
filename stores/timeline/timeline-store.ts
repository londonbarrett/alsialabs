import { createOptimisticStore } from "@/lib/optimistic-store"
import { createContext, useContext } from "react"
import {
  timelineReducer,
  type TimelineEntry,
} from "./timeline-reducer"

export function createTimelineStore(entries: TimelineEntry[]) {
  /**
   * The whole state is the server's slice — nothing here is loaded
   * client-side — so a reseed replaces it. Re-sorted, because the seed sorts
   * and a freshly built list has to land in the same order.
   */
  return createOptimisticStore({
    initialState: entries,
    reducer: timelineReducer,
  })
}

type TimelineStore = ReturnType<typeof createTimelineStore>

export const TimelineStoreContext = createContext<TimelineStore | null>(
  null
)

export function useTimelineStore(): TimelineStore {
  const store = useContext(TimelineStoreContext)
  if (!store) {
    throw new Error(
      "useTimelineStore must be used within a TimelineProvider"
    )
  }
  return store
}
