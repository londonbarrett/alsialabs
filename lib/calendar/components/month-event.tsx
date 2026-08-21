"use client"

import { EventDetailDialog } from "@/components/calendar/event-detail-dialog"
import { cn } from "@/lib/util/utils"
import { RefreshCw } from "lucide-react"
import { memo, useState } from "react"
import type { CalendarEvent } from "../types"
import { formatTime } from "../util/date"
import { eventTint } from "../util/event-style"
import { TaskStatusIcon } from "./task-status-icon"

type MonthEventProps = {
  event: CalendarEvent
  locale: string
  showTime?: boolean
  onEventClick?: (event: CalendarEvent) => void
}

export const MonthEvent = memo(function MonthEvent({
  event,
  locale,
  showTime = false,
  onEventClick,
}: MonthEventProps) {
  const [open, setOpen] = useState(false)

  const isTimed =
    !event.allDay && event.start.getTime() !== event.end.getTime()

  const isPast = event.end.getTime() < Date.now()

  return (
    <>
      <button
        type="button"
        tabIndex={0}
        style={eventTint(event.color)}
        onClick={() => {
          setOpen(true)
          onEventClick?.(event)
        }}
        className={cn(
          "flex w-full items-center gap-1 truncate rounded-sm border px-1.5 py-0.5 text-left text-xs text-foreground",
          event.color
            ? "border-l-2"
            : "border-l-2 border-l-primary/70 bg-primary/10",
          !event.allDay && isTimed && "font-medium",
          "cursor-pointer hover:opacity-80",
          event.allDay && "border",
          isPast && "opacity-60"
        )}
      >
        {event.meta?.kind === "task" && (
          <TaskStatusIcon event={event} />
        )}
        {event.meta?.kind === "routine" && (
          <RefreshCw
            aria-hidden
            className="size-3 shrink-0 text-muted-foreground"
          />
        )}
        {showTime && isTimed && !event.meta && (
          <span className="shrink-0 text-muted-foreground tabular-nums">
            {formatTime(event.start, locale)}
          </span>
        )}
        <span
          className={cn(
            "truncate",
            event.meta?.kind === "task" &&
              event.meta.status === "cancelled" &&
              "line-through"
          )}
        >
          {event.title}
        </span>
      </button>
      {open && (
        <EventDetailDialog
          event={event}
          locale={locale}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  )
})
