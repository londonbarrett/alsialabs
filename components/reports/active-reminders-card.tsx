"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { Bell, BellOff } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ActiveReminder } from "@/lib/actions/reminders"

interface ActiveRemindersCardProps {
  reminders: ActiveReminder[]
}

export function ActiveRemindersCard({
  reminders,
}: ActiveRemindersCardProps) {
  const router = useRouter()

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Active Reminders
          {reminders.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({reminders.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reminders.length > 0 ? (
          <div className="space-y-1">
            {reminders.map((reminder) => {
              const [y, m, d] = reminder.remindAt.split("-")
              const date = `${m}/${d}/${y}`
              const isOverdue =
                new Date(reminder.remindAt) <
                new Date(new Date().toDateString())

              return (
                <div
                  key={reminder.id}
                  className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
                  onDoubleClick={() =>
                    router.push(
                      `/dashboard/clients/${reminder.clientId}`
                    )
                  }
                >
                  <Bell
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isOverdue ? "text-destructive" : "text-amber-500"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <Link
                        href={`/dashboard/clients/${reminder.clientId}`}
                        className="text-sm font-medium hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {reminder.clientName}
                      </Link>
                      <span className="truncate text-sm text-muted-foreground">
                        {reminder.description}
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-xs",
                      isOverdue
                        ? "font-medium text-destructive"
                        : "text-muted-foreground"
                    )}
                  >
                    {date}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BellOff className="h-4 w-4" />
            No active reminders
          </div>
        )}
      </CardContent>
    </Card>
  )
}
