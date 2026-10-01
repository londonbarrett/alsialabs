"use client"

import type { ClientReminder } from "@/lib/drizzle/schema"
import { Bell, BellOff } from "lucide-react"
import { useTranslations } from "next-intl"

/**
 * A client reminder on the activity page's expanded list. Presentation only —
 * no actions, no store. The row's own pencil button opens the dialog.
 */
export function ReminderEntryRow({
  reminder,
}: {
  reminder: ClientReminder
}) {
  const t = useTranslations("reminders")

  const [y, m, d] = reminder.remindAt.split("-")
  const date = `${m}/${d}/${y}`
  const isOverdue =
    !reminder.completed &&
    new Date(reminder.remindAt) < new Date(new Date().toDateString())

  return (
    <div
      className={`flex items-start gap-3 py-3 ${
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
    </div>
  )
}
