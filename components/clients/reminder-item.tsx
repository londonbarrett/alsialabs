"use client"

import { ActionMenu } from "@/components/common/action-menu"
import { ReminderDialog } from "@/components/clients/reminder-dialog"
import { Button } from "@/components/ui/button"
import { useOptimisticAction } from "@/hooks/use-optimistic-store"
import {
  completeReminder,
  deleteReminder,
} from "@/lib/actions/reminders"
import type { ClientReminder } from "@/lib/drizzle/schema"
import { useHasPermission } from "@/stores/permissions-store"
import { useTimelineStore } from "@/stores/timeline-store"
import { Bell, BellOff, CheckCircle2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

interface ReminderItemProps {
  reminder: ClientReminder
  clientId: string
  readOnly?: boolean
}

export function ReminderItem({
  reminder,
  clientId,
  readOnly = false,
}: ReminderItemProps) {
  const t = useTranslations("reminders")
  const canEdit = useHasPermission("client-activity:edit")
  const canDelete = useHasPermission("client-activity:delete")
  const canComplete = useHasPermission("client-activity:edit")
  const { run } = useOptimisticAction(useTimelineStore)
  const [dialog, setDialog] = useState<{
    open: boolean
    editing?: ClientReminder
  }>({ open: false })

  const [y, m, d] = reminder.remindAt.split("-")
  const date = `${m}/${d}/${y}`
  const isOverdue =
    !reminder.completed &&
    new Date(reminder.remindAt) < new Date(new Date().toDateString())

  async function handleComplete() {
    const result = await run(
      {
        type: "patch",
        kind: "reminder",
        id: reminder.id,
        patch: { completed: true, completedAt: new Date() },
      },
      () => completeReminder(reminder.id),
      { key: clientId }
    )
    if (!result.success) {
      toast.error(result.error || t("failedToComplete"))
    } else {
      toast.success(t("reminderCompleted"))
    }
  }

  async function handleDelete() {
    const result = await run(
      { type: "remove", kind: "reminder", id: reminder.id },
      () => deleteReminder(reminder.id),
      { key: clientId }
    )
    if (!result.success) {
      toast.error(result.error || t("failedToDelete"))
    } else {
      toast.success(t("reminderDeleted"))
    }
  }

  return (
    <>
      <div
        className={`group flex items-start gap-3 py-3 ${
          reminder.completed ? "opacity-60" : ""
        }`}
      >
        <div
          className={`mt-0.5 ${
            reminder.completed
              ? "text-muted-foreground"
              : isOverdue
                ? "text-destructive"
                : "text-amber-500"
          }`}
        >
          {reminder.completed ? (
            <BellOff className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t(
                reminder.completed
                  ? "completed"
                  : isOverdue
                    ? "overdue"
                    : "pending"
              )}{" "}
              — {date}
            </span>
          </div>
          <p
            className={`mt-0.5 text-sm ${
              reminder.completed
                ? "text-muted-foreground line-through"
                : ""
            }`}
          >
            {reminder.description}
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {canComplete && !reminder.completed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleComplete}
                aria-label={t("markAsCompleted")}
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </Button>
            )}
            <ActionMenu
              entityName={reminder.description}
              onEdit={() =>
                setDialog({ open: true, editing: reminder })
              }
              onDelete={handleDelete}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          </div>
        )}
      </div>
      {!readOnly && (
        <ReminderDialog
          clientId={clientId}
          open={dialog.open}
          onOpenChange={(o) =>
            setDialog((s) => ({
              open: o,
              editing: o ? s.editing : undefined,
            }))
          }
          reminder={dialog.editing}
        />
      )}
    </>
  )
}
