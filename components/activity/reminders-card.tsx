"use client"

import { ReminderDialog } from "@/components/clients/reminder-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import {
  useOptimisticAction,
  useOptimisticDerived,
} from "@/hooks/use-optimistic-store"
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus"
import type { Reminder } from "@/lib/actions/reminders"
import { completeReminder } from "@/lib/actions/reminders"
import {
  applyRemindersAction,
  hydrateReminders,
  useRemindersStore,
} from "@/stores/reminders-store"
import { cn } from "cn"
import { Bell, BellOff, Check, Pencil } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"

interface RemindersCardProps {
  initialReminders: Reminder[]
}

export function RemindersCard({
  initialReminders,
}: RemindersCardProps) {
  const t = useTranslations()
  useRefreshOnFocus()
  const [reminderDialog, setReminderDialog] = useState<{
    open: boolean
    editing?: Reminder
  }>({ open: false })

  const optimisticReminders = useOptimisticDerived(
    useRemindersStore,
    applyRemindersAction
  )
  const { run } = useOptimisticAction(useRemindersStore)

  useEffect(() => {
    hydrateReminders(initialReminders)
  }, [initialReminders])

  async function completeReminderClickHandler(reminder: Reminder) {
    const result = await run(
      { type: "complete", id: reminder.id },
      () => completeReminder(reminder.id)
    )
    if (result.success) {
      toast.success(t("reminders.reminderCompleted"))
    } else {
      toast.error(result.error || t("common.somethingWentWrong"))
    }
  }

  function handleEdit(reminder: Reminder) {
    setReminderDialog({ open: true, editing: reminder })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("activity.activeReminders")}
          {optimisticReminders.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({optimisticReminders.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {optimisticReminders.length > 0 ? (
          <ItemGroup>
            {optimisticReminders.map((reminder) => {
              const [y, m, d] = reminder.remindAt.split("-")
              const date = `${m}/${d}/${y}`
              const isCompleted = reminder.completed === true
              const isOverdue =
                !isCompleted &&
                new Date(reminder.remindAt) <
                  new Date(new Date().toDateString())

              return (
                <Item
                  key={reminder.id}
                  size="sm"
                  className={cn(
                    "hover:bg-muted/50",
                    isCompleted && "opacity-60"
                  )}
                  onDoubleClick={() => handleEdit(reminder)}
                >
                  <ItemMedia variant="icon">
                    {isCompleted ? (
                      <Check className="text-muted-foreground" />
                    ) : (
                      <Bell
                        className={cn(
                          isOverdue
                            ? "text-destructive"
                            : "text-amber-500"
                        )}
                      />
                    )}
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      <Link
                        href={`/app/clientes/${reminder.clientId}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {reminder.clientName}
                      </Link>
                      <span
                        className={cn(
                          "text-xs",
                          isOverdue && "font-medium text-destructive"
                        )}
                      >
                        {date}
                      </span>
                    </ItemTitle>
                    <ItemDescription>
                      {isCompleted ? (
                        <span className="line-through">
                          {reminder.description}
                        </span>
                      ) : (
                        reminder.description
                      )}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="sm:hidden"
                      onClick={() => handleEdit(reminder)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="outline"
                      className="hidden sm:inline-flex"
                      onClick={() => handleEdit(reminder)}
                    >
                      <Pencil />
                      {t("activity.edit")}
                    </Button>
                    {!isCompleted && (
                      <>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="sm:hidden"
                          title={t("reminders.markAsCompleted")}
                          onClick={() =>
                            completeReminderClickHandler(reminder)
                          }
                        >
                          <Check />
                        </Button>
                        <Button
                          variant="outline"
                          className="hidden sm:inline-flex"
                          title={t("reminders.markAsCompleted")}
                          onClick={() =>
                            completeReminderClickHandler(reminder)
                          }
                        >
                          <Check />
                          {t("activity.markAsDone")}
                        </Button>
                      </>
                    )}
                  </ItemActions>
                </Item>
              )
            })}
          </ItemGroup>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BellOff className="h-4 w-4" />
            {t("activity.noReminders")}
          </div>
        )}
      </CardContent>
      <ReminderDialog
        clientId={
          reminderDialog.editing?.clientId ??
          initialReminders[0]?.clientId ??
          ""
        }
        open={reminderDialog.open}
        onOpenChange={(o) =>
          setReminderDialog((s) => ({
            open: o,
            editing: o ? s.editing : undefined,
          }))
        }
        reminder={reminderDialog.editing}
      />
    </Card>
  )
}
