"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Bell, BellOff, Check, Pencil } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemActions,
  ItemGroup,
  ItemTitle,
  ItemDescription,
} from "@/components/ui/item"
import { ReminderDialog } from "@/components/clients/reminder-dialog"
import { completeReminder } from "@/lib/actions/reminders"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { ActiveReminder } from "@/lib/actions/reminders"

interface ActiveRemindersCardProps {
  reminders: ActiveReminder[]
}

export function ActiveRemindersCard({
  reminders,
}: ActiveRemindersCardProps) {
  const router = useRouter()
  const t = useTranslations("activity")
  const tReminders = useTranslations("reminders")
  const [editingReminder, setEditingReminder] =
    useState<ActiveReminder | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)

  async function handleComplete(reminder: ActiveReminder) {
    setCompletingId(reminder.id)
    const result = await completeReminder(reminder.id)
    if (result.success) {
      toast.success(tReminders("reminderCompleted"))
      router.refresh()
    } else {
      toast.error(tReminders("failedToComplete"))
    }
    setCompletingId(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("activeReminders")}
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
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingReminder(reminder)
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="outline"
                      className="hidden sm:inline-flex"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingReminder(reminder)
                      }}
                    >
                      <Pencil />
                      {t("edit")}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="sm:hidden"
                      title={tReminders("markAsCompleted")}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleComplete(reminder)
                      }}
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
                      title={tReminders("markAsCompleted")}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleComplete(reminder)
                      }}
                      disabled={completingId === reminder.id}
                    >
                      {completingId === reminder.id ? (
                        <Spinner />
                      ) : (
                        <Check />
                      )}
                      {t("markAsDone")}
                    </Button>
                  </ItemActions>
                </Item>
              )
            })}
          </ItemGroup>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BellOff className="h-4 w-4" />
            {t("noActiveReminders")}
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
          }}
          open={!!editingReminder}
          onOpenChange={(open) => {
            if (!open) setEditingReminder(null)
          }}
          onSuccess={() => {
            setEditingReminder(null)
            router.refresh()
          }}
        />
      )}
    </Card>
  )
}
