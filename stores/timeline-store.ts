import { createOptimisticStore } from "@/lib/optimistic-store"
import {
  sortTimelineEntries,
  timelineReducer,
  type TimelineEntry,
} from "@/stores/timeline-reducer"
import { createContext, useContext } from "react"

export function createTimelineStore(entries: TimelineEntry[]) {
  const store = createOptimisticStore(
    sortTimelineEntries(entries),
    timelineReducer
  )
  return Object.assign(store, {
    getEntries: () => store((s) => s.optimistic),
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
