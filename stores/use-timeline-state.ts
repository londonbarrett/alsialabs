"use client"

import { useTimelineStore } from "@/stores/timeline-store"
import type { TimelineEntry, TimelineEntryAction } from "@/stores/timeline-reducer"
import type { OptimisticStore } from "@/lib/optimistic-store"

type StoreType = OptimisticStore<TimelineEntry[], TimelineEntryAction>

export function useTimelineState() {
  const store = useTimelineStore()
  const entries = store((s: StoreType) => s.optimistic)
  const pending = store((s: StoreType) => s.pending)

  return { entries, pending }
}
