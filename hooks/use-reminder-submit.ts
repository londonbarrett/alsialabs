"use client"

import { useOptimisticAction } from "@/hooks/use-optimistic-action"
import { upsertReminder } from "@/lib/actions/reminders"
import type { Reminder } from "@/lib/actions/reminders"
import { buildTempReminder } from "@/lib/util/temp-entries"
import {
  type ReminderAction,
  useRemindersStore,
} from "@/stores/reminders-store"
import {
  useTimelineStore,
  type TimelineEntryAction,
} from "@/stores/timeline-store"

export interface ReminderSubmitData {
  clientId: string
  description: string
  remindAt: string
}

export interface ReminderSubmitResult {
  success: boolean
  error?: string
}

/**
 * Submit handler for the client detail page, where the timeline is the list on
 * screen. Requires TimelineProvider.
 */
export function useTimelineReminderSubmit() {
  const { run } = useOptimisticAction(useTimelineStore())

  return async function submitReminder(
    data: ReminderSubmitData,
    editingId?: string
  ): Promise<ReminderSubmitResult> {
    if (editingId) {
      const result = await run(
        {
          type: "patch",
          kind: "reminder",
          id: editingId,
          patch: {
            description: data.description,
            remindAt: data.remindAt,
          },
        },
        () => upsertReminder(data, editingId)
      )
      return { success: result.success, error: result.error }
    }

    const entry = buildTempReminder(data)
    const result = await run(
      { type: "add", entry },
      () => upsertReminder(data),
      {
        commitAction: (r): TimelineEntryAction => ({
          type: "patch",
          kind: "reminder",
          id: entry.id,
          patch: r.reminder ?? {},
        }),
      }
    )
    return { success: result.success, error: result.error }
  }
}

/**
 * Submit handler for the activity page, where RemindersCard is the list on
 * screen. Requires RemindersProvider.
 *
 * `clientName` is passed in because the dialog is not given it, and the card
 * renders it as the row's label — a temp row without it would flash blank.
 */
export function useRemindersSubmit(clientName: string) {
  const { run } = useOptimisticAction(useRemindersStore())

  return async function submitReminder(
    data: ReminderSubmitData,
    editingId?: string
  ): Promise<ReminderSubmitResult> {
    if (editingId) {
      const result = await run(
        {
          type: "patch",
          id: editingId,
          patch: {
            description: data.description,
            remindAt: data.remindAt,
          },
        },
        () => upsertReminder(data, editingId)
      )
      return { success: result.success, error: result.error }
    }

    const temp = buildTempReminder(data)
    const optimistic: Reminder = {
      id: temp.id,
      clientId: temp.clientId,
      clientName,
      description: temp.description,
      remindAt: temp.remindAt,
      completed: false,
    }

    const result = await run(
      { type: "add", reminder: optimistic },
      () => upsertReminder(data),
      {
        commitAction: (r): ReminderAction => ({
          type: "replaceTemp",
          tempId: optimistic.id,
          // The saved row carries no client join, so clientName is kept.
          // `.returning()` can come back empty, so keep the optimistic row.
          reminder: { ...optimistic, ...r.reminder },
        }),
      }
    )
    return { success: result.success, error: result.error }
  }
}
