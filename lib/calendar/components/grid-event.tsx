"use client"

import { EventDetailDialog } from "@/components/calendar/event-detail-dialog"
import { cn } from "@/lib/util/utils"
import { RefreshCw } from "lucide-react"
import { memo, useState } from "react"
import type { CalendarEvent, GridEventPosition } from "../types"
import { formatTime } from "../util/date"
import { eventTint } from "../util/event-style"
import { TaskStatusIcon } from "./task-status-icon"

type GridEventProps = {
  position: GridEventPosition
  locale: string
  onEventClick?: (event: CalendarEvent) => void
}

export const GridEvent = memo(function GridEvent({
  position,
  locale,
  onEventClick,
}: GridEventProps) {
  const { event, top, height, width, left, zIndex } = position
  const [open, setOpen] = useState(false)

  const isPast = event.end.getTime() < Date.now()

  return (
    <>
      <button
        type="button"
        tabIndex={0}
        style={{
          ...eventTint(event.color),
          top,
          height,
          width: `${width}%`,
          left: `${left}%`,
          zIndex,
        }}
        onClick={() => {
          setOpen(true)
          onEventClick?.(event)
        }}
        className={cn(
          "absolute flex flex-col overflow-hidden rounded-md border-l-2 px-1.5 py-1 text-left",
          event.color
            ? "border-l-2"
            : "border-l-2 border-l-primary/70 bg-primary/10",
          "cursor-pointer hover:opacity-80",
          isPast && "opacity-60"
        )}
      >
        <span className="flex min-w-0 items-center gap-1 text-xs leading-tight font-medium">
          {event.meta?.kind === "routine" && (
            <RefreshCw
              aria-hidden
              className="size-3 shrink-0 text-muted-foreground"
            />
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
          <TaskStatusIcon event={event} />
        </span>
        <span className="truncate text-[11px] leading-tight text-muted-foreground tabular-nums">
          {formatTime(event.start, locale)}
          {event.end.getTime() > event.start.getTime() &&
            ` – ${formatTime(event.end, locale)}`}
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