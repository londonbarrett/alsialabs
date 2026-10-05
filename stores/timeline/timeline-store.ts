import { createOptimisticStore } from "@/lib/optimistic-store"
import { createContext, useContext } from "react"
import {
  sortTimelineEntries,
  timelineReducer,
  type TimelineEntry,
} from "./timeline-reducer"

export function createTimelineStore(entries: TimelineEntry[]) {
  return createOptimisticStore(
    sortTimelineEntries(entries),
    timelineReducer
  )
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
