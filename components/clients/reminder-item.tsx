"use client"

import { ReminderDialog } from "@/components/clients/reminder-dialog"
import { ActionMenu } from "@/components/common/action-menu"
import { Button } from "@/components/ui/button"
import type { ClientReminder } from "@/lib/drizzle/schema"
import { useHasPermission } from "@/components/common/permissions-provider"
import { useTimelineActions } from "@/stores/use-timeline-actions"
import { Bell, BellOff, CheckCircle2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

interface ReminderItemProps {
  reminder: ClientReminder
  clientId: string
}

/**
 * A reminder row on the client detail timeline. Requires `TimelineProvider`,
 * which that page mounts. The activity page renders its rows with
 * `ReminderEntryRow` instead, since it has no timeline store.
 */
export function ReminderItem({
  reminder,
  clientId,
}: ReminderItemProps) {
  const t = useTranslations("reminders")
  const {
    createReminder,
    updateReminder,
    completeReminder,
    deleteReminder,
  } = useTimelineActions()
  const canEdit = useHasPermission("client-activity:edit")
  const canDelete = useHasPermission("client-activity:delete")
  const canComplete = useHasPermission("client-activity:edit")
  const [dialog, setDialog] = useState<{
    open: boolean
    editing?: ClientReminder
  }>({ open: false })

  return (
    <>
      <ReminderRow
        reminder={reminder}
        actions={
          <>
            {canComplete && !reminder.completed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => completeReminder(reminder.id)}
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
              onDelete={() => deleteReminder(reminder.id)}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          </>
        }
      />
      <ReminderDialog
        clientId={clientId}
        open={dialog.open}
        onSubmit={(data, editingId) =>
          editingId
            ? updateReminder(data, editingId)
            : createReminder(data)
        }
        onOpenChange={(o) =>
          setDialog((s) => ({
            open: o,
            editing: o ? s.editing : undefined,
          }))
        }
        reminder={dialog.editing}
      />
    </>
  )
}

function ReminderRow({
  reminder,
  actions,
}: {
  reminder: ClientReminder
  actions?: React.ReactNode
}) {
  const t = useTranslations("reminders")

  const [y, m, d] = reminder.remindAt.split("-")
  const date = `${m}/${d}/${y}`
  const isOverdue =
    !reminder.completed &&
    new Date(reminder.remindAt) < new Date(new Date().toDateString())

  return (
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
      {actions && (
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {actions}
        </div>
      )}
    </div>
  )
}
