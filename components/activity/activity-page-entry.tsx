"use client"

import type { ClientTimelineEntry } from "@/actions/client-timeline"
import { ActivityEntryRow } from "@/components/activity/activity-entry-row"
import { ReminderEntryRow } from "@/components/activity/reminder-entry-row"

/**
 * A row in the activity page's expanded client list. Store-free: the entries
 * come from `useActivityActions().loadActivities`, and this route mounts
 * `ActivityProvider`, not `TimelineProvider`, so these rows must not reach for
 * the timeline store.
 */
export function ActivityPageEntry({
  entry,
}: {
  entry: ClientTimelineEntry
}) {
  return entry.kind === "activity" ? (
    <ActivityEntryRow activity={entry} />
  ) : (
    <ReminderEntryRow reminder={entry} />
  )
}
