"use client"

import type { ActivityFormData } from "@/lib/actions/activities"
import {
  deleteActivity as deleteActivityAction,
  upsertActivity,
} from "@/lib/actions/activities"
import {
  completeReminder as completeReminderAction,
  deleteReminder as deleteReminderAction,
  upsertReminder,
} from "@/lib/actions/reminders"
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
  useTimelineStore,
  type TimelineEntryAction,
} from "@/stores/timeline-store"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

/**
 * Mutations for the client detail page, where the timeline is the list on
 * screen. Requires TimelineProvider.
 *
 * The activity page has its own handler, `useActivityActions`
 * `stores/use-activity-actions.ts`, because exactly one store is live per route.
 */
export function useTimelineActions() {
  const t = useTranslations()
  const { run } = useOptimisticAction(useTimelineStore())

  async function submitReminder(
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

  async function submitActivity(
    data: ActivityFormData,
    editingId?: string
  ): Promise<ActivitySubmitResult> {
    if (editingId) {
      const result = await run(
        {
          type: "patch",
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

    const entry = buildTempActivity(data)
    const result = await run(
      { type: "add", entry },
      // TODO: migrate to safe actions
      () => upsertActivity(data),
      {
        commitAction: (r): TimelineEntryAction => ({
          type: "patch",
          kind: "activity",
          id: entry.id,
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

  async function completeReminder(reminderId: string) {
    const result = await run(
      {
        type: "patch",
        kind: "reminder",
        id: reminderId,
        patch: { completed: true, completedAt: new Date() },
      },
      () => completeReminderAction(reminderId)
    )
    if (result.success) {
      toast.success(t("reminders.reminderCompleted"))
    } else {
      toast.error(result.error || t("reminders.failedToComplete"))
    }
  }

  async function deleteReminder(reminderId: string) {
    const result = await run({ type: "delete", id: reminderId }, () =>
      deleteReminderAction(reminderId)
    )
    if (result.success) {
      toast.success(t("reminders.reminderDeleted"))
    } else {
      toast.error(result.error || t("reminders.failedToDelete"))
    }
  }

  async function deleteActivity(activityId: string) {
    const result = await run({ type: "delete", id: activityId }, () =>
      deleteActivityAction(activityId)
    )
    if (result.success) {
      toast.success(t("activities.activityDeleted"))
    } else {
      toast.error(result.error || t("activities.failedToDelete"))
    }
  }

  return {
    submitReminder,
    submitActivity,
    completeReminder,
    deleteReminder,
    deleteActivity,
  }
}
