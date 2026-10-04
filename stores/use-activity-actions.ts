"use client"

import type { ActivityFormData } from "@/lib/actions/activities"
import { upsertActivity } from "@/lib/actions/activities"
import { getClientTimelinePage } from "@/lib/actions/client-timeline"
import type { Reminder } from "@/lib/actions/reminders"
import {
  completeReminder as completeReminderAction,
  deleteReminder as deleteReminderAction,
  upsertReminder,
} from "@/lib/actions/reminders"
import type { ReminderSubmitData } from "@/lib/types"
import {
  buildTempActivity,
  buildTempReminder,
} from "@/lib/util/temp-entries"
import { useSettle } from "@/hooks/use-settle"
import { type ActivityAction } from "@/stores/activity-reducer"
import { useActivityStore } from "@/stores/activity-store"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

export const ACTIVITY_PAGE_SIZE = 5

/**
 * Every write to the activity page's store: the reminders list the card renders,
 * and the per-client activity list each expanded row shows. Requires
 * ActivityProvider.
 *
 * These go through the store rather than `router.refresh()`: the store is seeded
 * once when the provider mounts, so a refresh would not bring the change into
 * the list already on screen.
 */
export function useActivityActions() {
  const t = useTranslations()
  const settle = useSettle()
  const store = useActivityStore()
  const { run } = useOptimisticAction(store)

  /**
   * Reads one page of a client's timeline into the store. Pends and commits
   * directly instead of going through `run`, because a fetch is not a mutation
   * and must not drive the loading bar or `router.refresh()`. Both calls happen
   * once the data is in hand, so the list never flickers empty mid-load.
   */
  async function loadActivities(
    clientId: string,
    offset: number
  ): Promise<void> {
    try {
      const { entries, hasMore } = await getClientTimelinePage(
        clientId,
        {
          offset,
          limit: ACTIVITY_PAGE_SIZE,
        }
      )
      const existing =
        offset === 0 ? [] : store.getClientActivities(clientId).entries
      const pendingId = store.getState().pend({
        type: "setClientActivity",
        clientId,
        entries: [...existing, ...entries],
        hasMore,
      })
      store.getState().commit(pendingId)
    } catch {
      toast.error(t("common.somethingWentWrong"))
    }
  }

  /**
   * `activityClientId` is set when the caller is an expanded row rather than the
   * reminders card, so the reminder lands in that row's activity list as well.
   */
  async function createReminder(
    data: ReminderSubmitData,
    activityClientId?: string
  ): Promise<void> {
    const temp = buildTempReminder(data)
    const optimistic: Reminder = {
      id: temp.id,
      clientId: temp.clientId,
      clientName: data.clientName ?? "",
      description: temp.description,
      remindAt: temp.remindAt,
      completed: false,
    }

    const result = await run(
      { type: "addReminder", reminder: optimistic, activityClientId },
      () => upsertReminder(data),
      {
        commitAction: (r): ActivityAction => ({
          type: "replaceTempReminder",
          tempId: optimistic.id,
          activityClientId,
          // The saved row carries no client join, so clientName is kept.
          // `.returning()` can come back empty, so keep the optimistic row.
          reminder: { ...optimistic, ...r.reminder },
        }),
      }
    )
    settle(result, t("reminders.reminderCreated"))
  }

  async function updateReminder(
    data: ReminderSubmitData,
    editingId: string
  ): Promise<void> {
    const result = await run(
      {
        type: "patchReminder",
        id: editingId,
        patch: {
          description: data.description,
          remindAt: data.remindAt,
        },
      },
      () => upsertReminder(data, editingId)
    )
    settle(result, t("reminders.reminderUpdated"))
  }

  async function completeReminder(reminderId: string) {
    const result = await run(
      { type: "completeReminder", id: reminderId },
      () => completeReminderAction(reminderId)
    )
    settle(
      result,
      t("reminders.reminderCompleted"),
      t("reminders.failedToComplete")
    )
  }

  async function deleteReminder(reminderId: string) {
    const result = await run(
      { type: "deleteReminder", id: reminderId },
      () => deleteReminderAction(reminderId)
    )
    settle(
      result,
      t("reminders.reminderDeleted"),
      t("reminders.failedToDelete")
    )
  }

  /**
   * Logs an activity from an expanded row's dialog. It lands in that row's
   * list only — the reminders card lists reminders, not activities.
   */
  async function createActivity(
    data: ActivityFormData
  ): Promise<void> {
    const clientId = data.clientId
    const temp = buildTempActivity(data)
    const result = await run(
      { type: "addClientActivity", clientId, entry: temp },
      () => upsertActivity(data),
      {
        commitAction: (r): ActivityAction => ({
          type: "patchClientActivity",
          clientId,
          kind: "activity",
          id: temp.id,
          patch: r.success ? r.activity : {},
        }),
      }
    )
    settle(result, t("activities.activityLogged"))
  }

  async function updateActivity(
    data: ActivityFormData,
    editingId: string
  ): Promise<void> {
    const clientId = data.clientId
    const result = await run(
      {
        type: "patchClientActivity",
        clientId,
        kind: "activity",
        id: editingId,
        patch: {
          subject: data.subject,
          description: data.description || null,
          type: data.type,
          activityDate: data.activityDate,
        },
      },
      () => upsertActivity(data, editingId)
    )
    settle(result, t("activities.activityUpdated"))
  }

  return {
    loadActivities,
    createReminder,
    updateReminder,
    createActivity,
    updateActivity,
    completeReminder,
    deleteReminder,
  }
}
