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
import { Spinner } from "@/components/ui/spinner"
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus"
import type { ActiveReminder } from "@/lib/actions/reminders"
import {
  completeReminder,
  upsertReminder,
} from "@/lib/actions/reminders"
import { cn } from "@/lib/util/utils"
import { Bell, BellOff, Check, Pencil } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface ActiveRemindersCardProps {
  reminders: ActiveReminder[]
}

export function ActiveRemindersCard({
  reminders,
}: ActiveRemindersCardProps) {
  const router = useRouter()
  const t = useTranslations()
  const { start: startLoading, stop: stopLoading } =
    useLoadingIndicator()
  useRefreshOnFocus()
  const [editingReminder, setEditingReminder] =
    useState<ActiveReminder | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)

  async function completeReminderClickHandler(
    reminder: ActiveReminder
  ) {
    setCompletingId(reminder.id)
    startLoading()
    try {
      const result = await completeReminder(reminder.id)
      if (result.success) {
        toast.success(t("reminders.reminderCompleted"))
        router.refresh()
      } else {
        toast.error(t("reminders.failedToComplete"))
      }
    } finally {
      stopLoading()
      setCompletingId(null)
    }
  }

  async function reminderSubmitHandler(data: {
    clientId: string
    description: string
    remindAt: string
  }) {
    if (!editingReminder) return { success: false }
    const reminderId = editingReminder.id
    setEditingReminder(null)
    startLoading()
    let result
    try {
      result = await upsertReminder(data, reminderId)
      if (result.success) {
        toast.success(t("reminders.reminderUpdated"))
      } else {
        toast.error(result.error || t("common.somethingWentWrong"))
      }
      router.refresh()
    } finally {
      stopLoading()
    }
    return result
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("activity.activeReminders")}
          {reminders.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({reminders.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reminders.length > 0 ? (
          <ItemGroup>
            {reminders.map((reminder) => {
              const [y, m, d] = reminder.remindAt.split("-")
              const date = `${m}/${d}/${y}`
              const isOverdue =
                new Date(reminder.remindAt) <
                new Date(new Date().toDateString())

              return (
                <Item
                  key={reminder.id}
                  size="sm"
                  className="hover:bg-muted/50"
                  onDoubleClick={() => setEditingReminder(reminder)}
                >
                  <ItemMedia variant="icon">
                    <Bell
                      className={cn(
                        isOverdue
                          ? "text-destructive"
                          : "text-amber-500"
                      )}
                    />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      <Link
                        href={`/dashboard/clients/${reminder.clientId}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {reminder.clientName}
                      </Link>
                      <span
                        className={cn(
                          "text-xs",
                          isOverdue
                            ? "font-medium text-destructive"
                            : "text-muted-foreground"
                        )}
                      >
                        {date}
                      </span>
                    </ItemTitle>
                    <ItemDescription>
                      {reminder.description}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="sm:hidden"
                      onClick={() => setEditingReminder(reminder)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="outline"
                      className="hidden sm:inline-flex"
                      onClick={() => setEditingReminder(reminder)}
                    >
                      <Pencil />
                      {t("activity.edit")}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="sm:hidden"
                      title={t("reminders.markAsCompleted")}
                      onClick={() =>
                        completeReminderClickHandler(reminder)
                      }
                      disabled={completingId === reminder.id}
                    >
                      {completingId === reminder.id ? (
                        <Spinner />
                      ) : (
                        <Check />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="hidden sm:inline-flex"
                      title={t("reminders.markAsCompleted")}
                      onClick={() =>
                        completeReminderClickHandler(reminder)
                      }
                      disabled={completingId === reminder.id}
                    >
                      {completingId === reminder.id ? (
                        <Spinner />
                      ) : (
                        <Check />
                      )}
                      {t("activity.markAsDone")}
                    </Button>
                  </ItemActions>
                </Item>
              )
            })}
          </ItemGroup>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BellOff className="h-4 w-4" />
            {t("activity.noActiveReminders")}
          </div>
        )}
      </CardContent>
      {editingReminder && (
        <ReminderDialog
          clientId={editingReminder.clientId}
          reminder={{
            id: editingReminder.id,
            clientId: editingReminder.clientId,
            description: editingReminder.description,
            remindAt: editingReminder.remindAt,
            completed: false,
            completedAt: null,
            createdBy: "",
            createdAt: new Date(),
            updatedAt: new Date(),
            store_id: null,
          }}
          open={!!editingReminder}
          onOpenChange={(open) => {
            if (!open) setEditingReminder(null)
          }}
          onSubmit={reminderSubmitHandler}
        />
      )}
    </Card>
  )
}
