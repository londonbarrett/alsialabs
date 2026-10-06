"use client"

import type { OptimisticStore } from "@/lib/optimistic-store"
import { useStore } from "zustand"
import type {
  TimelineEntry,
  TimelineEntryAction,
} from "./timeline-reducer"
import { useTimelineStore } from "./timeline-store"

type StoreType = OptimisticStore<TimelineEntry[], TimelineEntryAction>

export function useTimelineState() {
  const store = useTimelineStore()
  const entries = useStore(store, (s: StoreType) => s.optimistic)
  const pending = useStore(store, (s: StoreType) => s.pending)

  return { entries, pending }
}
