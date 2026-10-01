"use client"

import { useOptimisticAction } from "@/stores/use-optimistic-action"
import {
  completeReminder as completeReminderAction,
  deleteReminder as deleteReminderAction,
  upsertReminder,
} from "@/lib/actions/reminders"
import type { Reminder } from "@/lib/actions/reminders"
import { upsertActivity } from "@/lib/actions/activities"
import type { ActivityFormData } from "@/lib/actions/activities"
import { getClientTimelinePage } from "@/lib/actions/client-timeline"
import type {
  ActivitySubmitResult,
  ReminderSubmitData,
  ReminderSubmitResult,
} from "@/lib/types"
import {
  buildTempActivity,
  buildTempReminder,
} from "@/lib/util/temp-entries"
import {
  type ActivityAction,
  useActivityStore,
} from "@/stores/activity-store"
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
  ): Promise<ActivitySubmitResult> {
    const { entries, hasMore } = await getClientTimelinePage(clientId, {
      offset,
      limit: ACTIVITY_PAGE_SIZE,
    })
    const existing =
      offset === 0 ? [] : store.getClientActivities(clientId).entries
    const pendingId = store.getState().pend({
      type: "setClientActivity",
      clientId,
      entries: [...existing, ...entries],
      hasMore,
    })
    store.getState().commit(pendingId)
    return { success: true }
  }

  /**
   * `activityClientId` is set when the caller is an expanded row rather than the
   * reminders card, so the reminder lands in that row's activity list as well.
   */
  async function submitReminder(
    data: ReminderSubmitData,
    options: { editingId?: string; activityClientId?: string } = {}
  ): Promise<ReminderSubmitResult> {
    const { editingId, activityClientId } = options

    if (editingId) {
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
      return { success: result.success, error: result.error }
    }

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
          type: "replaceReminder",
          tempId: optimistic.id,
          activityClientId,
          // The saved row carries no client join, so clientName is kept.
          // `.returning()` can come back empty, so keep the optimistic row.
          reminder: { ...optimistic, ...r.reminder },
        }),
      }
    )
    return { success: result.success, error: result.error }
  }

  async function completeReminder(reminderId: string) {
    const result = await run(
      { type: "completeReminder", id: reminderId },
      () => completeReminderAction(reminderId)
    )
    if (result.success) {
      toast.success(t("reminders.reminderCompleted"))
    } else {
      toast.error(result.error || t("reminders.failedToComplete"))
    }
  }

  async function deleteReminder(reminderId: string) {
    const result = await run(
      { type: "deleteReminder", id: reminderId },
      () => deleteReminderAction(reminderId)
    )
    if (result.success) {
      toast.success(t("reminders.reminderDeleted"))
    } else {
      toast.error(result.error || t("reminders.failedToDelete"))
    }
  }

  /**
   * Logs an activity from an expanded row's dialog. It lands in that row's
   * only — the reminders card lists reminders, not activities.
   */
  async function logActivity(
    data: ActivityFormData,
    editingId?: string
  ): Promise<ActivitySubmitResult> {
    const clientId = data.clientId

    if (editingId) {
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
      if (result.success) {
        toast.success(t("activities.activityUpdated"))
      } else {
        toast.error(result.error || t("common.somethingWentWrong"))
      }
      return result.success
        ? { success: true }
        : { success: false, error: result.error }
    }

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
    if (result.success) {
      toast.success(t("activities.activityLogged"))
    } else {
      toast.error(result.error || t("common.somethingWentWrong"))
    }
    return result.success
      ? { success: true }
      : { success: false, error: result.error }
  }

  return {
    loadActivities,
    submitReminder,
    completeReminder,
    deleteReminder,
    logActivity,
  }
}
